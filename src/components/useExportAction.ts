import { useRef, useState } from 'react';

import { SHARING_UNAVAILABLE } from '@/services/sharingError';

interface ExportMessages {
  failed: string;
  unavailable: string;
}

/**
 * Runs an asynchronous export that ends in the share sheet. Unlike
 * `useGuardedAction` it exposes `exporting` for the button; taps while it runs are
 * ignored, and a failure becomes a message (a different one when sharing is
 * unavailable) and unlocks a retry. `result` is what the last successful run returned.
 */
export function useExportAction<T>(run: () => Promise<T>, messages: ExportMessages) {
  const locked = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<T>();

  async function start() {
    if (locked.current) return;
    locked.current = true;
    setExporting(true);
    setError(undefined);
    setResult(undefined);
    try {
      setResult(await run());
    } catch (failure) {
      const unavailable = failure instanceof Error && failure.message === SHARING_UNAVAILABLE;
      setError(unavailable ? messages.unavailable : messages.failed);
    } finally {
      locked.current = false;
      setExporting(false);
    }
  }

  return { start, exporting, error, result };
}
