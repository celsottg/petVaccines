import { act, renderHook } from '@testing-library/react-native';

import { applyBackup, discardBackupPreview, pickAndReadBackup, type BackupPreview } from '@/services/backup/import';

import { useBackupImport } from './useBackupImport';

jest.mock('@/services/backup/import', () => ({
  ...jest.requireActual('@/services/backup/validate'),
  applyBackup: jest.fn(),
  discardBackupPreview: jest.fn(),
  pickAndReadBackup: jest.fn(),
}));

const pick = jest.mocked(pickAndReadBackup);
const apply = jest.mocked(applyBackup);
const discard = jest.mocked(discardBackupPreview);
const preview = { stagingDir: 'file:///cache/x/1', missing: [] } as unknown as BackupPreview;

beforeEach(() => {
  jest.clearAllMocks();
  pick.mockResolvedValue(preview);
  apply.mockResolvedValue(undefined);
});

describe('useBackupImport staging cleanup', () => {
  it('discards the staging folder when the screen unmounts with a summary pending', async () => {
    const { result, unmount } = await renderHook(() => useBackupImport());
    await act(async () => result.current.choose());

    await unmount();

    expect(discard).toHaveBeenCalledWith(preview);
  });

  it('discards nothing on unmount when there is no pending summary', async () => {
    const { unmount } = await renderHook(() => useBackupImport());

    await unmount();

    expect(discard).not.toHaveBeenCalled();
  });

  it('discards nothing on unmount after a successful restore (staging is already gone)', async () => {
    const { result, unmount } = await renderHook(() => useBackupImport());
    await act(async () => result.current.choose());
    await act(async () => void (await result.current.confirm()));
    discard.mockClear();

    await unmount();

    expect(discard).not.toHaveBeenCalled();
  });

  it('discards once, not again on unmount, when the tutor cancels', async () => {
    const { result, unmount } = await renderHook(() => useBackupImport());
    await act(async () => result.current.choose());
    await act(async () => result.current.cancel());

    await unmount();

    expect(discard).toHaveBeenCalledTimes(1);
  });

  it('does not discard while a restore is running when the screen unmounts', async () => {
    let finish!: () => void;
    apply.mockImplementation(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result, unmount } = await renderHook(() => useBackupImport());
    await act(async () => result.current.choose());
    await act(async () => {
      void result.current.confirm();
    });

    await unmount();
    expect(discard).not.toHaveBeenCalled();
    await act(async () => finish());
  });
});
