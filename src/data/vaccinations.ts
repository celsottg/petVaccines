import { count, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import { attachments, vaccinations } from '@/db/schema';

import { touchLastChange } from './settings';
import type { Db, Vaccination, VaccinationInput } from './types';

function vaccinationFields(input: Omit<VaccinationInput, 'petId'>) {
  return {
    catalogId: input.catalogId ?? null,
    vaccineName: input.vaccineName,
    appliedOn: input.appliedOn,
    nextDueOn: input.nextDueOn ?? null,
    batch: input.batch ?? null,
    brand: input.brand ?? null,
    vetName: input.vetName ?? null,
    vetLicense: input.vetLicense ?? null,
    clinic: input.clinic ?? null,
    notes: input.notes ?? null,
    remindersEnabled: input.remindersEnabled ?? true,
  };
}

export function createVaccination(db: Db, input: VaccinationInput): Vaccination {
  return db.transaction((tx) => {
    const now = new Date().toISOString();
    const vaccination = tx
      .insert(vaccinations)
      .values({
        id: randomUUID(),
        petId: input.petId,
        ...vaccinationFields(input),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    touchLastChange(tx);
    return vaccination;
  });
}

/** Replaces every user-editable field except the owner pet; optional fields left out are cleared. */
export function updateVaccination(
  db: Db,
  id: string,
  input: Omit<VaccinationInput, 'petId'>,
): Vaccination {
  return db.transaction((tx) => {
    const vaccination = tx
      .update(vaccinations)
      .set({ ...vaccinationFields(input), updatedAt: new Date().toISOString() })
      .where(eq(vaccinations.id, id))
      .returning()
      .get();
    if (!vaccination) throw new Error(`Vaccination not found: ${id}`);
    touchLastChange(tx);
    return vaccination;
  });
}

/** Deletes the vaccination and, through the cascade, its attachments. Returns the attachment files to remove from disk. */
export function deleteVaccination(db: Db, id: string): string[] {
  return db.transaction((tx) => {
    const existing = tx.select({ id: vaccinations.id }).from(vaccinations).where(eq(vaccinations.id, id)).get();
    if (!existing) throw new Error(`Vaccination not found: ${id}`);
    const files = tx
      .select({ file: attachments.file })
      .from(attachments)
      .where(eq(attachments.vaccinationId, id))
      .all()
      .map((row) => row.file);
    tx.delete(vaccinations).where(eq(vaccinations.id, id)).run();
    touchLastChange(tx);
    return files;
  });
}

/** Vaccinations created after the given instant; `null` counts all of them. */
export function countVaccinationsCreatedAfter(db: Db, instant: string | null): number {
  const query = db.select({ total: count() }).from(vaccinations);
  const row = (instant === null ? query : query.where(gt(vaccinations.createdAt, instant))).get();
  return row?.total ?? 0;
}
