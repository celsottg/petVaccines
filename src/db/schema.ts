import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Calendar dates (`*_on`) are `YYYY-MM-DD` text; instants (`*_at`) are ISO 8601 UTC text.

export const pets = sqliteTable('pets', {
  id: text().primaryKey(),
  name: text().notNull(),
  species: text({ enum: ['dog', 'cat'] }).notNull(),
  breed: text(),
  sex: text({ enum: ['male', 'female'] }),
  birthOn: text('birth_on'),
  photoFile: text('photo_file'),
  status: text({ enum: ['active', 'archived'] })
    .notNull()
    .default('active'),
  archivedReason: text('archived_reason', { enum: ['deceased', 'rehomed', 'other'] }),
  archivedOn: text('archived_on'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const vaccinations = sqliteTable('vaccinations', {
  id: text().primaryKey(),
  petId: text('pet_id')
    .notNull()
    .references(() => pets.id, { onDelete: 'cascade' }),
  catalogId: text('catalog_id'),
  vaccineName: text('vaccine_name').notNull(),
  appliedOn: text('applied_on').notNull(),
  nextDueOn: text('next_due_on'),
  batch: text(),
  brand: text(),
  vetName: text('vet_name'),
  vetLicense: text('vet_license'),
  clinic: text(),
  notes: text(),
  remindersEnabled: integer('reminders_enabled', { mode: 'boolean' })
    .notNull()
    .default(sql`1`),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const attachments = sqliteTable('attachments', {
  id: text().primaryKey(),
  vaccinationId: text('vaccination_id')
    .notNull()
    .references(() => vaccinations.id, { onDelete: 'cascade' }),
  file: text().notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  width: integer().notNull(),
  height: integer().notNull(),
  createdAt: text('created_at').notNull(),
});

// Key-value table; values are JSON-encoded text.
export const settings = sqliteTable('settings', {
  key: text().primaryKey(),
  value: text(),
});
