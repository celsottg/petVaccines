import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import WalletScreen from '@/app/pets/[petId]/index';
import NewVaccinationScreen from '@/app/vaccinations/new';
import { archivePet } from '@/data/pets';
import { newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';
import { addDays, todayLocal } from '@/domain/dates';
import { formatBrDate } from '@/domain/dateInput';
import { deleteFiles } from '@/services/files';
import { preparePhoto } from '@/services/photos';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('@/services/files', () => ({
  photoUri: (file: string) => `file:///docs/photos/${file}`,
  petPhotoUri: (file: string) => `file:///docs/pets/${file}`,
  deleteFiles: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/photos', () => ({ preparePhoto: jest.fn() }));

let photoSeq = 0;
const prepared = () => {
  photoSeq += 1;
  const id = `00000000-0000-4000-8000-${String(photoSeq).padStart(12, '0')}`;
  return { id, file: `${id}.jpg`, sizeBytes: 5000 + photoSeq, width: 1600, height: 1200 };
};

const routes = {
  'pets/[petId]/index': WalletScreen,
  'vaccinations/new': NewVaccinationScreen,
  index: () => null,
};
const renderForm = (params: Record<string, string>) =>
  renderRouter(routes, { initialUrl: `/vaccinations/new?${new URLSearchParams(params)}` });
const stored = () => db.select().from(vaccinations).all();
const attachmentRows = () => db.select().from(attachments).all();
const applied = () => screen.getByLabelText('Data de aplicação');
const nextDue = () => screen.getByLabelText('Próxima dose');
const save = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

describe('Nova vacina screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
  });

  afterEach(() => jest.restoreAllMocks());

  it('starts with today as the application date and no next dose', async () => {
    const pet = newPet(db);

    await renderForm({ petId: pet.id });

    expect(applied().props.value).toBe(formatBrDate(todayLocal()));
    expect(nextDue().props.value).toBe('');
    expect(screen.getByText(/Vale sempre a orientação do veterinário/)).toBeOnTheScreen();
  });

  it('saves a free-text vaccine with only the required fields and goes to the wallet', async () => {
    const pet = newPet(db, { name: 'Thor' });
    await renderForm({ petId: pet.id });

    await fireEvent.changeText(screen.getByLabelText('Vacina'), '  Leptospirose ');
    await fireEvent.changeText(applied(), '12112026');
    await save();

    expect(stored()).toEqual([
      expect.objectContaining({
        petId: pet.id,
        catalogId: null,
        vaccineName: 'Leptospirose',
        appliedOn: '2026-11-12',
        nextDueOn: null,
        batch: null,
        brand: null,
        vetName: null,
        vetLicense: null,
        clinic: null,
        notes: null,
        remindersEnabled: true,
      }),
    ]);
    expect(screen).toHavePathname(`/pets/${pet.id}`);
    expect(screen.getByText('Leptospirose')).toBeOnTheScreen();
  });

  it('saves every optional detail, trimmed', async () => {
    const pet = newPet(db);
    await renderForm({ petId: pet.id });

    await fireEvent.changeText(screen.getByLabelText('Vacina'), 'Leptospirose');
    await fireEvent.changeText(applied(), '01032026');
    await fireEvent.changeText(nextDue(), '01032027');
    await fireEvent.changeText(screen.getByLabelText('Lote'), ' L123 ');
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Vanguard');
    await fireEvent.changeText(screen.getByLabelText('Veterinário'), 'Dra. Ana');
    await fireEvent.changeText(screen.getByLabelText('CRMV'), 'SP-1234');
    await fireEvent.changeText(screen.getByLabelText('Clínica'), 'PetCare');
    await fireEvent.changeText(screen.getByLabelText('Observações'), 'Leve febre à noite');
    await save();

    expect(stored()[0]).toMatchObject({
      appliedOn: '2026-03-01',
      nextDueOn: '2027-03-01',
      batch: 'L123',
      brand: 'Vanguard',
      vetName: 'Dra. Ana',
      vetLicense: 'SP-1234',
      clinic: 'PetCare',
      notes: 'Leve febre à noite',
    });
  });

  describe('catalog', () => {
    it('lists the catalog of the pet species as suggestions and filters them as the user types', async () => {
      const cat = newPet(db, { species: 'cat' });
      await renderForm({ petId: cat.id });

      expect(screen.getByRole('button', { name: 'Polivalente (V3/V4/V5)' })).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Antirrábica' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Giárdia' })).toBeNull();

      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'poli');

      expect(screen.getByRole('button', { name: 'Polivalente (V3/V4/V5)' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Antirrábica' })).toBeNull();
    });

    it('fills the next dose with the catalog suggestion when "Antirrábica" is chosen', async () => {
      const pet = newPet(db, { species: 'dog' });
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(applied(), '12112026');

      await fireEvent.press(screen.getByRole('button', { name: 'Antirrábica' }));

      expect(screen.getByLabelText('Vacina').props.value).toBe('Antirrábica');
      expect(nextDue().props.value).toBe('12/11/2027');
      await save();
      expect(stored()[0]).toMatchObject({
        catalogId: 'br-dog-rabies',
        vaccineName: 'Antirrábica',
        appliedOn: '2026-11-12',
        nextDueOn: '2027-11-12',
      });
    });

    it('follows the application date while the user has not typed the next dose', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.press(screen.getByRole('button', { name: 'Antirrábica' }));

      await fireEvent.changeText(applied(), '01032026');

      expect(nextDue().props.value).toBe('01/03/2027');
    });

    it('lets the user change the suggested next dose', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(applied(), '12112026');
      await fireEvent.press(screen.getByRole('button', { name: 'Antirrábica' }));

      await fireEvent.changeText(nextDue(), '01062027');
      await save();

      expect(stored()[0].nextDueOn).toBe('2027-06-01');
    });

    it('never overwrites a next dose the user typed', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(applied(), '12112026');
      await fireEvent.changeText(nextDue(), '01062027');

      await fireEvent.press(screen.getByRole('button', { name: 'Antirrábica' }));
      await fireEvent.changeText(applied(), '13112026');

      expect(nextDue().props.value).toBe('01/06/2027');
    });

    it('fills the suggestion again when the user emptied the next dose and then picks a vaccine', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(applied(), '12112026');
      await fireEvent.changeText(nextDue(), '01062027');
      await fireEvent.changeText(nextDue(), '');
      expect(nextDue().props.value).toBe('');

      await fireEvent.press(screen.getByRole('button', { name: 'Antirrábica' }));

      expect(nextDue().props.value).toBe('12/11/2027');
    });

    it('stores a typed catalog name as that catalog item and suggests the next dose', async () => {
      const dog = newPet(db, { species: 'dog' });
      await renderForm({ petId: dog.id });
      await fireEvent.changeText(applied(), '12112026');

      await fireEvent.changeText(screen.getByLabelText('Vacina'), ' antirrabica ');
      expect(nextDue().props.value).toBe('12/11/2027');
      await save();

      expect(stored()[0]).toMatchObject({
        catalogId: 'br-dog-rabies',
        vaccineName: 'Antirrábica',
        nextDueOn: '2027-11-12',
      });
    });

    it('uses the catalog of the pet species when resolving a typed name', async () => {
      const cat = newPet(db, { species: 'cat' });
      await renderForm({ petId: cat.id });

      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'antirrabica');
      await save();

      expect(stored()[0].catalogId).toBe('br-cat-rabies');
    });

    it('stores a name outside the catalog with no catalog id and no suggested date', async () => {
      const dog = newPet(db, { species: 'dog' });
      await renderForm({ petId: dog.id });

      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'Leptospirose');
      expect(nextDue().props.value).toBe('');
      await save();

      expect(stored()[0]).toMatchObject({ catalogId: null, vaccineName: 'Leptospirose', nextDueOn: null });
    });
  });

  describe('booster', () => {
    it('starts with the vaccine of the previous record, today and the suggested next dose', async () => {
      const pet = newPet(db, { species: 'dog' });
      const old = createVaccination(db, {
        petId: pet.id,
        catalogId: 'br-dog-rabies',
        vaccineName: 'Antirrábica',
        appliedOn: '2025-11-12',
        nextDueOn: '2026-11-12',
        batch: 'L1',
        vetName: 'Dra. Ana',
      });

      await renderForm({ petId: pet.id, fromVaccinationId: old.id });

      expect(screen.getByLabelText('Vacina').props.value).toBe('Antirrábica');
      expect(applied().props.value).toBe(formatBrDate(todayLocal()));
      expect(nextDue().props.value).toBe(formatBrDate(addDays(todayLocal(), 365)));
      expect(screen.getByLabelText('Lote').props.value).toBe('');
      expect(screen.getByLabelText('Veterinário').props.value).toBe('');
    });

    it('moves an old free-name record to the previous applications once the booster is registered from the catalog', async () => {
      const pet = newPet(db, { species: 'dog' });
      const old = createVaccination(db, {
        petId: pet.id,
        catalogId: null,
        vaccineName: 'Antirrábica',
        appliedOn: '2025-01-10',
        nextDueOn: '2026-01-10',
      });
      await renderForm({ petId: pet.id, fromVaccinationId: old.id });

      await save();

      expect(stored()).toHaveLength(2);
      expect(stored().find((v) => v.id !== old.id)).toMatchObject({ catalogId: 'br-dog-rabies' });
      expect(screen).toHavePathname(`/pets/${pet.id}`);
      expect(screen.getByText('Aplicações anteriores')).toBeOnTheScreen();
      expect(screen.getAllByText('Antirrábica')).toHaveLength(2);
      expect(screen.getAllByText(/^(Vence em \d+|Em dia)/)).toHaveLength(1);
    });
  });

  describe('validation', () => {
    it('requires a vaccine name', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });

      await save();

      expect(screen.getByText('Informe o nome da vacina.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });

    it('requires the application date', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(applied(), '');

      await save();

      expect(screen.getByText('Informe a data de aplicação.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });

    it.each(['31/02/2026', '12/11'])('rejects the invalid application date %s', async (text) => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(applied(), text);

      await save();

      expect(screen.getByText('Data inválida. Use o formato DD/MM/AAAA.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });

    it('rejects an application date in the future', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(applied(), formatBrDate(addDays(todayLocal(), 1)));

      await save();

      expect(screen.getByText('A data não pode ser futura.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });

    it('rejects an application date before the pet was born', async () => {
      const pet = newPet(db, { birthOn: '2023-08-10' });
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(applied(), '09082023');

      await save();

      expect(screen.getByText('A vacina não pode ser anterior ao nascimento do pet.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });

    it('accepts any application date when the birth date is unknown', async () => {
      const pet = newPet(db, { birthOn: null });
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(applied(), '01011990');

      await save();

      expect(stored()).toHaveLength(1);
    });

    it.each(['01/03/2026', '28/02/2026'])('rejects a next dose that is not after the application (%s)', async (text) => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(applied(), '01032026');
      await fireEvent.changeText(nextDue(), text);

      await save();

      expect(screen.getByText('A próxima dose deve ser depois da data de aplicação.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });

    it('rejects an invalid next dose', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      await fireEvent.changeText(nextDue(), '31/02/2027');

      await save();

      expect(screen.getByText('Data inválida. Use o formato DD/MM/AAAA.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
    });
  });

  describe('saving', () => {
    it('creates one record when "Salvar" is pressed twice before navigation finishes', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');

      await save();
      await save();

      expect(stored()).toHaveLength(1);
    });

    it('shows a message and does not navigate when the write fails, then saves on retry', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      const dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'V10');
      const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
        throw new Error('disk full');
      });

      await save();

      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
      expect(dismissTo).not.toHaveBeenCalled();
      expect(stored()).toEqual([]);

      failing.mockRestore();
      await save();
      expect(stored()).toHaveLength(1);
      expect(dismissTo).toHaveBeenCalledTimes(1);
    });
  });

  describe('unavailable', () => {
    it('shows a way back when the pet does not exist', async () => {
      await renderForm({ petId: 'missing' });

      expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
    });

    it('does not let a record be added to a pet with the wallet closed', async () => {
      const pet = newPet(db);
      archivePet(db, pet.id, 'other', null);

      await renderForm({ petId: pet.id });

      expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    });
  });
  describe('proof photos', () => {
    const addPhoto = async (source: 'Tirar foto' | 'Escolher da galeria' = 'Escolher da galeria') => {
      await fireEvent.press(screen.getByRole('button', { name: 'Adicionar foto' }));
      await fireEvent.press(screen.getByRole('button', { name: source }));
    };
    const fillRequired = async () => {
      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'Leptospirose');
      await fireEvent.changeText(applied(), '12112026');
    };

    it('shows the capture hint and the add button, with no photo yet', async () => {
      const pet = newPet(db);

      await renderForm({ petId: pet.id });

      expect(screen.getByText('Comprovante (até 3 fotos)')).toBeOnTheScreen();
      expect(screen.getByText('Enquadre o carimbo, a data, o lote e a marca. Pode adicionar depois.')).toBeOnTheScreen();
      expect(screen.getByRole('button', { name: 'Adicionar foto' })).toBeOnTheScreen();
    });

    it('does not write anything until the record is saved, then links every photo to the new record', async () => {
      const first = prepared();
      const second = prepared();
      jest.mocked(preparePhoto).mockResolvedValueOnce(first).mockResolvedValueOnce(second);
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fillRequired();

      await addPhoto('Tirar foto');
      await addPhoto('Escolher da galeria');

      expect(preparePhoto).toHaveBeenNthCalledWith(1, 'camera', expect.any(Object));
      expect(preparePhoto).toHaveBeenNthCalledWith(2, 'library', expect.any(Object));
      expect(screen.getByRole('button', { name: /^Foto 1 de 2, ainda não salva/ })).toBeOnTheScreen();
      expect(attachmentRows()).toEqual([]);

      await save();

      const [record] = stored();
      expect(attachmentRows()).toEqual([
        expect.objectContaining({ ...first, vaccinationId: record.id }),
        expect.objectContaining({ ...second, vaccinationId: record.id }),
      ]);
      expect(deleteFiles).not.toHaveBeenCalled();
      expect(screen).toHavePathname(`/pets/${pet.id}`);
    });

    it('saves a record without photos as before', async () => {
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fillRequired();

      await save();

      expect(stored()).toHaveLength(1);
      expect(attachmentRows()).toEqual([]);
    });

    it('stops offering photos at 3', async () => {
      jest.mocked(preparePhoto).mockImplementation(async () => prepared());
      const pet = newPet(db);
      await renderForm({ petId: pet.id });

      await addPhoto();
      await addPhoto();
      await addPhoto();

      expect(screen.getAllByRole('button', { name: /ainda não salva/ })).toHaveLength(3);
      expect(screen.queryByRole('button', { name: 'Adicionar foto' })).toBeNull();
    });

    it('asks before removing a pending photo and deletes its file', async () => {
      const photo = prepared();
      jest.mocked(preparePhoto).mockResolvedValue(photo);
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await addPhoto();

      await fireEvent.press(screen.getByRole('button', { name: /^Foto 1 de 1, ainda não salva/ }));
      expect(screen.getByText('Remover foto?')).toBeOnTheScreen();
      await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));
      expect(deleteFiles).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /ainda não salva/ })).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name: /^Foto 1 de 1, ainda não salva/ }));
      await fireEvent.press(screen.getByRole('button', { name: 'Remover' }));

      expect(deleteFiles).toHaveBeenCalledWith([photo.file]);
      expect(screen.queryByRole('button', { name: /ainda não salva/ })).toBeNull();
      expect(screen.getByRole('button', { name: 'Adicionar foto' })).toBeOnTheScreen();
    });

    it('deletes the pending files when the user leaves without saving', async () => {
      const photo = prepared();
      jest.mocked(preparePhoto).mockResolvedValue(photo);
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await addPhoto();

      await screen.unmount();

      expect(deleteFiles).toHaveBeenCalledWith([photo.file]);
      expect(attachmentRows()).toEqual([]);
    });

    it('keeps the pending photos and creates no record when the save fails, so a retry saves everything once', async () => {
      jest.mocked(preparePhoto).mockResolvedValue(prepared());
      const pet = newPet(db);
      await renderForm({ petId: pet.id });
      await fillRequired();
      await addPhoto();
      jest.spyOn(db, 'transaction').mockImplementationOnce(() => {
        throw new Error('disk full');
      });

      await save();

      expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
      expect(stored()).toEqual([]);
      expect(deleteFiles).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /ainda não salva/ })).toBeOnTheScreen();

      await save();

      expect(stored()).toHaveLength(1);
      expect(attachmentRows()).toHaveLength(1);
    });

    it('explains a refused camera permission and stores nothing', async () => {
      jest.mocked(preparePhoto).mockImplementation(async (_source, options) => {
        options?.onPermissionDenied?.();
        return null;
      });
      const pet = newPet(db);
      await renderForm({ petId: pet.id });

      await addPhoto('Tirar foto');

      expect(screen.getByText(/Sem acesso à câmera/)).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: /ainda não salva/ })).toBeNull();
    });
  });

});
