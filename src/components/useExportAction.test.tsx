import { act, renderHook } from '@testing-library/react-native';

import { SHARING_UNAVAILABLE } from '@/services/sharingError';

import { useExportAction } from './useExportAction';

const messages = { failed: 'failed', unavailable: 'unavailable' };

describe('useExportAction', () => {
  it('exposes the result of the last successful run', async () => {
    const run = jest.fn().mockResolvedValue({ missing: 2 });
    const { result } = await renderHook(() => useExportAction(run, messages));

    await act(async () => result.current.start());

    expect(result.current.result).toEqual({ missing: 2 });
    expect(result.current.error).toBeUndefined();
  });

  it('uses the unavailable message when sharing is not possible, and clears the old result on retry', async () => {
    const run = jest.fn().mockResolvedValueOnce('first').mockRejectedValueOnce(new Error(SHARING_UNAVAILABLE));
    const { result } = await renderHook(() => useExportAction(run, messages));

    await act(async () => result.current.start());
    await act(async () => result.current.start());

    expect(result.current.error).toBe('unavailable');
    expect(result.current.result).toBeUndefined();
  });

  it('uses the generic message for any other failure', async () => {
    const { result } = await renderHook(() => useExportAction(() => Promise.reject(new Error('x')), messages));

    await act(async () => result.current.start());

    expect(result.current.error).toBe('failed');
  });
});
