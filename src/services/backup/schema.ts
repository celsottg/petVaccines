import { z } from 'zod';

import { isoDate } from '@/domain/validation';

// The single definition of the backup file format (`data.json`). It is public and
// permanent once released: the importer validates untrusted files with it, so it
// is strict. Row fields use the database column names (snake_case).

export const BACKUP_FORMAT = 'petvaccines-backup';
export const CURRENT_SCHEMA_VERSION = 1;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const id = z.string().regex(new RegExp(`^${UUID}$`, 'i'), 'invalid_id');
// `<uuid>.jpg` and nothing else: no separator, no extra dot, so it cannot leave the photo folders.
const photoFile = z.string().regex(new RegExp(`^${UUID}\\.jpg$`, 'i'), 'invalid_file');
const instant = z.iso.datetime({ message: 'invalid_instant' });
const optionalText = z.string().nullable();
const optionalDate = isoDate.nullable();

export const petRowSchema = z.strictObject({
  id,
  name: z.string().min(1),
  species: z.enum(['dog', 'cat']),
  breed: optionalText,
  sex: z.enum(['male', 'female']).nullable(),
  birth_on: optionalDate,
  photo_file: photoFile.nullable(),
  status: z.enum(['active', 'archived']),
  archived_reason: z.enum(['deceased', 'rehomed', 'other']).nullable(),
  archived_on: optionalDate,
  created_at: instant,
  updated_at: instant,
});

export const vaccinationRowSchema = z.strictObject({
  id,
  pet_id: id,
  catalog_id: optionalText,
  vaccine_name: z.string().min(1),
  applied_on: isoDate,
  next_due_on: optionalDate,
  batch: optionalText,
  brand: optionalText,
  vet_name: optionalText,
  vet_license: optionalText,
  clinic: optionalText,
  notes: optionalText,
  reminders_enabled: z.boolean(),
  created_at: instant,
  updated_at: instant,
});

export const attachmentRowSchema = z.strictObject({
  id,
  vaccination_id: id,
  file: photoFile,
  size_bytes: z.number().int().nonnegative(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  created_at: instant,
});

export const settingsSchema = z.strictObject({
  backup_warning_days: z.number().int().min(1).max(365),
  due_soon_days: z.number().int().min(1).max(365),
  reminder_offsets_days: z.array(z.number().int().min(0).max(365)).min(1),
});

export const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  appVersion: z.string().min(1),
  exportedAt: instant,
  pets: z.array(petRowSchema),
  vaccinations: z.array(vaccinationRowSchema),
  attachments: z.array(attachmentRowSchema),
  settings: settingsSchema,
});

export type BackupData = z.infer<typeof backupSchema>;
export type BackupPetRow = z.infer<typeof petRowSchema>;
export type BackupVaccinationRow = z.infer<typeof vaccinationRowSchema>;
export type BackupAttachmentRow = z.infer<typeof attachmentRowSchema>;
