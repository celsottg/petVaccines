import { fireEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import HomeScreen from '@/app/index';
import { archivePet, createPet } from '@/data/pets';
import { newPet } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';
import { addDays, todayLocal } from '@/domain/dates';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const routes = { index: HomeScreen, 'pets/new': () => <View testID="new-pet" />, archived: () => <View testID="archived" /> };

function vaccinate(petId: string, vaccineName: string, nextDueOn: string | null) {
  createVaccination(db, { petId, vaccineName, appliedOn: '2020-01-01', nextDueOn });
}

describe('Meus pets screen', () => {
  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('shows the title and the empty state when there are no pets', async () => {
    await renderRouter(routes);

    expect(screen.getByText('Meus pets')).toBeOnTheScreen();
    expect(screen.getByText('Nenhum pet cadastrado')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar pet' })).toBeOnTheScreen();
  });

  it('lists only active pets', async () => {
    newPet(db, { name: 'Thor' });
    const gone = newPet(db, { name: 'Bolinha' });
    archivePet(db, gone.id, 'deceased', null);

    await renderRouter(routes);

    expect(screen.getByText('Thor')).toBeOnTheScreen();
    expect(screen.queryByText('Bolinha')).toBeNull();
    expect(screen.queryByText('Nenhum pet cadastrado')).toBeNull();
  });

  it('describes the pet with species, breed and age', async () => {
    const birthYear = Number(todayLocal().slice(0, 4)) - 3;
    createPet(db, { name: 'Thor', species: 'dog', breed: 'SRD', birthOn: `${birthYear}-01-01` });
    createPet(db, { name: 'Mia', species: 'cat' });

    await renderRouter(routes);

    expect(screen.getByText('Cão · SRD · 3 anos')).toBeOnTheScreen();
    expect(screen.getByText('Gato')).toBeOnTheScreen();
  });

  it('shows the worst status of the current records as a badge with text', async () => {
    const thor = newPet(db, { name: 'Thor' });
    vaccinate(thor.id, 'V10', addDays(todayLocal(), 10));
    vaccinate(thor.id, 'Antirrábica', addDays(todayLocal(), 400));
    const bolinha = newPet(db, { name: 'Bolinha' });
    vaccinate(bolinha.id, 'V10', '2020-06-01');
    vaccinate(bolinha.id, 'Giárdia', '2020-06-01');
    const mia = newPet(db, { name: 'Mia' });
    vaccinate(mia.id, 'V10', addDays(todayLocal(), 400));
    newPet(db, { name: 'Zeca' });

    await renderRouter(routes);

    expect(screen.getByText('1 vacina vence em breve')).toBeOnTheScreen();
    expect(screen.getByText('2 vacinas vencidas')).toBeOnTheScreen();
    expect(screen.getByText('Vacinas em dia')).toBeOnTheScreen();
    expect(screen.getByText('Sem vacinas registradas')).toBeOnTheScreen();
  });

  it('ignores previous records of the same vaccine when picking the badge', async () => {
    const pet = newPet(db, { name: 'Thor' });
    createVaccination(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2019-01-01', nextDueOn: '2020-01-01' });
    createVaccination(db, { petId: pet.id, vaccineName: 'v10', appliedOn: '2026-01-01', nextDueOn: addDays(todayLocal(), 300) });

    await renderRouter(routes);

    expect(screen.getByText('Vacinas em dia')).toBeOnTheScreen();
  });

  it('shows "Carteiras encerradas (1)" when one pet has been archived', async () => {
    newPet(db, { name: 'Thor' });
    const gone = newPet(db, { name: 'Bolinha' });
    archivePet(db, gone.id, 'other', null);

    await renderRouter(routes);

    expect(screen.getByRole('link', { name: 'Carteiras encerradas (1)' })).toBeOnTheScreen();
  });

  it('hides the archived link when no pet has been archived', async () => {
    newPet(db, { name: 'Thor' });

    await renderRouter(routes);

    expect(screen.queryByText(/Carteiras encerradas/)).toBeNull();
  });

  it('opens the archived list from the link', async () => {
    const gone = newPet(db, { name: 'Bolinha' });
    archivePet(db, gone.id, 'other', null);
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('link', { name: 'Carteiras encerradas (1)' }));
    expect(screen).toHavePathname('/archived');
  });

  it('opens the form from the add button', async () => {
    await renderRouter(routes);

    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar pet' }));

    expect(screen).toHavePathname('/pets/new');
  });

  it('opens the edit screen when a pet card is pressed (the wallet arrives in Task 6)', async () => {
    const pet = newPet(db, { name: 'Thor' });
    await renderRouter({ ...routes, 'pets/[petId]/edit': () => <View /> });

    await fireEvent.press(screen.getByRole('button', { name: /Thor/ }));

    expect(screen).toHavePathname(`/pets/${pet.id}/edit`);
  });
});
