import { render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import RootLayout from '@/app/_layout';

// The real client opens a native expo-sqlite database, which jest cannot load.
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/migrations/migrations', () => ({ __esModule: true, default: { migrations: {} } }));
jest.mock('expo-router', () => ({
  Stack: () => <MockText>routes</MockText>,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));

const mockUseMigrations = jest.fn();
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

describe('RootLayout', () => {
  it('renders nothing until migrations finish', async () => {
    mockUseMigrations.mockReturnValue({ success: false, error: undefined });
    await render(<RootLayout />);
    expect(screen.queryByText('routes')).toBeNull();
    expect(screen.queryByRole('header')).toBeNull();
  });

  it('renders the routes once migrations succeed', async () => {
    mockUseMigrations.mockReturnValue({ success: true, error: undefined });
    await render(<RootLayout />);
    expect(screen.getByText('routes')).toBeTruthy();
  });

  it('shows the migration error message instead of the routes', async () => {
    mockUseMigrations.mockReturnValue({ success: false, error: new Error('no such table: pets') });
    await render(<RootLayout />);
    expect(screen.getByRole('header')).toBeTruthy();
    expect(screen.getByText('Não foi possível abrir o banco de dados')).toBeTruthy();
    expect(screen.getByText('no such table: pets')).toBeTruthy();
    expect(screen.queryByText('routes')).toBeNull();
  });
});
