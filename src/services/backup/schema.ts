import { z } from 'zod';

import { MAX_ATTACHMENTS_PER_VACCINATION } from '@/data/attachments';
import { BACKUP_WARNING_RANGE, DUE_SOON_RANGE, OFFSET_RANGE } from '@/domain/settingsInput';
import { isoDate } from '@/domain/validation';

// The single definition of the backup file format (`data.json`). It is public and
// permanent once released: the importer validates untrusted files with it, so it
// is strict. Row fields use the database column names (snake_case).
//
// Cross-references are checked here too, not left to the importer: every
// vaccination points to a pet of the file, every attachment to a vaccination of
// the file, ids are unique per list, file names are unique across the file, a
// vaccination has at most 3 attachments and an active pet carries no archive data.

export const BACKUP_FORMAT = 'petvaccines-backup';
export const CURRENT_SCHEMA_VERSION = 1;

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
// Lowercase only: the app generates lowercase, and a case mismatch would not find the file on a case-sensitive file system.
const id = z.string().regex(new RegExp(`^${UUID}$`), 'invalid_id');
// `<uuid>.jpg` and nothing else: no separator, no extra dot, so it cannot leave the photo folders.
const photoFile = z.string().regex(new RegExp(`^${UUID}\\.jpg$`), 'invalid_file');
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

const dayCount = (range: { min: number; max: number }) => z.number().int().min(range.min).max(range.max);

export const settingsSchema = z.strictObject({
  backup_warning_days: dayCount(BACKUP_WARNING_RANGE),
  due_soon_days: dayCount(DUE_SOON_RANGE),
  reminder_offsets_days: z
    .array(dayCount(OFFSET_RANGE))
    .min(1)
    .refine((list) => new Set(list).size === list.length, 'duplicate_offset'),
});

export const backupSchema = z
  .strictObject({
    format: z.literal(BACKUP_FORMAT),
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    appVersion: z.string().min(1),
    exportedAt: instant,
    pets: z.array(petRowSchema),
    vaccinations: z.array(vaccinationRowSchema),
    attachments: z.array(attachmentRowSchema),
    settings: settingsSchema,
  })
  .superRefine((data, ctx) => {
    const issue = (message: string, path: (string | number)[]) => ctx.addIssue({ code: 'custom', message, path });
    const unique = (list: { id: string }[], name: string) => {
      const seen = new Set<string>();
      list.forEach((row, index) => {
        if (seen.has(row.id)) issue('duplicate_id', [name, index, 'id']);
        seen.add(row.id);
      });
      return seen;
    };
    const petIds = unique(data.pets, 'pets');
    const vaccinationIds = unique(data.vaccinations, 'vaccinations');
    unique(data.attachments, 'attachments');

    data.vaccinations.forEach((row, index) => {
      if (!petIds.has(row.pet_id)) issue('unknown_pet', ['vaccinations', index, 'pet_id']);
    });
    const perVaccination = new Map<string, number>();
    data.attachments.forEach((row, index) => {
      if (!vaccinationIds.has(row.vaccination_id)) issue('unknown_vaccination', ['attachments', index, 'vaccination_id']);
      const total = (perVaccination.get(row.vaccination_id) ?? 0) + 1;
      perVaccination.set(row.vaccination_id, total);
      if (total > MAX_ATTACHMENTS_PER_VACCINATION) issue('too_many_attachments', ['attachments', index, 'vaccination_id']);
    });

    const files = new Set<string>();
    data.pets.forEach((row, index) => {
      if (row.photo_file === null) return;
      if (files.has(row.photo_file)) issue('duplicate_file', ['pets', index, 'photo_file']);
      files.add(row.photo_file);
    });
    data.attachments.forEach((row, index) => {
      if (files.has(row.file)) issue('duplicate_file', ['attachments', index, 'file']);
      files.add(row.file);
    });

    data.pets.forEach((row, index) => {
      if (row.status !== 'active') return;
      if (row.archived_reason !== null) issue('active_pet_archived', ['pets', index, 'archived_reason']);
      if (row.archived_on !== null) issue('active_pet_archived', ['pets', index, 'archived_on']);
    });
  });

export type BackupHeader = { kind: 'supported' } | { kind: 'newer'; schemaVersion: number } | { kind: 'not_backup' };

/**
 * Looks only at `format` and `schemaVersion` of parsed JSON, before full validation,
 * so the importer can say "update the app" (newer) apart from "not a backup".
 */
export function inspectBackupHeader(raw: unknown): BackupHeader {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { kind: 'not_backup' };
  const { format, schemaVersion } = raw as Record<string, unknown>;
  if (format !== BACKUP_FORMAT || typeof schemaVersion !== 'number' || !Number.isInteger(schemaVersion) || schemaVersion < 1) {
    return { kind: 'not_backup' };
  }
  return schemaVersion > CURRENT_SCHEMA_VERSION ? { kind: 'newer', schemaVersion } : { kind: 'supported' };
}

export type BackupData = z.infer<typeof backupSchema>;
export type BackupPetRow = z.infer<typeof petRowSchema>;
export type BackupVaccinationRow = z.infer<typeof vaccinationRowSchema>;
export type BackupAttachmentRow = z.infer<typeof attachmentRowSchema>;
