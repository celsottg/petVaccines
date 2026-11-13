import { setSetting } from '@/data/settings';
import type { Db } from '@/data/types';
import { attachments, pets, settings, vaccinations } from '@/db/schema';

import { attachmentFromBackup, petFromBackup, vaccinationFromBackup } from './rows';
import type { BackupData } from './schema';

/**
 * Replaces everything in the database with a backup, in ONE transaction: if any
 * step throws, the old data and settings are exactly as they were. This is the
 * only code that deletes all data.
 *
 * `skipFiles` are photo file names missing from the zip: their attachments are not
 * inserted and a pet whose photo is among them is inserted without a photo, so no
 * row ever points at a file that is not on the device.
 *
 * `last_backup_at` and `last_change_at` both become `exportedAt`: the data now
 * equals that backup, so the stale-backup warning stays quiet until something changes.
 * A backup dated in the future (clock error, edited file) would silence that warning
 * for good, so the stored instant is the earlier of `exportedAt` and `now`; the file is
 * still accepted. `data` must come from `parseBackupJson`.
 *
 * A restore rewrites the WHOLE settings table. A future setting that the backup does
 * not carry must be handled here explicitly, or a restore would reset it.
 */
export function replaceAllData(db: Db, data: BackupData, skipFiles: string[], now: Date = new Date()): void {
  const skipped = new Set(skipFiles);
  const stored = Date.parse(data.exportedAt) > now.getTime() ? now.toISOString() : data.exportedAt;
  db.transaction((tx) => {
    tx.delete(attachments).run();
    tx.delete(vaccinations).run();
    tx.delete(pets).run();
    tx.delete(settings).run();

    for (const row of data.pets) {
      const pet = petFromBackup(row);
      tx.insert(pets)
        .values({ ...pet, photoFile: pet.photoFile !== null && skipped.has(pet.photoFile) ? null : pet.photoFile })
        .run();
    }
    for (const row of data.vaccinations) tx.insert(vaccinations).values(vaccinationFromBackup(row)).run();
    for (const row of data.attachments) {
      if (!skipped.has(row.file)) tx.insert(attachments).values(attachmentFromBackup(row)).run();
    }

    setSetting(tx, 'backup_warning_days', data.settings.backup_warning_days);
    setSetting(tx, 'due_soon_days', data.settings.due_soon_days);
    setSetting(tx, 'reminder_offsets_days', data.settings.reminder_offsets_days);
    setSetting(tx, 'last_backup_at', stored);
    setSetting(tx, 'last_change_at', stored);
  });
}
