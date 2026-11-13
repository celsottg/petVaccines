import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { attachments, pets, settings, vaccinations } from '@/db/schema';

import { getSettings } from './settings';
import type { Pet, Vaccination } from './types';
import { buildVaccinationDetail, buildWallet, type VaccinationDetail, type Wallet } from './wallet';

/**
 * The wallet of a pet, kept up to date with the database. `loaded` is false
 * until every table has been read once, so a screen does not flash "not found".
 */
export function useWallet(petId: string): { pet: Pet | undefined; wallet: Wallet | null; loaded: boolean } {
  const petRows = useLiveQuery(db.select().from(pets).where(eq(pets.id, petId)), [petId]);
  const vaccinationRows = useLiveQuery(db.select().from(vaccinations).where(eq(vaccinations.petId, petId)), [petId]);
  const attachmentRows = useLiveQuery(db.select({ vaccinationId: attachments.vaccinationId }).from(attachments));
  // Settings change on another screen; the query only tells us when to read them again.
  const settingRows = useLiveQuery(db.select().from(settings));

  const loaded = [petRows, vaccinationRows, attachmentRows, settingRows].every((rows) => rows.updatedAt !== undefined);
  const pet = petRows.data[0];

  const wallet = useMemo(() => {
    if (!pet) return null;
    const attached = new Set(attachmentRows.data.map((row) => row.vaccinationId));
    return buildWallet(pet, vaccinationRows.data, attached, getSettings(db).dueSoonDays);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settingRows.data signals a settings change
  }, [pet, vaccinationRows.data, attachmentRows.data, settingRows.data]);

  return { pet, wallet, loaded };
}

/** One vaccination with its pet and whether it is the current record; `detail` is undefined when either is missing. */
export function useVaccinationDetail(id: string): {
  detail: VaccinationDetail | undefined;
  /** The days-before offsets of the reminders, from the settings. */
  reminderOffsetsDays: number[];
  loaded: boolean;
} {
  const vaccinationRows = useLiveQuery(db.select().from(vaccinations).where(eq(vaccinations.id, id)), [id]);
  const vaccination: Vaccination | undefined = vaccinationRows.data[0];
  const petId = vaccination?.petId ?? '';
  const petRows = useLiveQuery(db.select().from(pets).where(eq(pets.id, petId)), [petId]);
  const siblingRows = useLiveQuery(db.select().from(vaccinations).where(eq(vaccinations.petId, petId)), [petId]);
  const attachmentRows = useLiveQuery(
    db.select({ id: attachments.id }).from(attachments).where(eq(attachments.vaccinationId, id)),
    [id],
  );
  const settingRows = useLiveQuery(db.select().from(settings));

  const loaded = [vaccinationRows, petRows, siblingRows, attachmentRows, settingRows].every(
    (rows) => rows.updatedAt !== undefined,
  );
  const pet = petRows.data[0];

  const detail = useMemo(() => {
    if (!vaccination || !pet) return undefined;
    return buildVaccinationDetail(
      pet,
      vaccination,
      siblingRows.data,
      attachmentRows.data.length > 0,
      getSettings(db).dueSoonDays,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- settingRows.data signals a settings change
  }, [vaccination, pet, siblingRows.data, attachmentRows.data, settingRows.data]);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- settingRows.data signals a settings change
  const reminderOffsetsDays = useMemo(() => getSettings(db).reminderOffsetsDays, [settingRows.data]);

  return { detail, reminderOffsetsDays, loaded };
}
