import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { attachments, pets, vaccinations } from '@/db/schema';

import { countVaccinationsCreatedAfter } from './vaccinations';
import { firstRecordAt } from './firstRecordAt';
import { useSettings } from './useSettings';

export interface BackupStatus {
  loaded: boolean;
  lastBackupAt: string | null;
  lastChangeAt: string | null;
  warningDays: number;
  firstRecordAt: string | null;
  /** Vaccinations registered after the last backup (all of them when there was none). */
  vaccinationsSince: number;
  /** What a backup made now would hold. */
  counts: { pets: number; vaccinations: number; photos: number };
}

/** Backup facts for the banner and the backup screen, kept up to date with the database. */
export function useBackupStatus(): BackupStatus {
  const { settings, loaded: settingsLoaded } = useSettings();
  const petRows = useLiveQuery(db.select().from(pets));
  const vaccinationRows = useLiveQuery(db.select().from(vaccinations));
  const attachmentRows = useLiveQuery(db.select({ id: attachments.id }).from(attachments));

  const loaded =
    settingsLoaded &&
    petRows.updatedAt !== undefined &&
    vaccinationRows.updatedAt !== undefined &&
    attachmentRows.updatedAt !== undefined;

  return useMemo(
    () => ({
      loaded,
      lastBackupAt: settings.lastBackupAt,
      lastChangeAt: settings.lastChangeAt,
      warningDays: settings.backupWarningDays,
      firstRecordAt: firstRecordAt([...petRows.data, ...vaccinationRows.data]),
      vaccinationsSince: countVaccinationsCreatedAfter(db, settings.lastBackupAt),
      counts: {
        pets: petRows.data.length,
        vaccinations: vaccinationRows.data.length,
        photos: attachmentRows.data.length + petRows.data.filter((pet) => pet.photoFile !== null).length,
      },
    }),
    [loaded, settings, petRows.data, vaccinationRows.data, attachmentRows.data],
  );
}
