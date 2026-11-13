import { render, screen } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';

import RootLayout from '@/app/_layout';
import { removeOrphanFiles } from '@/services/files';

// The real client opens a native expo-sqlite database, which jest cannot load.
jest.mock('@/db/client', () => ({ db: {} }));
jest.mock('@/db/migrations/migrations', () => ({ __esModule: true, default: { migrations: {} } }));
jest.mock('expo-router', () => ({
  Stack: () => <MockText>routes</MockText>,
}));
jest.mock('expo-status-bar', () => ({ StatusBar: () => null }));
jest.mock('@/components/ReminderSync', () => ({ ReminderSync: () => <MockText>reminder sync</MockText> }));
jest.mock('@/services/files', () => ({ removeOrphanFiles: jest.fn().mockResolvedValue(undefined) }));

const mockUseMigrations = jest.fn();
jest.mock('drizzle-orm/expo-sqlite/migrator', () => ({
  useMigrations: (...args: unknown[]) => mockUseMigrations(...args),
}));

describe('RootLayout', () => {
  beforeEach(() => jest.clearAllMocks());

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
  describe('reminder sync', () => {
    it('mounts the single sync trigger once migrations succeed', async () => {
      mockUseMigrations.mockReturnValue({ success: true, error: undefined });
      await render(<RootLayout />);
      expect(screen.getByText('reminder sync')).toBeTruthy();
    });

    it('does not mount it before migrations finish or when they fail', async () => {
      mockUseMigrations.mockReturnValue({ success: false, error: undefined });
      await render(<RootLayout />);
      expect(screen.queryByText('reminder sync')).toBeNull();

      mockUseMigrations.mockReturnValue({ success: false, error: new Error('no such table: pets') });
      await render(<RootLayout />);
      expect(screen.queryByText('reminder sync')).toBeNull();
    });
  });

  describe('orphan photo sweep', () => {
    it('does not run before migrations finish or when they fail', async () => {
      mockUseMigrations.mockReturnValue({ success: false, error: undefined });
      await render(<RootLayout />);
      mockUseMigrations.mockReturnValue({ success: false, error: new Error('no such table: pets') });
      await render(<RootLayout />);

      expect(removeOrphanFiles).not.toHaveBeenCalled();
    });

    it('runs once at start, after migrations succeed', async () => {
      mockUseMigrations.mockReturnValue({ success: true, error: undefined });

      const { rerender } = await render(<RootLayout />);
      await rerender(<RootLayout />);

      expect(removeOrphanFiles).toHaveBeenCalledTimes(1);
    });

    it('never blocks or crashes the start when the sweep fails', async () => {
      mockUseMigrations.mockReturnValue({ success: true, error: undefined });
      jest.mocked(removeOrphanFiles).mockRejectedValueOnce(new Error('disk error'));

      await render(<RootLayout />);

      expect(screen.getByText('routes')).toBeTruthy();
    });

    it('survives a sweep that throws synchronously', async () => {
      mockUseMigrations.mockReturnValue({ success: true, error: undefined });
      jest.mocked(removeOrphanFiles).mockImplementationOnce(() => {
        throw new Error('no filesystem');
      });

      await render(<RootLayout />);

      expect(screen.getByText('routes')).toBeTruthy();
    });
  });

});
