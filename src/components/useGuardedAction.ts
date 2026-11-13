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

  function run(action: () => void, { unlockOnSuccess = false }: { unlockOnSuccess?: boolean } = {}) {
    if (locked.current) return;
    locked.current = true;
    setError(undefined);
    try {
      action();
      if (unlockOnSuccess) locked.current = false;
    } catch {
      locked.current = false;
      setError(t('common.saveError'));
    }
  }

  return { run, error };
}
