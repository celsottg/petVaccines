import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';

import EditVaccinationScreen from '@/app/vaccinations/[id]/edit';
import VaccinationDetailScreen from '@/app/vaccinations/[id]/index';
import { archivePet } from '@/data/pets';
import { newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings, vaccinations } from '@/db/schema';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const routes = {
  index: () => null,
  'vaccinations/[id]/index': VaccinationDetailScreen,
  'vaccinations/[id]/edit': EditVaccinationScreen,
};
const renderEdit = (id: string) => renderRouter(routes, { initialUrl: `/vaccinations/${id}/edit` });
const stored = () => db.select().from(vaccinations).all();
const save = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

describe('Editar vacina screen', () => {
  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('loads the record into the form', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, {
      petId: pet.id,
      vaccineName: 'Leptospirose',
      appliedOn: '2026-03-01',
      nextDueOn: '2027-03-01',
      batch: 'L123',
      brand: 'Vanguard',
      vetName: 'Dra. Ana',
      vetLicense: 'SP-1234',
      clinic: 'PetCare',
      notes: 'Sem reação',
    });

    await renderEdit(record.id);

    expect(screen.getByLabelText('Vacina').props.value).toBe('Leptospirose');
    expect(screen.getByLabelText('Data de aplicação').props.value).toBe('01/03/2026');
    expect(screen.getByLabelText('Próxima dose').props.value).toBe('01/03/2027');
    expect(screen.getByLabelText('Lote').props.value).toBe('L123');
    expect(screen.getByLabelText('Marca').props.value).toBe('Vanguard');
    expect(screen.getByLabelText('Veterinário').props.value).toBe('Dra. Ana');
    expect(screen.getByLabelText('CRMV').props.value).toBe('SP-1234');
    expect(screen.getByLabelText('Clínica').props.value).toBe('PetCare');
    expect(screen.getByLabelText('Observações').props.value).toBe('Sem reação');
  });

  it('saves the changes and returns to the record', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'Leptospirose', appliedOn: '2026-03-01', batch: 'L123' });
    await renderEdit(record.id);

    await fireEvent.changeText(screen.getByLabelText('Lote'), '');
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Vanguard');
    await save();

    expect(stored()).toEqual([expect.objectContaining({ id: record.id, batch: null, brand: 'Vanguard' })]);
    expect(screen).toHavePathname(`/vaccinations/${record.id}`);
  });

  it('keeps the reminders switch, since updateVaccination replaces every field', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, {
      petId: pet.id,
      vaccineName: 'Leptospirose',
      appliedOn: '2026-03-01',
      remindersEnabled: false,
    });
    await renderEdit(record.id);

    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Vanguard');
    await save();

    expect(stored()[0]).toMatchObject({ brand: 'Vanguard', remindersEnabled: false });
  });

  it('does not invent a next dose for a catalog record that has none', async () => {
    const pet = newPet(db, { species: 'dog' });
    const record = createVaccination(db, {
      petId: pet.id,
      catalogId: 'br-dog-rabies',
      vaccineName: 'Antirrábica',
      appliedOn: '2026-03-01',
    });
    await renderEdit(record.id);

    expect(screen.getByLabelText('Próxima dose').props.value).toBe('');
    await save();

    expect(stored()[0]).toMatchObject({ id: record.id, nextDueOn: null });
  });

  it('links a free-text record to the catalog when its name is corrected to a catalog name', async () => {
    const pet = newPet(db, { species: 'dog' });
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'Antirabica x', appliedOn: '2026-03-01' });
    await renderEdit(record.id);

    await fireEvent.changeText(screen.getByLabelText('Vacina'), 'antirrabica');
    await save();

    expect(stored()[0]).toMatchObject({ catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica' });
  });

  it('does not save an invalid change', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'Leptospirose', appliedOn: '2026-03-01' });
    await renderEdit(record.id);

    await fireEvent.changeText(screen.getByLabelText('Vacina'), '');
    await save();

    expect(screen.getByText('Informe o nome da vacina.')).toBeOnTheScreen();
    expect(stored()[0].vaccineName).toBe('Leptospirose');
  });

  it('shows a way back when the record does not exist', async () => {
    await renderEdit('missing');

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
  });

  it('does not edit a record of a pet with the wallet closed', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-03-01' });
    archivePet(db, pet.id, 'other', null);

    await renderEdit(record.id);

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Salvar' })).toBeNull();
  });

  describe('a record whose stored name differs from the catalog name', () => {
    const renamed = (petId: string) =>
      createVaccination(db, { petId, catalogId: 'br-dog-rabies', vaccineName: 'Raiva', appliedOn: '2026-03-01' });

    it('keeps the stored catalog id and name when only another field changes', async () => {
      const record = renamed(newPet(db, { species: 'dog' }).id);
      await renderEdit(record.id);

      await fireEvent.changeText(screen.getByLabelText('Lote'), 'L9');
      await save();

      expect(stored()[0]).toMatchObject({ catalogId: 'br-dog-rabies', vaccineName: 'Raiva', batch: 'L9' });
    });

    it('lets the catalog lookup decide once the name is changed', async () => {
      const record = renamed(newPet(db, { species: 'dog' }).id);
      await renderEdit(record.id);

      await fireEvent.changeText(screen.getByLabelText('Vacina'), 'Leptospirose');
      await save();

      expect(stored()[0]).toMatchObject({ catalogId: null, vaccineName: 'Leptospirose' });
    });
  });

  it('stores the catalog id and spelling when a free-name record is renamed to a catalog name', async () => {
    const pet = newPet(db, { species: 'dog' });
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'Raiva', appliedOn: '2026-03-01' });
    await renderEdit(record.id);

    await fireEvent.changeText(screen.getByLabelText('Vacina'), ' antirrabica ');
    await save();

    expect(stored()[0]).toMatchObject({ catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica' });
  });

  it('updates once when "Salvar" is pressed twice before navigation finishes', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-03-01' });
    await renderEdit(record.id);
    const dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
    const update = jest.spyOn(db, 'transaction');
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Vanguard');

    await save();
    await save();

    expect(update).toHaveBeenCalledTimes(1);
    expect(dismissTo).toHaveBeenCalledTimes(1);
    expect(stored()[0].brand).toBe('Vanguard');
    jest.restoreAllMocks();
  });

  it('shows a message and does not navigate when the update fails, then saves on retry', async () => {
    const pet = newPet(db);
    const record = createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-03-01' });
    await renderEdit(record.id);
    const dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
    await fireEvent.changeText(screen.getByLabelText('Marca'), 'Vanguard');
    const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await save();

    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    expect(dismissTo).not.toHaveBeenCalled();
    expect(stored()[0].brand).toBeNull();

    failing.mockRestore();
    await save();
    expect(stored()[0].brand).toBe('Vanguard');
    expect(dismissTo).toHaveBeenCalledTimes(1);
    jest.restoreAllMocks();
  });
});
