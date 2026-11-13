import { setSetting } from '@/data/settings';
import { createTestDb } from '@/data/testDb';
import { attachments, pets, vaccinations } from '@/db/schema';

import { buildBackupData } from './buildData';
import { backupSchema } from './schema';

// GOLDEN TEST. The literal below IS the public backup format, written out key by key
// and deliberately not derived from the mapping code or the fixture. Changing this
// expectation means changing the public backup format and requires a `schemaVersion` bump.
describe('backup format (golden)', () => {
  it('produces exactly this data.json', () => {
    const db = createTestDb();
    db.insert(pets).values([
      {
        id: '10000000-0000-4000-8000-000000000001', name: 'Thor', species: 'dog', breed: 'SRD', sex: 'male',
        birthOn: '2023-05-01', photoFile: '20000000-0000-4000-8000-000000000001.jpg', status: 'archived',
        archivedReason: 'rehomed', archivedOn: '2026-11-01', createdAt: '2026-10-01T10:00:00.000Z', updatedAt: '2026-11-01T09:00:00.000Z',
      },
      {
        id: '10000000-0000-4000-8000-000000000002', name: 'Mimi', species: 'cat', status: 'active',
        createdAt: '2026-10-03T10:00:00.000Z', updatedAt: '2026-10-03T10:00:00.000Z',
      },
    ]).run();
    db.insert(vaccinations).values([
      {
        id: '30000000-0000-4000-8000-000000000001', petId: '10000000-0000-4000-8000-000000000001', catalogId: 'br-dog-rabies',
        vaccineName: 'Antirrábica', appliedOn: '2026-10-02', nextDueOn: '2027-10-02', batch: 'L123', brand: 'Marca',
        vetName: 'Dra. Ana', vetLicense: 'CRMV-SP 1234', clinic: 'Clínica Pet', notes: 'Sem reação', remindersEnabled: false,
        createdAt: '2026-10-02T11:00:00.000Z', updatedAt: '2026-10-02T12:00:00.000Z',
      },
      {
        id: '30000000-0000-4000-8000-000000000002', petId: '10000000-0000-4000-8000-000000000002', vaccineName: 'V4',
        appliedOn: '2026-10-04', remindersEnabled: true, createdAt: '2026-10-04T10:00:00.000Z', updatedAt: '2026-10-04T10:00:00.000Z',
      },
    ]).run();
    db.insert(attachments).values({
      id: '40000000-0000-4000-8000-000000000001', vaccinationId: '30000000-0000-4000-8000-000000000001',
      file: '40000000-0000-4000-8000-000000000001.jpg', sizeBytes: 123456, width: 1536, height: 2048, createdAt: '2026-10-02T11:05:00.000Z',
    }).run();
    setSetting(db, 'backup_warning_days', 21);
    setSetting(db, 'due_soon_days', 45);
    setSetting(db, 'reminder_offsets_days', [14, 3, 0]);
    setSetting(db, 'last_backup_at', '2026-10-10T00:00:00.000Z');
    setSetting(db, 'last_change_at', '2026-11-01T09:00:00.000Z');

    const data = buildBackupData(db, new Date('2026-11-12T14:03:00Z'), '1.0.0');

    expect(data).toEqual({
      format: 'petvaccines-backup',
      schemaVersion: 1,
      appVersion: '1.0.0',
      exportedAt: '2026-11-12T14:03:00.000Z',
      pets: [
        {
          id: '10000000-0000-4000-8000-000000000001', name: 'Thor', species: 'dog', breed: 'SRD', sex: 'male',
          birth_on: '2023-05-01', photo_file: '20000000-0000-4000-8000-000000000001.jpg', status: 'archived',
          archived_reason: 'rehomed', archived_on: '2026-11-01', created_at: '2026-10-01T10:00:00.000Z', updated_at: '2026-11-01T09:00:00.000Z',
        },
        {
          id: '10000000-0000-4000-8000-000000000002', name: 'Mimi', species: 'cat', breed: null, sex: null,
          birth_on: null, photo_file: null, status: 'active', archived_reason: null, archived_on: null,
          created_at: '2026-10-03T10:00:00.000Z', updated_at: '2026-10-03T10:00:00.000Z',
        },
      ],
      vaccinations: [
        {
          id: '30000000-0000-4000-8000-000000000001', pet_id: '10000000-0000-4000-8000-000000000001', catalog_id: 'br-dog-rabies',
          vaccine_name: 'Antirrábica', applied_on: '2026-10-02', next_due_on: '2027-10-02', batch: 'L123', brand: 'Marca',
          vet_name: 'Dra. Ana', vet_license: 'CRMV-SP 1234', clinic: 'Clínica Pet', notes: 'Sem reação', reminders_enabled: false,
          created_at: '2026-10-02T11:00:00.000Z', updated_at: '2026-10-02T12:00:00.000Z',
        },
        {
          id: '30000000-0000-4000-8000-000000000002', pet_id: '10000000-0000-4000-8000-000000000002', catalog_id: null,
          vaccine_name: 'V4', applied_on: '2026-10-04', next_due_on: null, batch: null, brand: null, vet_name: null,
          vet_license: null, clinic: null, notes: null, reminders_enabled: true,
          created_at: '2026-10-04T10:00:00.000Z', updated_at: '2026-10-04T10:00:00.000Z',
        },
      ],
      attachments: [
        {
          id: '40000000-0000-4000-8000-000000000001', vaccination_id: '30000000-0000-4000-8000-000000000001',
          file: '40000000-0000-4000-8000-000000000001.jpg', size_bytes: 123456, width: 1536, height: 2048,
          created_at: '2026-10-02T11:05:00.000Z',
        },
      ],
      settings: { backup_warning_days: 21, due_soon_days: 45, reminder_offsets_days: [14, 3, 0] },
    });
    expect(backupSchema.safeParse(data).success).toBe(true);
  });
});
