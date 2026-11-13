import { settings } from '@/db/schema';

import type { Db } from './types';

export interface Settings {
  lastBackupAt: string | null;
  lastChangeAt: string | null;
  backupWarningDays: number;
  dueSoonDays: number;
  reminderOffsetsDays: number[];
}

/**
 * Keys of the `settings` table, as stored (snake_case). A backup restore rewrites the whole
 * table (`replaceAllData`): a new key that the backup does not carry must be handled there.
 */
export type SettingKey =
  | 'last_backup_at'
  | 'last_change_at'
  | 'backup_warning_days'
  | 'due_soon_days'
  | 'reminder_offsets_days';

export type SettingValue = string | number | number[] | null;

export const DEFAULT_SETTINGS: Settings = {
  lastBackupAt: null,
  lastChangeAt: null,
  backupWarningDays: 14,
  dueSoonDays: 30,
  reminderOffsetsDays: [7, 0],
};

const FIELD_BY_KEY: Record<SettingKey, keyof Settings> = {
  last_backup_at: 'lastBackupAt',
  last_change_at: 'lastChangeAt',
  backup_warning_days: 'backupWarningDays',
  due_soon_days: 'dueSoonDays',
  reminder_offsets_days: 'reminderOffsetsDays',
};

// Values are stored JSON-encoded, so numbers, arrays and instants share one format.
export function getSettings(db: Db): Settings {
  const rows = db.select().from(settings).all();
  const result: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    const field = FIELD_BY_KEY[row.key as SettingKey];
    if (field && row.value !== null) result[field] = JSON.parse(row.value);
  }
  return result as unknown as Settings;
}

export function setSetting(db: Db, key: SettingKey, value: SettingValue): void {
  const encoded = value === null ? null : JSON.stringify(value);
  db.insert(settings)
    .values({ key, value: encoded })
    .onConflictDoUpdate({ target: settings.key, set: { value: encoded } })
    .run();
}

/** Marks that pet, vaccination or attachment data changed (drives the backup warning). */
export function touchLastChange(db: Db): void {
  setSetting(db, 'last_change_at', new Date().toISOString());
}
