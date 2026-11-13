// Test-only: a small valid backup used by the schema and mapping tests.
import type { BackupData } from './schema';

const PET = '11111111-1111-4111-8111-111111111111';
const VACCINATION = '22222222-2222-4222-8222-222222222222';

export function sampleBackup(): BackupData {
  return {
    format: 'petvaccines-backup',
    schemaVersion: 1,
    appVersion: '1.0.0',
    exportedAt: '2026-11-12T14:03:00.000Z',
    pets: [
      {
        id: PET,
        name: 'Thor',
        species: 'dog',
        breed: null,
        sex: 'male',
        birth_on: '2023-05-01',
        photo_file: '33333333-3333-4333-8333-333333333333.jpg',
        status: 'active',
        archived_reason: null,
        archived_on: null,
        created_at: '2026-10-01T10:00:00.000Z',
        updated_at: '2026-10-01T10:00:00.000Z',
      },
    ],
    vaccinations: [
      {
        id: VACCINATION,
        pet_id: PET,
        catalog_id: null,
        vaccine_name: 'Antirrábica',
        applied_on: '2026-10-02',
        next_due_on: '2027-10-02',
        batch: null,
        brand: null,
        vet_name: null,
        vet_license: null,
        clinic: null,
        notes: null,
        reminders_enabled: true,
        created_at: '2026-10-02T10:00:00.000Z',
        updated_at: '2026-10-02T10:00:00.000Z',
      },
    ],
    attachments: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        vaccination_id: VACCINATION,
        file: '44444444-4444-4444-8444-444444444444.jpg',
        size_bytes: 1000,
        width: 800,
        height: 600,
        created_at: '2026-10-02T10:05:00.000Z',
      },
    ],
    settings: { backup_warning_days: 14, due_soon_days: 30, reminder_offsets_days: [7, 0] },
  };
}
