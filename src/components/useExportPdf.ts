import { t } from '@/i18n';
import { exportPetPdf } from '@/services/exportPdf';

import { useExportAction } from './useExportAction';

/** Exports the pet's wallet as a PDF: see `useExportAction`. */
export function useExportPdf(petId: string) {
  const { start, exporting, error } = useExportAction(() => exportPetPdf(petId), {
    failed: t('vaccinations.wallet.exportPdfError'),
    unavailable: t('vaccinations.wallet.exportPdfUnavailable'),
  });
  return { start, exporting, error };
}
