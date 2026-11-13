import { diffDays, todayLocal } from './dates';

/** Whole local calendar days from an instant to `now`. */
export function backupAgeDays(instant: string, now: Date): number {
  return diffDays(todayLocal(now), todayLocal(new Date(instant)));
}

export interface BackupWarningInput {
  lastBackupAt: string | null;
  lastChangeAt: string | null;
  /** Earliest creation instant among the records; used when there was never a backup. */
  firstRecordAt: string | null;
  now: Date;
  warningDays: number;
}

/**
 * The backup is stale when more than `warningDays` local days have passed since
 * the last backup (or since the first record, if there never was one) AND
 * something changed after that backup.
 */
export function shouldWarnBackup({ lastBackupAt, lastChangeAt, firstRecordAt, now, warningDays }: BackupWarningInput): boolean {
  if (lastBackupAt === null) {
    // Without a backup, any record is unsaved data.
    return firstRecordAt !== null && backupAgeDays(firstRecordAt, now) > warningDays;
  }
  if (backupAgeDays(lastBackupAt, now) <= warningDays) return false;
  return lastChangeAt !== null && new Date(lastChangeAt).getTime() > new Date(lastBackupAt).getTime();
}
