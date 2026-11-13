import { useRef, useState } from 'react';

/**
 * Runs one asynchronous action at a time and exposes `busy` for the button. Taps
 * while it runs are ignored; a failure becomes the message `messageFor` picks and
 * unlocks a retry. `result` is what the last successful run returned, and `start`
 * resolves with it (`undefined` after a failure or an ignored call).
 */
export function useBusyAction<T>(run: () => Promise<T>, messageFor: (failure: unknown) => string) {
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<T>();

  async function start(): Promise<T | undefined> {
    if (locked.current) return undefined;
    locked.current = true;
    setBusy(true);
    setError(undefined);
    setResult(undefined);
    try {
      const value = await run();
      setResult(value);
      return value;
    } catch (failure) {
      setError(messageFor(failure));
      return undefined;
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function reset() {
    setError(undefined);
    setResult(undefined);
  }

  return { start, busy, error, result, reset };
}
