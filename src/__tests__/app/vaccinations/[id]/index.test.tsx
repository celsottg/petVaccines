import { act, fireEvent, waitFor } from '@testing-library/react-native';
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
import { setSetting } from '@/data/settings';
import { formatBrDate } from '@/domain/dateInput';
import { addDays, todayLocal } from '@/domain/dates';
import { deleteFiles } from '@/services/files';
import { preparePhoto } from '@/services/photos';
import { getNotificationPermission } from '@/services/reminders';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/files', () => ({
  photoUri: (file: string) => `file:///docs/photos/${file}`,
  petPhotoUri: (file: string) => `file:///docs/pets/${file}`,
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/photos', () => ({ preparePhoto: jest.fn() }));
jest.mock('@/services/reminders', () => ({ getNotificationPermission: jest.fn() }));

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
    jest.mocked(getNotificationPermission).mockResolvedValue('granted');
    db.delete(pets).run();
    db.delete(settings).run();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    // Implementations set with mockImplementation must not leak into the next test.
    jest.mocked(preparePhoto).mockReset();
    jest.mocked(deleteFiles).mockReset().mockResolvedValue(undefined);
  });

  it('shows the data that was filled in and leaves out the rest', async () => {
    // Fixed day: the record's reminders must still be ahead whenever the suite runs.
    jest.useFakeTimers({ doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'], now: new Date(2026, 10, 12, 10) });
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
    // The next dose row and the reminder of the day itself (Lembretes block) show the same date.
    expect(screen.getAllByText('02/12/2026')).toHaveLength(2);
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

    it('keeps the record and its files and shows a message when deleting fails, then deletes on retry', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      const proof = newAttachment(db, record.id);
      await renderDetail(record.id);
      const dismissTo = jest.spyOn(router, 'dismissTo');
      jest.spyOn(db, 'transaction').mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
      expect(dismissTo).not.toHaveBeenCalled();
      expect(stored()).toHaveLength(1);
      expect(db.select().from(attachments).all()).toHaveLength(1);
      expect(deleteFiles).not.toHaveBeenCalled();

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));
      expect(stored()).toEqual([]);
      expect(deleteFiles).toHaveBeenCalledWith([proof.file]);
    });

    it('still shows a successful result when the file removal fails afterwards', async () => {
      const pet = newPet(db);
      const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
      newAttachment(db, record.id);
      jest.mocked(deleteFiles).mockRejectedValue(new Error('read-only volume'));
      await renderDetail(record.id);

      await fireEvent.press(screen.getByRole('button', { name: 'Excluir vacina' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

      expect(stored()).toEqual([]);
      expect(screen).toHavePathname(`/pets/${pet.id}`);
      expect(screen.queryByText('Não foi possível salvar. Tente novamente.')).toBeNull();
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

    it('ignores a second tap on the source while the first photo is still being processed', async () => {
      let finish: (photo: ReturnType<typeof prepared>) => void = () => {};
      jest.mocked(preparePhoto).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);
      await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
      const source = screen.getByRole('button', { name: 'Escolher da galeria' });

      await fireEvent.press(source);
      await fireEvent.press(source);
      await act(async () => finish(prepared()));

      expect(preparePhoto).toHaveBeenCalledTimes(1);
      expect(db.select().from(attachments).all()).toHaveLength(1);
    });

    it('deletes the processed file when the screen is left before processing finishes', async () => {
      let finish: (photo: ReturnType<typeof prepared>) => void = () => {};
      jest.mocked(preparePhoto).mockReturnValue(new Promise((resolve) => (finish = resolve)));
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);
      await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
      await fireEvent.press(screen.getByRole('button', { name: 'Escolher da galeria' }));
      const photo = prepared();

      await screen.unmount();
      await act(async () => finish(photo));

      expect(deleteFiles).toHaveBeenCalledWith([photo.file]);
      expect(db.select().from(attachments).all()).toEqual([]);
    });

    it('can retry after the attachment could not be saved', async () => {
      const failed = prepared();
      jest.mocked(preparePhoto).mockResolvedValueOnce(failed).mockResolvedValueOnce(prepared());
      const bare = record(newPet(db).id);
      await renderDetail(bare.id);
      jest.spyOn(db, 'transaction').mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      await addPhoto('Escolher da galeria');
      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
      expect(deleteFiles).toHaveBeenCalledWith([failed.file]);
      expect(db.select().from(attachments).all()).toEqual([]);

      await addPhoto('Escolher da galeria');

      expect(db.select().from(attachments).all()).toHaveLength(1);
      expect(screen.queryByText('Não foi possível salvar. Tente novamente.')).toBeNull();
    });

    it('refuses a fourth photo through the screen own write path with a specific message and deletes its file', async () => {
      const bare = record(newPet(db).id);
      newAttachment(db, bare.id);
      newAttachment(db, bare.id);
      const late = prepared();
      // Another change fills the record while the photo is being processed.
      jest.mocked(preparePhoto).mockImplementation(async () => {
        newAttachment(db, bare.id);
        return late;
      });
      await renderDetail(bare.id);

      await addPhoto('Escolher da galeria');

      expect(screen.getByText('Este registro já tem 3 fotos.')).toBeOnTheScreen();
      expect(db.select().from(attachments).all()).toHaveLength(3);
      expect(deleteFiles).toHaveBeenCalledWith([late.file]);
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

  describe('Lembretes', () => {
    // Pinned clock: every date below derives from this day, at 08:00 local (before the 09:00 reminder time).
    const setClock = (hour: number) =>
      jest.useFakeTimers({
        now: new Date(2026, 10, 12, hour),
        doNotFake: ['hrtime', 'nextTick', 'performance', 'queueMicrotask', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback', 'cancelIdleCallback', 'setImmediate', 'clearImmediate', 'setInterval', 'clearInterval', 'setTimeout', 'clearTimeout'],
      });
    beforeEach(() => setClock(8));

    const inDays = (days: number) => addDays(todayLocal(), days);
    const withDose = (days: number, extra: Partial<Parameters<typeof createVaccination>[1]> = {}) => {
      const pet = newPet(db, { name: 'Thor' });
      const created = createVaccination(db, {
        petId: pet.id,
        vaccineName: 'Antirrábica',
        appliedOn: addDays(todayLocal(), -300),
        nextDueOn: inDays(days),
        batch: 'L123',
        brand: 'Vanguard',
        vetName: 'Dra. Ana',
        vetLicense: 'SP-1234',
        clinic: 'PetCare',
        notes: 'Sem reação',
        ...extra,
      });
      return { pet, created };
    };
    const reminderSwitch = () => screen.getByRole('switch', { name: 'Lembretes desta vacina' });

    it('lists the reminder dates and shows the switch on', async () => {
      const { created } = withDose(20);

      await renderDetail(created.id);

      expect(screen.getByText('Lembretes')).toBeOnTheScreen();
      expect(screen.getByText('7 dias antes')).toBeOnTheScreen();
      expect(screen.getByText(formatBrDate(inDays(13)))).toBeOnTheScreen();
      expect(screen.getByText('No dia')).toBeOnTheScreen();
      expect(reminderSwitch()).toBeChecked();
    });

    it('follows the configured offsets, with the singular for 1 day', async () => {
      setSetting(db, 'reminder_offsets_days', [0, 14, 1]);
      const { created } = withDose(20);

      await renderDetail(created.id);

      expect(screen.getByText('14 dias antes')).toBeOnTheScreen();
      expect(screen.getByText('1 dia antes')).toBeOnTheScreen();
      expect(screen.getByText('No dia')).toBeOnTheScreen();
    });

    it('leaves out the dates that already passed', async () => {
      const soon = withDose(3);
      await renderDetail(soon.created.id);
      expect(screen.queryByText('7 dias antes')).toBeNull();
      expect(screen.getByText('No dia')).toBeOnTheScreen();
    });

    it('says all dates passed when the dose is already overdue', async () => {
      const { created } = withDose(-2);

      await renderDetail(created.id);

      expect(screen.getByText('Todas as datas de lembrete já passaram.')).toBeOnTheScreen();
      expect(reminderSwitch()).toBeChecked();
    });

    it('turns the reminders off with a guarded write that resends every field', async () => {
      const { created } = withDose(20);
      await renderDetail(created.id);

      await fireEvent.press(reminderSwitch());

      expect(stored()).toEqual([{ ...created, remindersEnabled: false, updatedAt: expect.any(String) }]);
      expect(reminderSwitch()).not.toBeChecked();
      expect(screen.getByText('Lembretes desligados para esta vacina.')).toBeOnTheScreen();
      expect(screen.queryByText('7 dias antes')).toBeNull();
      expect(screen.getByText('Lembretes')).toBeOnTheScreen();
    });

    it('turns them back on', async () => {
      const { created } = withDose(20, { remindersEnabled: false });
      await renderDetail(created.id);
      expect(reminderSwitch()).not.toBeChecked();

      await fireEvent.press(reminderSwitch());

      expect(stored()[0].remindersEnabled).toBe(true);
      expect(screen.getByText('7 dias antes')).toBeOnTheScreen();
    });

    it('shows a message and keeps the switch when the write fails, then works on retry', async () => {
      const { created } = withDose(20);
      await renderDetail(created.id);
      const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
        throw new Error('disk full');
      });

      await fireEvent.press(reminderSwitch());

      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
      expect(reminderSwitch()).toBeChecked();
      expect(stored()[0].remindersEnabled).toBe(true);

      failing.mockRestore();
      await fireEvent.press(reminderSwitch());
      expect(stored()[0].remindersEnabled).toBe(false);
    });

    it('warns that reminders are turned off in the system when the permission was denied', async () => {
      jest.mocked(getNotificationPermission).mockResolvedValue('denied');
      const { created } = withDose(20);

      await renderDetail(created.id);

      expect(await screen.findByText(/Os lembretes estão desligados no sistema/)).toBeOnTheScreen();
    });

    it.each(['granted', 'undetermined'] as const)('shows no warning when the permission is %s', async (permission) => {
      jest.mocked(getNotificationPermission).mockResolvedValue(permission);
      const { created } = withDose(20);

      await renderDetail(created.id);
      await waitFor(() => expect(getNotificationPermission).toHaveBeenCalled());
      await act(async () => {});

      expect(screen.getByRole('switch', { name: 'Lembretes desta vacina' })).toBeOnTheScreen();
      expect(screen.queryByText(/desligados no sistema/)).toBeNull();
    });

    it('lists the same-day reminder at 08:00 on the due date, before 09:00', async () => {
      const { created } = withDose(0);

      await renderDetail(created.id);

      expect(screen.getByText('No dia')).toBeOnTheScreen();
    });

    it('does not list the same-day reminder at 10:00 on the due date', async () => {
      setClock(10);
      const { created } = withDose(0);

      await renderDetail(created.id);

      expect(screen.queryByText('No dia')).toBeNull();
      expect(screen.getByText('Todas as datas de lembrete já passaram.')).toBeOnTheScreen();
    });

    it('sends one update when the switch is pressed twice before the screen updates', async () => {
      const { created } = withDose(20);
      await renderDetail(created.id);
      const transaction = jest.spyOn(db, 'transaction');
      const toggle = reminderSwitch();

      // Both taps reach the handler of the same render, before the screen can show the first result.
      await act(async () => {
        toggle.props.onClick({});
        toggle.props.onClick({});
      });

      expect(transaction).toHaveBeenCalledTimes(1);
      expect(stored()[0].remindersEnabled).toBe(false);
    });

    it('explains, with no switch, that a previous application has no reminders', async () => {
      const pet = newPet(db);
      const old = createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2024-01-01', nextDueOn: inDays(20) });
      createVaccination(db, { petId: pet.id, vaccineName: 'Antirrábica', appliedOn: '2025-01-01', nextDueOn: inDays(40) });

      await renderDetail(old.id);

      expect(screen.getByText('Só a aplicação mais recente de cada vacina tem lembretes.')).toBeOnTheScreen();
      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('explains, with no switch, that a record without a next dose has no reminders', async () => {
      const pet = newPet(db);
      const bare = createVaccination(db, { petId: pet.id, vaccineName: 'Leptospirose', appliedOn: '2026-03-01' });

      await renderDetail(bare.id);

      expect(screen.getByText('Sem próxima dose, não há lembretes.')).toBeOnTheScreen();
      expect(screen.queryByRole('switch')).toBeNull();
    });

    it('explains, with no switch, that a closed wallet has no reminders', async () => {
      jest.mocked(getNotificationPermission).mockResolvedValue('denied');
      const { pet, created } = withDose(20);
      archivePet(db, pet.id, 'other', null);

      await renderDetail(created.id);
      await waitFor(() => expect(getNotificationPermission).toHaveBeenCalled());
      await act(async () => {});

      expect(screen.getByText('A carteira está encerrada, então não há lembretes.')).toBeOnTheScreen();
      expect(screen.queryByRole('switch')).toBeNull();
      expect(screen.queryByText(/desligados no sistema/)).toBeNull();
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
