import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { settings as settingsTable } from '@/db/schema';

import { getSettings, type Settings } from './settings';

/** The settings, kept up to date with the database. `loaded` is false until the first read. */
export function useSettings(): { settings: Settings; loaded: boolean } {
  const rows = useLiveQuery(db.select().from(settingsTable));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rows.data signals a settings change
  const settings = useMemo(() => getSettings(db), [rows.data]);
  return { settings, loaded: rows.updatedAt !== undefined };
}
