import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useEffect } from 'react';

import { db } from '@/db/client';
import { pets, settings, vaccinations } from '@/db/schema';
import { requestReminderSync } from '@/services/reminders';

/**
 * The one place that keeps the scheduled reminders in step with the data: it
 * asks for a sync once the tables are first read (app start) and again whenever
 * pets, vaccinations or settings change, whatever screen or import caused it.
 * The sync itself reads the database when it runs, so the last change wins.
 */
export function useReminderSync(): void {
  const petRows = useLiveQuery(db.select().from(pets));
  const vaccinationRows = useLiveQuery(db.select().from(vaccinations));
  const settingRows = useLiveQuery(db.select().from(settings));
  const loaded = [petRows, vaccinationRows, settingRows].every((rows) => rows.updatedAt !== undefined);

  useEffect(() => {
    if (!loaded) return;
    void requestReminderSync();
  }, [loaded, petRows.data, vaccinationRows.data, settingRows.data]);
}
