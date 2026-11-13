import type { SQLiteAsyncDatabase } from 'drizzle-orm/sqlite-core';

import type { IsoDate } from '@/domain/dates';

import type { attachments, pets, vaccinations } from '@/db/schema';

/**
 * Database handle shared by the expo-sqlite driver (app) and the
 * better-sqlite3 driver (tests). Every function in `src/data/` takes it as
 * its first argument, so tests can inject an in-memory database.
 */
export type Db = SQLiteAsyncDatabase<'sync', any>;

export type Pet = typeof pets.$inferSelect;
export type Vaccination = typeof vaccinations.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;

export type ArchiveReason = 'deceased' | 'rehomed' | 'other';

/** User-editable pet fields; ids, status and timestamps are managed by the data layer. */
export interface PetInput {
  name: string;
  species: Pet['species'];
  breed?: string | null;
  sex?: Pet['sex'];
  birthOn?: IsoDate | null;
  photoFile?: string | null;
}

/** User-editable vaccination fields; ids and timestamps are managed by the data layer. */
export interface VaccinationInput {
  petId: string;
  catalogId?: string | null;
  vaccineName: string;
  appliedOn: IsoDate;
  nextDueOn?: IsoDate | null;
  batch?: string | null;
  brand?: string | null;
  vetName?: string | null;
  vetLicense?: string | null;
  clinic?: string | null;
  notes?: string | null;
  remindersEnabled?: boolean;
}

export interface AttachmentInput {
  id: string;
  vaccinationId: string;
  file: string;
  sizeBytes: number;
  width: number;
  height: number;
}
