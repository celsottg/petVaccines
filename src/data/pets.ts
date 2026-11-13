import { eq } from 'drizzle-orm';
import { randomUUID } from 'expo-crypto';

import type { IsoDate } from '@/domain/dates';

import { attachments, pets, vaccinations } from '@/db/schema';

import { touchLastChange } from './settings';
import type { ArchiveReason, Db, Pet, PetInput } from './types';

function petFields(input: PetInput) {
  return {
    name: input.name,
    species: input.species,
    breed: input.breed ?? null,
    sex: input.sex ?? null,
    birthOn: input.birthOn ?? null,
    photoFile: input.photoFile ?? null,
  };
}

export function createPet(db: Db, input: PetInput): Pet {
  return db.transaction((tx) => {
    const now = new Date().toISOString();
    const pet = tx
      .insert(pets)
      .values({
        id: randomUUID(),
        ...petFields(input),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    touchLastChange(tx);
    return pet;
  });
}

/** Replaces every user-editable field; optional fields left out are cleared. */
export function updatePet(db: Db, id: string, input: PetInput): Pet {
  return db.transaction((tx) => {
    const pet = tx
      .update(pets)
      .set({ ...petFields(input), updatedAt: new Date().toISOString() })
      .where(eq(pets.id, id))
      .returning()
      .get();
    if (!pet) throw new Error(`Pet not found: ${id}`);
    touchLastChange(tx);
    return pet;
  });
}

export function archivePet(db: Db, id: string, reason: ArchiveReason, on: IsoDate | null): void {
  db.transaction((tx) => {
    const updated = tx
      .update(pets)
      .set({
        status: 'archived',
        archivedReason: reason,
        archivedOn: on,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pets.id, id))
      .returning({ id: pets.id })
      .all();
    if (updated.length === 0) throw new Error(`Pet not found: ${id}`);
    touchLastChange(tx);
  });
}

export function reactivatePet(db: Db, id: string): void {
  db.transaction((tx) => {
    const updated = tx
      .update(pets)
      .set({
        status: 'active',
        archivedReason: null,
        archivedOn: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(pets.id, id))
      .returning({ id: pets.id })
      .all();
    if (updated.length === 0) throw new Error(`Pet not found: ${id}`);
    touchLastChange(tx);
  });
}

/**
 * Deletes the pet; vaccinations and attachments go with it through
 * `ON DELETE CASCADE`. Returns the file names the caller must remove from disk
 * (the pet photo and every attachment of its vaccinations).
 */
export function deletePet(db: Db, id: string): string[] {
  return db.transaction((tx) => {
    const pet = tx.select().from(pets).where(eq(pets.id, id)).get();
    if (!pet) throw new Error(`Pet not found: ${id}`);
    const files = tx
      .select({ file: attachments.file })
      .from(attachments)
      .innerJoin(vaccinations, eq(attachments.vaccinationId, vaccinations.id))
      .where(eq(vaccinations.petId, id))
      .all()
      .map((row) => row.file);
    if (pet.photoFile) files.unshift(pet.photoFile);
    tx.delete(pets).where(eq(pets.id, id)).run();
    touchLastChange(tx);
    return files;
  });
}
