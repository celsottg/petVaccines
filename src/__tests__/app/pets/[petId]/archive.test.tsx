import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import HomeScreen from '@/app/index';
import ArchivePetScreen from '@/app/pets/[petId]/archive';
import { archivePet } from '@/data/pets';
import { newPet } from '@/data/testHelpers';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';
import { formatBrDate } from '@/domain/dateInput';
import { addDays, todayLocal } from '@/domain/dates';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const routes = { index: HomeScreen, 'pets/[petId]/archive': ArchivePetScreen, 'pets/new': () => <View />, archived: () => <View /> };
const renderArchive = (petId: string) => renderRouter(routes, { initialUrl: `/pets/${petId}/archive` });
const onlyPet = () => db.select().from(pets).all()[0];
const dateField = () => screen.getByLabelText('Data (opcional)');

describe('Dar baixa screen', () => {
  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('summarizes what happens', async () => {
    const pet = newPet(db, { name: 'Bolinha', breed: 'Shih-tzu' });

    await renderArchive(pet.id);

    expect(screen.getByText('Bolinha')).toBeOnTheScreen();
    expect(screen.getByText(/A carteira de Bolinha será encerrada, mas nada é apagado/)).toBeOnTheScreen();
    expect(screen.getByText('Lembretes')).toBeOnTheScreen();
    expect(screen.getByText('Cancelados')).toBeOnTheScreen();
    expect(screen.getByText('Vai para "Carteiras encerradas"')).toBeOnTheScreen();
    expect(screen.getByText('Você pode reativar a carteira a qualquer momento.')).toBeOnTheScreen();
  });

  it('starts with no reason selected and an empty date', async () => {
    const pet = newPet(db);

    await renderArchive(pet.id);

    for (const name of ['Faleceu', 'Mudou de tutor', 'Outro']) {
      expect(screen.getByRole('radio', { name })).not.toBeSelected();
    }
    expect(dateField().props.value).toBe('');
  });

  it('does not archive without a reason and shows an error next to the reasons', async () => {
    const pet = newPet(db);
    await renderArchive(pet.id);

    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));

    expect(screen.getByText('Escolha o motivo da baixa.')).toBeOnTheScreen();
    expect(onlyPet().status).toBe('active');
    expect(screen).toHavePathname(`/pets/${pet.id}/archive`);
  });

  it('archives with a reason and no date, then returns to Meus pets', async () => {
    const pet = newPet(db, { name: 'Bolinha' });
    await renderArchive(pet.id);

    await fireEvent.press(screen.getByRole('radio', { name: 'Faleceu' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));

    expect(onlyPet()).toMatchObject({ status: 'archived', archivedReason: 'deceased', archivedOn: null });
    expect(screen).toHavePathname('/');
    expect(screen.queryByText('Bolinha')).toBeNull();
    expect(screen.getByRole('link', { name: 'Carteiras encerradas (1)' })).toBeOnTheScreen();
  });

  it('archives with the chosen reason and date', async () => {
    const pet = newPet(db);
    await renderArchive(pet.id);

    await fireEvent.press(screen.getByRole('radio', { name: 'Mudou de tutor' }));
    await fireEvent.changeText(dateField(), '05112026');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));

    expect(onlyPet()).toMatchObject({ status: 'archived', archivedReason: 'rehomed', archivedOn: '2026-11-05' });
  });

  it('keeps the user on the screen with a message when the write fails, and allows a retry', async () => {
    const pet = newPet(db);
    await renderArchive(pet.id);
    const dismissTo = jest.spyOn(router, 'dismissTo');
    await fireEvent.press(screen.getByRole('radio', { name: 'Outro' }));
    const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));

    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    expect(dismissTo).not.toHaveBeenCalled();
    failing.mockRestore();
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));
    expect(onlyPet().status).toBe('archived');
    dismissTo.mockRestore();
  });

  it('rejects an invalid or future date and keeps the pet active', async () => {
    const pet = newPet(db);
    await renderArchive(pet.id);

    await fireEvent.press(screen.getByRole('radio', { name: 'Faleceu' }));
    await fireEvent.changeText(dateField(), '31/02/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));
    expect(screen.getByText('Data inválida. Use o formato DD/MM/AAAA.')).toBeOnTheScreen();

    await fireEvent.changeText(dateField(), formatBrDate(addDays(todayLocal(), 1)));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));
    expect(screen.getByText('A data não pode ser futura.')).toBeOnTheScreen();

    expect(onlyPet().status).toBe('active');
  });

  it('shows a way back to Meus pets when the pet does not exist', async () => {
    await renderArchive('missing-pet');

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar para Meus pets' }));
    expect(screen).toHavePathname('/');
  });

  it('does not archive a pet whose wallet is already closed', async () => {
    const pet = newPet(db, { name: 'Rex' });
    archivePet(db, pet.id, 'other', null);
    const before = onlyPet();

    await renderArchive(pet.id);

    expect(screen.getByText('Não encontramos este item')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Confirmar baixa' })).toBeNull();
    expect(onlyPet()).toEqual(before);
  });

  it('does not show "not found" after a successful archive while navigation is pending', async () => {
    const pet = newPet(db, { name: 'Rex' });
    await renderArchive(pet.id);
    jest.spyOn(router, 'dismissTo').mockImplementation(() => {});

    await fireEvent.press(screen.getByRole('radio', { name: 'Outro' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Confirmar baixa' }));

    expect(onlyPet().status).toBe('archived');
    expect(screen.queryByText('Não encontramos este item')).toBeNull();
    jest.restoreAllMocks();
  });
});
