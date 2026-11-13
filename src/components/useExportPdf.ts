import { useRef, useState } from 'react';

import { t } from '@/i18n';
import { exportPetPdf, SHARING_UNAVAILABLE } from '@/services/exportPdf';

/**
 * Exports the pet's wallet as a PDF. Generation is asynchronous, so unlike
 * `useGuardedAction` it exposes `exporting` for the button; taps while it runs
 * are ignored, and a failure becomes a message and unlocks a retry.
 */
export function useExportPdf(petId: string) {
  const locked = useRef(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string>();

  async function start() {
    if (locked.current) return;
    locked.current = true;
    setExporting(true);
    setError(undefined);
    try {
      await exportPetPdf(petId);
    } catch (failure) {
      const unavailable = failure instanceof Error && failure.message === SHARING_UNAVAILABLE;
      setError(t(unavailable ? 'vaccinations.wallet.exportPdfUnavailable' : 'vaccinations.wallet.exportPdfError'));
    } finally {
      locked.current = false;
      setExporting(false);
    }
  }

  return { start, exporting, error };
}
