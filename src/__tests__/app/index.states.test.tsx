import { fireEvent } from '@testing-library/react-native';
import { renderRouter, screen } from 'expo-router/testing-library';
import * as RN from 'react-native';

import HomeScreen from '@/app/index';
import { theme } from '@/theme';

describe('Meus pets screen — states', () => {
  afterEach(() => jest.restoreAllMocks());

  it('shows the empty state texts', async () => {
    await renderRouter({ index: HomeScreen });
    expect(screen.getByText('Nenhum pet cadastrado')).toBeOnTheScreen();
    expect(screen.getByText(/Cadastre seu cão ou gato/)).toBeOnTheScreen();
  });

  it('exposes the title as an accessibility header', async () => {
    await renderRouter({ index: HomeScreen });
    expect(screen.getByRole('header', { name: 'Meus pets' })).toBeOnTheScreen();
  });

  it('the add button is pressable without crashing (navigation arrives in Task 5)', async () => {
    await renderRouter({ index: HomeScreen });
    expect(() => fireEvent.press(screen.getByRole('button', { name: 'Adicionar pet' }))).not.toThrow();
  });

  it.each(['light', 'dark'] as const)('renders in %s mode with theme background and primary button', async (mode) => {
    jest.spyOn(RN, 'useColorScheme').mockReturnValue(mode);
    await renderRouter({ index: HomeScreen });
    const btn = screen.getByRole('button', { name: 'Adicionar pet' });
    expect(btn).toHaveStyle({ backgroundColor: theme.colors[mode].primary });
  });
});
