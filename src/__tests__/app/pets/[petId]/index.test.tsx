import { act, fireEvent } from '@testing-library/react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import HomeScreen from '@/app/index';
import WalletScreen from '@/app/pets/[petId]/index';
import { archivePet } from '@/data/pets';
import { newAttachment, newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';
import { addDays, todayLocal } from '@/domain/dates';
import { fakeFs } from '@/services/fakeFileSystem';

jest.mock('expo-file-system', () => jest.requireActual('@/services/fakeFileSystem').fakeModule);
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const routes = {
  index: HomeScreen,
  'pets/[petId]/index': WalletScreen,
  'pets/[petId]/edit': () => <View testID="edit-pet" />,
  'vaccinations/new': () => <View testID="new-vaccination" />,
  'vaccinations/[id]/index': () => <View testID="vaccination-detail" />,
  archived: () => <View />,
  'pets/new': () => <View />,
};
const renderWallet = (petId: string) => renderRouter(routes, { initialUrl: `/pets/${petId}` });

function vaccinate(petId: string, vaccineName: string, appliedOn: string, nextDueOn: string | null = null) {
  return createVaccination(db, { petId, vaccineName, appliedOn, nextDueOn });
}

describe('Carteira do pet screen', () => {
  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
    fakeFs.reset();
    jest.clearAllMocks();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    jest.mocked(Sharing.shareAsync).mockResolvedValue(undefined);
    jest.mocked(Print.printToFileAsync).mockImplementation(async () => {
      fakeFs.addFile('file:///cache/Print/x.pdf', 10);
      return { uri: 'file:///cache/Print/x.pdf', numberOfPages: 1 };
    });
  });

  it('shows the pet and an invitation to register the first vaccine', async () => {
    const pet = newPet(db, { name: 'Thor', breed: 'SRD' });

    await renderWallet(pet.id);

    expect(screen.getAllByText('Thor').length).toBeGreaterThan(0);
    expect(screen.getByText('Nenhuma vacina registrada')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Nova vacina' })).toBeOnTheScreen();
  });

  it('shows the current records above and the earlier applications under "Aplicações anteriores"', async () => {
    const pet = newPet(db, { name: 'Thor' });
    vaccinate(pet.id, 'Antirrábica', '2024-11-28', '2025-11-28');
    vaccinate(pet.id, 'Antirrábica', '2025-12-02', addDays(todayLocal(), 20));
    vaccinate(pet.id, 'V10', '2026-03-18', addDays(todayLocal(), 400));

    await renderWallet(pet.id);

    expect(screen.getByText('Aplicações anteriores')).toBeOnTheScreen();
    expect(screen.getByText('Vence em 20 dias')).toBeOnTheScreen();
    expect(screen.getByText('Em dia')).toBeOnTheScreen();
    const texts = screen.getAllByText(/^(Antirrábica|V10|Aplicações anteriores)$/).map((node) => node.props.children);
    expect(texts).toEqual(['Antirrábica', 'V10', 'Aplicações anteriores', 'Antirrábica']);
    // Only the current records carry a due-date badge.
    expect(screen.getAllByText(/^(Vence em \d+ dias|Vencida há|Em dia)/)).toHaveLength(2);
  });

  it('describes each record with its dates', async () => {
    const pet = newPet(db);
    vaccinate(pet.id, 'Giárdia', '2026-03-18', '2027-03-18');
    vaccinate(pet.id, 'V10', '2026-03-19');

    await renderWallet(pet.id);

    expect(screen.getByText('Aplicada em 18/03/2026 · Próxima dose em 18/03/2027')).toBeOnTheScreen();
    expect(screen.getByText('Aplicada em 19/03/2026')).toBeOnTheScreen();
  });

  it('shows "Sem comprovante" only on records without attachments', async () => {
    const pet = newPet(db);
    const withProof = vaccinate(pet.id, 'V10', '2026-03-18');
    vaccinate(pet.id, 'Giárdia', '2026-03-18');
    newAttachment(db, withProof.id);

    await renderWallet(pet.id);

    expect(screen.getAllByText('Sem comprovante')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Giárdia.*Sem comprovante$/ })).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /^V10/ }).props.accessibilityLabel).not.toMatch(/Sem comprovante/);
  });

  describe('filters', () => {
    async function renderWithStatuses() {
      const pet = newPet(db, { name: 'Thor' });
      vaccinate(pet.id, 'Antirrábica', '2025-01-01', '2026-01-01'); // superseded below
      vaccinate(pet.id, 'Antirrábica', '2025-12-01', addDays(todayLocal(), -3)); // overdue
      vaccinate(pet.id, 'V10', '2026-03-18', addDays(todayLocal(), 10)); // due soon
      vaccinate(pet.id, 'Giárdia', '2026-03-18', addDays(todayLocal(), 400)); // ok
      await renderWallet(pet.id);
    }

    it('"Vencidas" shows only the overdue current records and hides the previous applications', async () => {
      await renderWithStatuses();

      await fireEvent.press(screen.getByRole('radio', { name: 'Vencidas' }));

      expect(screen.getByText('Vencida há 3 dias')).toBeOnTheScreen();
      expect(screen.queryByText('V10')).toBeNull();
      expect(screen.queryByText('Giárdia')).toBeNull();
      expect(screen.getAllByText('Antirrábica')).toHaveLength(1);
      expect(screen.queryByText('Aplicações anteriores')).toBeNull();
    });

    it('"Vence em breve" shows only the records due soon', async () => {
      await renderWithStatuses();

      await fireEvent.press(screen.getByRole('radio', { name: 'Vence em breve' }));

      expect(screen.getByText('V10')).toBeOnTheScreen();
      expect(screen.queryByText('Giárdia')).toBeNull();
      expect(screen.queryByText('Antirrábica')).toBeNull();
    });

    it('"Todas" brings everything back', async () => {
      await renderWithStatuses();

      await fireEvent.press(screen.getByRole('radio', { name: 'Vencidas' }));
      await fireEvent.press(screen.getByRole('radio', { name: 'Todas' }));

      expect(screen.getByText('Giárdia')).toBeOnTheScreen();
      expect(screen.getByText('Aplicações anteriores')).toBeOnTheScreen();
    });

    it('says so when no record has the chosen status', async () => {
      const pet = newPet(db);
      vaccinate(pet.id, 'V10', '2026-03-18', addDays(todayLocal(), 400));
      await renderWallet(pet.id);

      await fireEvent.press(screen.getByRole('radio', { name: 'Vencidas' }));

      expect(screen.getByText('Nenhuma vacina nesta situação.')).toBeOnTheScreen();
    });
  });

  describe('navigation', () => {
    it('opens a record from its card', async () => {
      const pet = newPet(db);
      const record = vaccinate(pet.id, 'V10', '2026-03-18');
      await renderWallet(pet.id);

      await fireEvent.press(screen.getByRole('button', { name: /^V10/ }));

      expect(screen).toHavePathname(`/vaccinations/${record.id}`);
    });

    it('opens the new vaccine form for this pet', async () => {
      const pet = newPet(db);
      await renderWallet(pet.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Nova vacina' }));

      expect(screen).toHavePathname('/vaccinations/new');
      expect(screen).toHaveSearchParams({ petId: pet.id });
    });

    it('opens "Editar pet"', async () => {
      const pet = newPet(db);
      await renderWallet(pet.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Editar pet' }));

      expect(screen).toHavePathname(`/pets/${pet.id}/edit`);
    });
  });

  describe('a pet with the wallet closed', () => {
    function archivedPetWithRecords() {
      const pet = newPet(db, { name: 'Bolinha' });
      vaccinate(pet.id, 'V10', '2020-03-18', '2021-03-18');
      vaccinate(pet.id, 'V10', '2019-03-18', '2020-03-18');
      archivePet(db, pet.id, 'deceased', null);
      return pet;
    }

    it('lists the records without due-date badges, filters or "Nova vacina"', async () => {
      const pet = archivedPetWithRecords();

      await renderWallet(pet.id);

      expect(screen.getAllByRole('button', { name: /^V10/ })).toHaveLength(2);
      expect(screen.getByText('Aplicações anteriores')).toBeOnTheScreen();
      expect(screen.queryByText(/^(Vence|Vencida|Em dia)/)).toBeNull();
      expect(screen.queryByRole('radio', { name: 'Vencidas' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Nova vacina' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Editar pet' })).toBeNull();
      expect(screen.getByText(/Carteira encerrada/)).toBeOnTheScreen();
    });

    it('can be reactivated, which brings the actions back', async () => {
      const pet = archivedPetWithRecords();
      await renderWallet(pet.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Reativar carteira' }));

      expect(db.select().from(pets).all()[0]).toMatchObject({ status: 'active', archivedReason: null });
      expect(screen.getByRole('button', { name: 'Nova vacina' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Reativar carteira' })).toBeNull();
    });
  });

  describe('"Exportar PDF"', () => {
    const exportButton = () => screen.getByRole('button', { name: 'Exportar PDF' });

    it('is hidden while the wallet has no vaccination', async () => {
      const pet = newPet(db);
      await renderWallet(pet.id);
      expect(screen.queryByRole('button', { name: 'Exportar PDF' })).toBeNull();
    });

    it('generates the PDF from the stored records and opens the share sheet', async () => {
      const pet = newPet(db, { name: 'Thor' });
      vaccinate(pet.id, 'V10', '2026-03-18');
      await renderWallet(pet.id);

      await fireEvent.press(exportButton());

      expect((jest.mocked(Print.printToFileAsync).mock.calls[0][0] as { html: string }).html).toContain('V10');
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        `file:///cache/carteira-thor-${todayLocal()}.pdf`,
        expect.objectContaining({ mimeType: 'application/pdf' }),
      );
      expect(screen.queryByText('Não foi possível gerar o PDF. Tente novamente.')).toBeNull();
    });

    it('is available for a wallet that was closed', async () => {
      const pet = newPet(db, { name: 'Bolinha' });
      vaccinate(pet.id, 'V10', '2020-03-18');
      archivePet(db, pet.id, 'deceased', null);
      await renderWallet(pet.id);

      await fireEvent.press(exportButton());

      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    });

    it('shows a busy state and ignores a second tap while generating', async () => {
      const pet = newPet(db);
      vaccinate(pet.id, 'V10', '2026-03-18');
      let finish!: () => void;
      jest.mocked(Print.printToFileAsync).mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = () => {
              fakeFs.addFile('file:///cache/Print/x.pdf', 10);
              resolve({ uri: 'file:///cache/Print/x.pdf', numberOfPages: 1 });
            };
          }),
      );
      await renderWallet(pet.id);

      await fireEvent.press(exportButton());
      const busy = screen.getByRole('button', { name: 'Gerando PDF…' });
      expect(busy.props.accessibilityState).toMatchObject({ busy: true, disabled: true });
      await fireEvent.press(busy);
      await act(async () => finish());

      expect(Print.printToFileAsync).toHaveBeenCalledTimes(1);
      expect((await screen.findByRole('button', { name: 'Exportar PDF' })).props.accessibilityState?.busy).toBeFalsy();
    });

    it('shows an error and allows a retry when generating fails', async () => {
      const pet = newPet(db);
      vaccinate(pet.id, 'V10', '2026-03-18');
      jest.mocked(Print.printToFileAsync).mockRejectedValueOnce(new Error('boom'));
      await renderWallet(pet.id);

      await fireEvent.press(exportButton());
      expect(screen.getByText('Não foi possível gerar o PDF. Tente novamente.')).toBeOnTheScreen();

      await fireEvent.press(exportButton());
      expect(screen.queryByText('Não foi possível gerar o PDF. Tente novamente.')).toBeNull();
      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    });

    it('says so when the device cannot share files', async () => {
      const pet = newPet(db);
      vaccinate(pet.id, 'V10', '2026-03-18');
      jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);
      await renderWallet(pet.id);

      await fireEvent.press(exportButton());

      expect(screen.getByText('Este aparelho não permite compartilhar arquivos.')).toBeOnTheScreen();
    });
  });

  it('shows a way back to Meus pets when the pet does not exist', async () => {
    await renderWallet('missing-pet');

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para Meus pets' }));
    expect(screen).toHavePathname('/');
  });
});
