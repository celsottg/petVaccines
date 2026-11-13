import { SHARING_UNAVAILABLE } from '@/services/sharingError';

import { useBusyAction } from './useBusyAction';

interface ExportMessages {
  failed: string;
  unavailable: string;
}

/**
 * Runs an asynchronous export that ends in the share sheet: `useBusyAction` with
 * `exporting` for the button and a different message when sharing is unavailable.
 */
export function useExportAction<T>(run: () => Promise<T>, messages: ExportMessages) {
  const { start, busy, error, result } = useBusyAction(run, (failure) =>
    failure instanceof Error && failure.message === SHARING_UNAVAILABLE ? messages.unavailable : messages.failed,
  );
  return { start, exporting: busy, error, result };
}
