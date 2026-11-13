import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import WalletScreen from '@/app/pets/[petId]/index';
import VaccinationDetailScreen from '@/app/vaccinations/[id]/index';
import { archivePet } from '@/data/pets';
import { newAttachment, newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';
import { addDays, todayLocal } from '@/domain/dates';
import { deleteFiles } from '@/services/files';
import { preparePhoto } from '@/services/photos';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/files', () => ({
  photoUri: (file: string) => `file:///docs/photos/${file}`,
  petPhotoUri: (file: string) => `file:///docs/pets/${file}`,
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/photos', () => ({ preparePhoto: jest.fn() }));

let photoSeq = 100;
const prepared = () => {
  photoSeq += 1;
  const id = `00000000-0000-4000-8000-${String(photoSeq).padStart(12, '0')}`;
  return { id, file: `${id}.jpg`, sizeBytes: 5000, width: 1600, height: 1200 };
};

const routes = {
  index: () => null,
  'pets/[petId]/index': WalletScreen,
  'vaccinations/[id]/index': VaccinationDetailScreen,
  'vaccinations/[id]/edit': () => <View testID="edit-vaccination" />,
  'vaccinations/new': () => <View testID="new-vaccination" />,
  'attachments/[id]': () => <View testID="viewer" />,
};
const renderDetail = (id: string) => renderRouter(routes, { initialUrl: `/vaccinations/${id}` });
const stored = () => db.select().from(vaccinations).all();

describe('Detalhe da vacina screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
  });

  afterEach(() => jest.restoreAllMocks());

  it('shows the data that was filled in and leaves out the rest', async () => {
    const pet = newPet(db, { name: 'Thor' });
    const record = createVaccination(db, {
      petId: pet.id,
      vaccineName: 'Antirrábica',
      appliedOn: '2025-12-02',
      nextDueOn: '2026-12-02',
      batch: 'L123',
      vetName: 'Dra. Ana',
      vetLicense: 'SP-1234',
    });

    await renderDetail(record.id);

    expect(screen.getByText('Thor')).toBeOnTheScreen();
    expect(screen.getByText('02/12/2025')).toBeOnTheScreen();
    expect(screen.getByText('02/12/2026')).toBeOnTheScreen();
    expect(screen.getByText('L123')).toBeOnTheScreen();
    expect(screen.getByText('Dra. Ana · CRMV SP-1234')).toBeOnTheScreen();
    expect(screen.queryByText('Marca')).toBeNull();
    expect(screen.queryByText('Clínica')).toBeNull();
    expect(screen.queryByText('Observações')).toBeNull();
  });

  it('shows the status of a current record as text', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, {
      petId: pet.id,
      vaccineName: 'V10',
      appliedOn: '2026-01-01',
      nextDueOn: addDays(todayLocal(), 20),
    });

    await renderDetail(record.id);

    expect(screen.getByText('Vence em 20 dias')).toBeOnTheScreen();
  });

  it('shows no due-date status on a previous application', async () => {
    const pet = newPet(db);
    const old = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2024-01-01', nextDueOn: '2025-01-01' });
    createVaccination(db, { petId: pet.id, vaccineName: 'v10', appliedOn: '2026-01-01', nextDueOn: addDays(todayLocal(), 300) });

    await renderDetail(old.id);

    expect(screen.queryByText(/^(Vence|Vencida|Em dia)/)).toBeNull();
  });

  it('shows "Sem comprovante" when there are no attachments', async () => {
    const pet = newPet(db);
    const bare = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });

    await renderDetail(bare.id);
    expect(screen.getByText('Sem comprovante')).toBeOnTheScreen();
  });

  it('does not show "Sem comprovante" when the record has an attachment', async () => {
    const pet = newPet(db);
    const proven = createVaccination(db, { petId: pet.id, vaccineName: 'Giárdia', appliedOn: '2026-01-01' });
    newAttachment(db, proven.id);

    await renderDetail(proven.id);

    expect(screen.queryByText('Sem comprovante')).toBeNull();
  });

  it('opens the form for a booster of this vaccine', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
    await renderDetail(record.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Registrar reforço' }));

    expect(screen).toHavePathname('/vaccinations/new');
    expect(screen).toHaveSearchParams({ petId: pet.id, fromVaccinationId: record.id });
  });

  it('opens the edit screen', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
    await renderDetail(record.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Editar' }));

    expect(screen).toHavePathname(`/vaccinations/${record.id}/edit`);
  });

  describe('deleting', () => {
    it('asks for confirmation and keeps the record on cancel', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      await renderDetail(record.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      expect(screen.getByText('Excluir V10?')).toBeOnTheScreen();
      expect(stored()).toHaveLength(1);

      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(screen.queryByText('Excluir V10?')).toBeNull();
      expect(stored()).toHaveLength(1);
    });

    it('deletes the record and its attachments after confirming, then returns to the wallet', async () => {
      const pet = newPet(db, { name: 'Thor' });
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      const first = newAttachment(db, record.id);
      const second = newAttachment(db, record.id);
      await renderDetail(record.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

      expect(stored()).toEqual([]);
      expect(db.select().from(attachments).all()).toEqual([]);
      expect(deleteFiles).toHaveBeenCalledTimes(1);
      expect(deleteFiles).toHaveBeenCalledWith(expect.arrayContaining([first.file, second.file]));
      expect(screen).toHavePathname(`/pets/${pet.id}`);
      expect(screen.getByText('Nenhuma vacina registrada')).toBeOnTheScreen();
    });

    it('keeps the files when the user cancels', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      newAttachment(db, record.id);
      await renderDetail(record.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

      expect(deleteFiles).not.toHaveBeenCalled();
    });

    it('does not show "not found" after a successful delete while navigation is pending', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      await renderDetail(record.id);
      jest.spyOn(router, 'dismissTo').mockImplementation(() => {});

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

      expect(stored()).toEqual([]);
      expect(screen.queryByText('Não encontramos este item')).toBeNull();
    });

    it('keeps the record and shows a message when deleting fails', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      await renderDetail(record.id);
      const dismissTo = jest.spyOn(router, 'dismissTo');
      jest.spyOn(db, 'transaction').mockImplementation(() => {
        throw new Error('disk full');
      });

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
      expect(dismissTo).not.toHaveBeenCalled();
      jest.restoreAllMocks();
      expect(stored()).toHaveLength(1);

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
      expect(stored()).toEqual([]);
    });

    it('deletes once and navigates once when the confirmation is pressed twice', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      await renderDetail(record.id);
      const dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      const confirm = screen.getByRole('button', { name: 'Excluir' });
      const transaction = jest.spyOn(db, 'transaction');

      await fireEvent.press(confirm);
      await fireEvent.press(confirm);

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(dismissTo).toHaveBeenCalledTimes(1);
      expect(stored()).toEqual([]);
    });
  });

  describe('proof photos', () => {
    const record = (petId: string) => createVaccination(db, { petId, vaccineName: 'V10', appliedOn: '2026-01-01' });
    const addPhoto = async (source: 'Tirar foto' | 'Escolher da galeria') => {
      await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
      await fireEvent.press(screen.getByRole('button', { name: source }));
    };

    it('lists a thumbnail per photo and opens one in the viewer', async () => {
      const proven = record(newPet(db).id);
      newAttachment(db, proven.id);
      const second = newAttachment(db, proven.id);
      await renderDetail(proven.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Abrir foto 2 de 2' }));

      expect(screen).toHavePathname(`/attachments/${second.id}`);
    });

    it('attaches a photo taken with the camera right away, with the file details', async () => {
      const photo = prepared();
      jest.mocked(preparePhoto).mockResolvedValue(photo);
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);
      expect(screen.getByText('Sem comprovante')).toBeOnTheScreen();

      await addPhoto('Tirar foto');

      expect(preparePhoto).toHaveBeenCalledWith('camera', expect.any(Object));
      expect(db.select().from(attachments).all()).toEqual([
        expect.objectContaining({ ...photo, vaccinationId: bare.id }),
      ]);
      expect(screen.queryByText('Sem comprovante')).toBeNull();
      expect(screen.getByRole('button', { name: 'Abrir foto 1 de 1' })).toBeOnTheScreen();
    });

    it('attaches a photo chosen from the gallery', async () => {
      jest.mocked(preparePhoto).mockResolvedValue(prepared());
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);

      await addPhoto('Escolher da galeria');

      expect(preparePhoto).toHaveBeenCalledWith('library', expect.any(Object));
      expect(db.select().from(attachments).all()).toHaveLength(1);
    });

    it('stores nothing when the user cancels or the permission is refused', async () => {
      jest.mocked(preparePhoto).mockResolvedValue(null);
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);

      await addPhoto('Tirar foto');

      expect(db.select().from(attachments).all()).toEqual([]);
      expect(screen.getByRole('button', { name: 'Adicionar foto' })).toBeOnTheScreen();
    });

    it('explains a refused camera permission without blocking anything', async () => {
      jest.mocked(preparePhoto).mockImplementation(async (_source, options) => {
        options?.onPermissionDenied?.();
        return null;
      });
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);

      await addPhoto('Tirar foto');

      expect(screen.getByText(/Sem acesso à câmera/)).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Adicionar foto' })).toBeOnTheScreen();
    });

    it('shows a message when the photo cannot be processed', async () => {
      jest.mocked(preparePhoto).mockRejectedValue(new Error('out of memory'));
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);

      await addPhoto('Escolher da galeria');

      expect(screen.getByText('Não foi possível processar a foto. Tente de novo.')).toBeOnTheScreen();
      expect(db.select().from(attachments).all()).toEqual([]);
    });

    it('does not offer a fourth photo', async () => {
      const full = record(newPet(db).id);
      for (let i = 0; i < 3; i += 1) newAttachment(db, full.id);

      await renderDetail(full.id);

      expect(screen.getAllByRole('button', { name: /^Abrir foto/ })).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Adicionar foto' })).toBeNull();
    });

    it('removes the new file when the attachment row cannot be saved', async () => {
      const photo = prepared();
      jest.mocked(preparePhoto).mockResolvedValue(photo);
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);
      jest.spyOn(db, 'transaction').mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      await addPhoto('Tirar foto');

      expect(deleteFiles).toHaveBeenCalledWith([photo.file]);
      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    });

    it('shows the photos of an archived pet but offers no way to add one', async () => {
      const pet = newPet(db);
      const proven = record(pet.id);
      newAttachment(db, proven.id);
      archivePet(db, pet.id, 'other', null);

      await renderDetail(proven.id);

      expect(screen.getByRole('button', { name: 'Abrir foto 1 de 1' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Adicionar foto' })).toBeNull();
    });

    it('shows no photo section for an archived pet without photos', async () => {
      const pet = newPet(db);
      const bare = record(pet.id);
      archivePet(db, pet.id, 'other', null);

      await renderDetail(bare.id);

      expect(screen.queryByText('Comprovante (até 3 fotos)')).toBeNull();
    });
  });

  it('can be opened for a pet with the wallet closed, without edit, delete or booster actions or badges', async () => {
    const pet = newPet(db, { name: 'Bolinha' });
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2020-01-01', nextDueOn: '2021-01-01' });
    archivePet(db, pet.id, 'deceased', null);

    await renderDetail(record.id);

    expect(screen.getByText('Bolinha')).toBeOnTheScreen();
    expect(screen.getByText('01/01/2020')).toBeOnTheScreen();
    expect(screen.queryByText(/^(Vence|Vencida|Em dia)/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Registrar reforço' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir vacina' })).toBeNull();
  });

  it('shows a way back to Meus pets when the record does not exist', async () => {
    await renderDetail('missing');

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para Meus pets' }));
    expect(screen).toHavePathname('/');
  });
});
