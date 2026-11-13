import { act, fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { View } from 'react-native';

import HomeScreen from '@/app/index';
import WalletScreen from '@/app/pets/[petId]/index';
import NewPetScreen from '@/app/pets/new';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';
import { addDays, todayLocal } from '@/domain/dates';
import { formatBrDate } from '@/domain/dateInput';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));

const routes = { index: HomeScreen, 'pets/new': NewPetScreen, 'pets/[petId]/index': WalletScreen, archived: () => <View /> };
const renderForm = () => renderRouter(routes, { initialUrl: '/pets/new' });
const allPets = () => db.select().from(pets).all();

describe('Novo pet screen', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('saves a pet with only a name and the default species, then opens its wallet', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByLabelText('Nome'), '  Thor ');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()).toEqual([
      expect.objectContaining({
        name: 'Thor',
        species: 'dog',
        breed: null,
        sex: null,
        birthOn: null,
        photoFile: null,
        status: 'active',
      }),
    ]);
    expect(screen).toHavePathname(`/pets/${allPets()[0].id}`);
    expect(screen.getByText('Nenhuma vacina registrada')).toBeOnTheScreen();
  });

  it('keeps Meus pets as the screen behind the new wallet', async () => {
    await renderRouter(routes);
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar pet' }));
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    await act(() => router.back());

    expect(screen).toHavePathname('/');
  });

  it('saves every field', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Mia');
    await fireEvent.press(screen.getByRole('radio', { name: 'Gato' }));
    await fireEvent.changeText(screen.getByLabelText('Raça (opcional)'), 'Siamês');
    await fireEvent.press(screen.getByRole('radio', { name: 'Fêmea' }));
    await fireEvent.changeText(screen.getByLabelText('Data de nascimento (opcional)'), '10082023');
    expect(screen.getByLabelText('Data de nascimento (opcional)').props.value).toBe('10/08/2023');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()[0]).toMatchObject({
      name: 'Mia',
      species: 'cat',
      breed: 'Siamês',
      sex: 'female',
      birthOn: '2023-08-10',
    });
  });

  it('lets the sex be cleared by pressing the selected option again', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');
    await fireEvent.press(screen.getByRole('radio', { name: 'Macho' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Macho' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()[0].sex).toBeNull();
  });

  it('requires a name and keeps the user on the form', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByLabelText('Nome'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Informe o nome do pet.')).toBeOnTheScreen();
    expect(allPets()).toEqual([]);
    expect(screen).toHavePathname('/pets/new');
  });

  it.each(['31/02/2024', '10/08'])('rejects the invalid birth date %s', async (text) => {
    await renderForm();

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');
    await fireEvent.changeText(screen.getByLabelText('Data de nascimento (opcional)'), text);
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Data inválida. Use o formato DD/MM/AAAA.')).toBeOnTheScreen();
    expect(allPets()).toEqual([]);
  });

  it('rejects a birth date in the future and accepts today', async () => {
    await renderForm();

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');
    await fireEvent.changeText(
      screen.getByLabelText('Data de nascimento (opcional)'),
      formatBrDate(addDays(todayLocal(), 1)),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByText('A data não pode ser futura.')).toBeOnTheScreen();
    expect(allPets()).toEqual([]);

    await fireEvent.changeText(screen.getByLabelText('Data de nascimento (opcional)'), formatBrDate(todayLocal()));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(allPets()[0].birthOn).toBe(todayLocal());
  });

  it('does not offer archive or delete on a new pet', async () => {
    await renderForm();

    expect(screen.queryByRole('button', { name: 'Dar baixa' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Excluir pet' })).toBeNull();
  });

  it('creates one pet when "Salvar" is pressed twice before navigation finishes', async () => {
    await renderForm();
    // Spy after rendering: the router installs its imperative API on render.
    jest.spyOn(router, 'replace').mockImplementation(() => {});

    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(allPets()).toHaveLength(1);
  });

  it('shows a message and does not navigate when the write fails, then saves on retry', async () => {
    await renderForm();
    const replace = jest.spyOn(router, 'replace').mockImplementation(() => {});
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');
    const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    expect(replace).not.toHaveBeenCalled();
    expect(allPets()).toEqual([]);

    failing.mockRestore();
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));
    expect(allPets()).toHaveLength(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('does not report a save failure or allow a duplicate when navigation throws after the write', async () => {
    await renderForm();
    jest.spyOn(router, 'replace').mockImplementation(() => {
      throw new Error('navigation failed');
    });
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Thor');

    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' })).catch(() => {});
    await fireEvent.press(screen.getByRole('button', { name: 'Salvar' })).catch(() => {});

    expect(allPets()).toHaveLength(1);
    expect(screen.queryByText('Não foi possível salvar. Tente novamente.')).toBeNull();
  });
});
