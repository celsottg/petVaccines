import { deleteFiles } from './files';

/**
 * Fire-and-forget `deleteFiles` for callers that must never fail because of it:
 * the database write already succeeded (or the file is an unsaved leftover), and
 * whatever stays on disk is swept at the next app start.
 */
export function discardFiles(names: string[]): void {
  try {
    Promise.resolve(deleteFiles(names)).catch(() => {});
  } catch {
    // Same: the next start sweeps it.
  }
}
