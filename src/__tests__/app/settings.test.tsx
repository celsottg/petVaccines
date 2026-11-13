import { fireEvent } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter, screen } from 'expo-router/testing-library';
import { Linking } from 'react-native';

import HomeScreen from '@/app/index';
import SettingsScreen from '@/app/settings';
import { getSettings, setSetting } from '@/data/settings';
import { db } from '@/db/client';
import { pets, settings } from '@/db/schema';

jest.mock('@/db/client', () => ({ db: jest.requireActual('@/data/testLive').createLiveTestDb() }));
jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.2.3' } } }));

const routes = { index: HomeScreen, settings: SettingsScreen, 'pets/new': () => null, archived: () => null };
const renderSettings = () => renderRouter(routes, { initialUrl: '/settings' });
const dueSoon = () => screen.getByLabelText('Prazo de "vence em breve" (dias)');
const offset = (index: number) => screen.getByLabelText(`Antecedência ${index} (dias)`);
const save = () => fireEvent.press(screen.getByRole('button', { name: 'Salvar' }));

describe('Ajustes screen', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    db.delete(pets).run();
    db.delete(settings).run();
  });

  it('is reached from a link on Meus pets', async () => {
    await renderRouter(routes, { initialUrl: '/' });

    await fireEvent.press(screen.getByRole('link', { name: 'Ajustes e sobre' }));

    expect(screen).toHavePathname('/settings');
  });

  it('starts with the defaults: 30 days and reminders 7 days before and on the day', async () => {
    await renderSettings();

    expect(dueSoon().props.value).toBe('30');
    expect(offset(1).props.value).toBe('7');
    expect(offset(2).props.value).toBe('0');
    expect(screen.queryByLabelText('Antecedência 3 (dias)')).toBeNull();
  });

  it('starts with the saved values', async () => {
    db.transaction((tx) => {
      setSetting(tx, 'due_soon_days', 45);
      setSetting(tx, 'reminder_offsets_days', [14, 3, 0]);
    });

    await renderSettings();

    expect(dueSoon().props.value).toBe('45');
    expect([1, 2, 3].map((i) => offset(i).props.value)).toEqual(['14', '3', '0']);
  });

  it('shows the version, the license, the repository link and the declaratory notice', async () => {
    await renderSettings();

    expect(screen.getByText('1.2.3')).toBeOnTheScreen();
    expect(screen.getByText('GPL-3.0')).toBeOnTheScreen();
    expect(screen.getByRole('link', { name: 'Abrir o repositório no navegador' })).toBeOnTheScreen();
    expect(
      screen.getByText('Registro declaratório feito pelo tutor. Não substitui a carteira de vacinação emitida pelo veterinário.'),
    ).toBeOnTheScreen();
  });

  it('opens the repository in the system browser', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSettings();

    await fireEvent.press(screen.getByRole('link', { name: 'Abrir o repositório no navegador' }));

    expect(open).toHaveBeenCalledWith('https://github.com/celsottg/petVaccines');
  });

  it('says so when the browser cannot be opened', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no browser'));
    await renderSettings();

    await fireEvent.press(screen.getByRole('link', { name: 'Abrir o repositório no navegador' }));

    expect(await screen.findByText('Não foi possível abrir o navegador.')).toBeOnTheScreen();
  });

  it('saves the new values and goes back to Meus pets', async () => {
    await renderSettings();

    await fireEvent.changeText(dueSoon(), '45');
    await fireEvent.changeText(offset(1), '14');
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar antecedência' }));
    await fireEvent.changeText(offset(3), '3');
    await save();

    expect(getSettings(db)).toMatchObject({ dueSoonDays: 45, reminderOffsetsDays: [14, 3, 0] });
    expect(screen).toHavePathname('/');
  });

  it('removes an offset', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByRole('button', { name: 'Remover antecedência 1' }));
    await save();

    expect(getSettings(db).reminderOffsetsDays).toEqual([0]);
  });

  it('refuses to save without any offset, and writes nothing', async () => {
    await renderSettings();

    await fireEvent.press(screen.getByRole('button', { name: 'Remover antecedência 1' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Remover antecedência 1' }));
    await save();

    expect(screen.getByText('Mantenha ao menos uma antecedência.')).toBeOnTheScreen();
    expect(db.select().from(settings).all()).toEqual([]);
    expect(screen).toHavePathname('/settings');
  });

  it.each(['0', '366', '', 'dez', '2.5'])('refuses %p as the due-soon window, and writes nothing', async (text) => {
    await renderSettings();

    await fireEvent.changeText(dueSoon(), text);
    await save();

    expect(screen.getByText('Informe um número inteiro de 1 a 365.')).toBeOnTheScreen();
    expect(db.select().from(settings).all()).toEqual([]);
  });

  it('refuses an invalid or repeated offset, and writes nothing', async () => {
    await renderSettings();

    await fireEvent.changeText(offset(2), '7');
    await save();
    expect(screen.getByText('Esta antecedência já foi informada.')).toBeOnTheScreen();

    await fireEvent.changeText(offset(2), '400');
    await save();
    expect(screen.getByText('Informe um número inteiro de 0 a 365.')).toBeOnTheScreen();
    expect(db.select().from(settings).all()).toEqual([]);
  });

  it('shows a message and does not navigate when the write fails, then saves on retry', async () => {
    await renderSettings();
    const dismissTo = jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
    await fireEvent.changeText(dueSoon(), '45');
    const failing = jest.spyOn(db, 'transaction').mockImplementation(() => {
      throw new Error('disk full');
    });

    await save();

    expect(screen.getByText('Não foi possível salvar. Tente novamente.')).toBeOnTheScreen();
    expect(dismissTo).not.toHaveBeenCalled();

    failing.mockRestore();
    await save();
    expect(getSettings(db).dueSoonDays).toBe(45);
    expect(dismissTo).toHaveBeenCalledTimes(1);
  });

  it('saves once when "Salvar" is pressed twice before navigation finishes', async () => {
    await renderSettings();
    jest.spyOn(router, 'dismissTo').mockImplementation(() => {});
    await fireEvent.changeText(dueSoon(), '45');
    const transaction = jest.spyOn(db, 'transaction');

    await save();
    await save();

    expect(transaction).toHaveBeenCalledTimes(1);
  });
});
