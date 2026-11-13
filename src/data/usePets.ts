import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { pets, settings, vaccinations } from '@/db/schema';

import { buildPetSummaries, type PetSummary } from './petSummaries';
import { getSettings } from './settings';
import type { Pet } from './types';

/**
 * Pets with the given status and their badges, kept up to date with the
 * database. `loaded` is false until the first read of every table finishes,
 * so a screen does not flash its empty state.
 */
export function usePetSummaries(status: Pet['status']): { summaries: PetSummary[]; loaded: boolean } {
  const petRows = useLiveQuery(db.select().from(pets).where(eq(pets.status, status)), [status]);
  const vaccinationRows = useLiveQuery(db.select().from(vaccinations));
  // Settings change on another screen; the query only tells us when to read them again.
  const settingRows = useLiveQuery(db.select().from(settings));

  const loaded =
    petRows.updatedAt !== undefined && vaccinationRows.updatedAt !== undefined && settingRows.updatedAt !== undefined;

  const summaries = useMemo(() => {
    const sorted = [...petRows.data].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    return buildPetSummaries(sorted, vaccinationRows.data, getSettings(db).dueSoonDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settingRows.data signals a settings change
  }, [petRows.data, vaccinationRows.data, settingRows.data]);

  return { summaries, loaded };
}

export function usePet(id: string): { pet: Pet | undefined; loaded: boolean } {
  const rows = useLiveQuery(db.select().from(pets).where(eq(pets.id, id)), [id]);
  return { pet: rows.data[0], loaded: rows.updatedAt !== undefined };
}

export function useArchivedCount(): number {
  return useLiveQuery(db.select({ id: pets.id }).from(pets).where(eq(pets.status, 'archived'))).data.length;
}
