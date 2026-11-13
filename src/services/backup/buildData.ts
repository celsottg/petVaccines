import { getSettings } from '@/data/settings';
import type { Db } from '@/data/types';
import { attachments, pets, vaccinations } from '@/db/schema';

import { attachmentToBackup, petToBackup, vaccinationToBackup } from './rows';
import { BACKUP_FORMAT, CURRENT_SCHEMA_VERSION, type BackupData } from './schema';

// Rows come out in a stable order so two backups of the same data are identical.
const byCreation = <T extends { createdAt: string; id: string }>(a: T, b: T) =>
  a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1;

/** Everything in the database that a backup carries: all pets (archived included), records, attachments and the three preferences. */
export function buildBackupData(db: Db, now: Date, appVersion: string): BackupData {
  const settings = getSettings(db);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    exportedAt: now.toISOString(),
    pets: db.select().from(pets).all().sort(byCreation).map(petToBackup),
    vaccinations: db.select().from(vaccinations).all().sort(byCreation).map(vaccinationToBackup),
    attachments: db.select().from(attachments).all().sort(byCreation).map(attachmentToBackup),
    settings: {
      backup_warning_days: settings.backupWarningDays,
      due_soon_days: settings.dueSoonDays,
      reminder_offsets_days: settings.reminderOffsetsDays,
    },
  };
}
