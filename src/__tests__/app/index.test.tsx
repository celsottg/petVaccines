import { renderRouter, screen } from 'expo-router/testing-library';

import HomeScreen from '@/app/index';

describe('Meus pets screen', () => {
  it('renders the title and the empty state', async () => {
    await renderRouter({ index: HomeScreen });

    expect(screen.getByText('Meus pets')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Adicionar pet' })).toBeOnTheScreen();
  });
});
