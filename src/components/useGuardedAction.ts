import { useRef, useState } from 'react';

import { t } from '@/i18n';

/**
 * Runs a write at most once at a time and turns a failure into a message.
 * While an action runs (and after it succeeds, unless `unlockOnSuccess`), further
 * calls are ignored, so a second tap before navigation finishes cannot write twice.
 * A failure unlocks the guard so the user can retry.
 */
export function useGuardedAction() {
  const locked = useRef(false);
  const [error, setError] = useState<string>();

  /**
   * `write` is the only part whose failure is reported as a save error.
   * `onSuccess` (navigation) runs after a successful write, outside that handling,
   * so its failure can neither reopen the lock nor look like an unsaved write.
   */
  function run(
    write: () => void,
    { onSuccess, unlockOnSuccess = false }: { onSuccess?: () => void; unlockOnSuccess?: boolean } = {},
  ) {
    if (locked.current) return;
    locked.current = true;
    setError(undefined);
    try {
      write();
    } catch {
      locked.current = false;
      setError(t('common.saveError'));
      return;
    }
    if (unlockOnSuccess) locked.current = false;
    onSuccess?.();
  }

  return { run, error };
}
