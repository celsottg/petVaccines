import { useRef, useState } from 'react';

import { t } from '@/i18n';
import { BackupError, applyBackup, discardBackupPreview, pickAndReadBackup, type BackupPreview } from '@/services/backup/import';

import { useBusyAction } from './useBusyAction';

const readMessage = (failure: unknown) =>
  t(`backup.import.errors.${failure instanceof BackupError ? failure.code : 'READ_FAILED'}`);

/**
 * The restore flow: choose a file (read and validated, nothing changed), then
 * `confirm` or `cancel` the preview. `confirm` resolves `true` once the data was replaced;
 * a failure reports that nothing was changed and drops the preview.
 */
export function useBackupImport() {
  const [preview, setPreview] = useState<BackupPreview | null>(null);
  const confirming = useRef(false);
  const reading = useBusyAction(pickAndReadBackup, readMessage);
  const applying = useBusyAction(async () => {
    await applyBackup(preview!);
    return true;
  }, () => t('backup.import.failed'));

  async function choose() {
    applying.reset();
    const read = await reading.start();
    if (read) setPreview(read);
  }

  function cancel() {
    if (preview) discardBackupPreview(preview);
    setPreview(null);
  }

  async function confirm(): Promise<boolean> {
    // A second tap in the same tick must not reach the guarded action, or it would drop the preview.
    if (!preview || confirming.current) return false;
    confirming.current = true;
    try {
      const done = await applying.start();
      if (!done) discardBackupPreview(preview);
      setPreview(null);
      return done === true;
    } finally {
      confirming.current = false;
    }
  }

  return {
    preview,
    choose,
    cancel,
    confirm,
    reading: reading.busy,
    applying: applying.busy,
    error: reading.error ?? applying.error,
  };
}
