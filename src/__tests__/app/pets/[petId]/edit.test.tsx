import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import HomeScreen from '@/app/index';
import EditPetScreen from '@/app/pets/[petId]/edit';
import { createPet } from '@/data/pets';
import { newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings, vaccinations } from '@/db/schema';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const routes = {
  index: HomeScreen,
  'pets/[petId]/edit': EditPetScreen,
  'pets/[petId]/archive': () => <View testID="archive" />,
  archived: () => <View />,
};
const renderEdit = (petId: string) => renderRouter(routes, { initialUrl: `/pets/${petId}/edit` });
const allPets = () => db.select().from(pets).all();

describe('Editar pet screen', () => {
  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('loads the pet into the form', async () => {
    const pet = createPet(db, { name: 'Mia', species: 'cat', breed: 'Siamês', sex: 'female', birthOn: '2023-08-10' });

    await renderEdit(pet.id);

    expect(screen.getByLabelText('Nome').props.value).toBe('Mia');
    expect(screen.getByRole('radio', { name: 'Gato' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Fêmea' })).toBeSelected();
    expect(screen.getByLabelText('Raça (opcional)').props.value).toBe('Siamês');
    expect(screen.getByLabelText('Data de nascimento (opcional)').props.value).toBe('10/08/2023');
  });

  it('saves the changes and returns to Meus pets', async () => {
    const pet = newPet(db, { name: 'Rex', breed: 'Poodle' });
    await renderEdit(pet.id);

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Max');
    await fireEvent.changeText(screen.getByLabelText('Raça (opcional)'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()).toEqual([expect.objectContaining({ id: pet.id, name: 'Max', breed: null })]);
    expect(screen).toHavePathname('/');
  });

  it('keeps the existing photo reference, since updatePet replaces every field', async () => {
    const pet = createPet(db, { name: 'Rex', species: 'dog', photoFile: 'rex-photo.jpg' });
    await renderEdit(pet.id);

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Max');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()[0]).toMatchObject({ name: 'Max', photoFile: 'rex-photo.jpg' });
  });

  it('does not save an empty name', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);

    await fireEvent.changeText(screen.getByLabelText('Nome'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe o nome do pet.')).toBeOnTheScreen();
    expect(allPets()[0].name).toBe('Rex');
  });

  it('opens the archive screen from "Dar baixa"', async () => {
    const pet = newPet(db);
    await renderEdit(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Dar baixa' }));

    expect(screen).toHavePathname(`/pets/${pet.id}/archive`);
  });

  it('asks for confirmation before deleting, and keeps the pet on cancel', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    expect(screen.getByText('Excluir Rex?')).toBeOnTheScreen();
    expect(allPets()).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Excluir Rex?')).toBeNull();
    expect(allPets()).toHaveLength(1);
  });

  it('deletes the pet and its vaccinations after confirming, then returns to Meus pets', async () => {
    const pet = newPet(db, { name: 'Rex' });
    createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-01-01' });
    await renderEdit(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

    expect(allPets()).toEqual([]);
    expect(db.select().from(vaccinations).all()).toEqual([]);
    expect(screen).toHavePathname('/');
    expect(screen.getByText('Nenhum pet cadastrado')).toBeOnTheScreen();
  });

  it('keeps the pet and shows a message when deleting fails', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderEdit(pet.id);
    const dismissTo = jest.spyOn(router, 'dismissTo');
    const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Excluir pet' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Excluir' }));

    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    expect(dismissTo).not.toHaveBeenCalled();
    failing.mockRestore();
    dismissTo.mockRestore();
    expect(allPets()).toHaveLength(1);
  });
});
