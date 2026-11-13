import type { Attachment, Pet, Vaccination } from '@/data/types';

import type { BackupAttachmentRow, BackupPetRow, BackupVaccinationRow } from './schema';

// The only place that maps the app's camelCase rows to the backup's snake_case
// rows (the database column names) and back. The pairs are inverses.

export function petToBackup(pet: Pet): BackupPetRow {
  return {
    id: pet.id,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    sex: pet.sex,
    birth_on: pet.birthOn,
    photo_file: pet.photoFile,
    status: pet.status,
    archived_reason: pet.archivedReason,
    archived_on: pet.archivedOn,
    created_at: pet.createdAt,
    updated_at: pet.updatedAt,
  };
}

export function petFromBackup(row: BackupPetRow): Pet {
  return {
    id: row.id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    sex: row.sex,
    birthOn: row.birth_on,
    photoFile: row.photo_file,
    status: row.status,
    archivedReason: row.archived_reason,
    archivedOn: row.archived_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function vaccinationToBackup(v: Vaccination): BackupVaccinationRow {
  return {
    id: v.id,
    pet_id: v.petId,
    catalog_id: v.catalogId,
    vaccine_name: v.vaccineName,
    applied_on: v.appliedOn,
    next_due_on: v.nextDueOn,
    batch: v.batch,
    brand: v.brand,
    vet_name: v.vetName,
    vet_license: v.vetLicense,
    clinic: v.clinic,
    notes: v.notes,
    reminders_enabled: v.remindersEnabled,
    created_at: v.createdAt,
    updated_at: v.updatedAt,
  };
}

export function vaccinationFromBackup(row: BackupVaccinationRow): Vaccination {
  return {
    id: row.id,
    petId: row.pet_id,
    catalogId: row.catalog_id,
    vaccineName: row.vaccine_name,
    appliedOn: row.applied_on,
    nextDueOn: row.next_due_on,
    batch: row.batch,
    brand: row.brand,
    vetName: row.vet_name,
    vetLicense: row.vet_license,
    clinic: row.clinic,
    notes: row.notes,
    remindersEnabled: row.reminders_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function attachmentToBackup(a: Attachment): BackupAttachmentRow {
  return {
    id: a.id,
    vaccination_id: a.vaccinationId,
    file: a.file,
    size_bytes: a.sizeBytes,
    width: a.width,
    height: a.height,
    created_at: a.createdAt,
  };
}

export function attachmentFromBackup(row: BackupAttachmentRow): Attachment {
  return {
    id: row.id,
    vaccinationId: row.vaccination_id,
    file: row.file,
    sizeBytes: row.size_bytes,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}
