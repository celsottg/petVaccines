import { act, renderHook } from '@testing-library/react-native';

import { useBusyAction } from './useBusyAction';

describe('useBusyAction', () => {
  it('resolves with the result, exposes it and is not busy afterwards', async () => {
    const { result } = await renderHook(() => useBusyAction(() => Promise.resolve(7), () => 'failed'));

    let value: number | undefined;
    await act(async () => {
      value = await result.current.start();
    });

    expect(value).toBe(7);
    expect(result.current.result).toBe(7);
    expect(result.current.busy).toBe(false);
  });

  it('ignores a second start while running', async () => {
    let finish!: () => void;
    const run = jest.fn(() => new Promise<void>((resolve) => (finish = resolve)));
    const { result } = await renderHook(() => useBusyAction(run, () => 'failed'));

    await act(async () => {
      void result.current.start();
      void result.current.start();
    });
    expect(result.current.busy).toBe(true);
    await act(async () => finish());

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('turns a failure into the picked message, resolves undefined and allows a retry', async () => {
    const run = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce('ok');
    const { result } = await renderHook(() => useBusyAction(run, (failure) => `msg:${(failure as Error).message}`));

    await act(async () => expect(await result.current.start()).toBeUndefined());
    expect(result.current.error).toBe('msg:x');
    await act(async () => expect(await result.current.start()).toBe('ok'));

    expect(result.current.error).toBeUndefined();
  });
});
