import { createPet, archivePet } from '@/data/pets';
import { setSetting } from '@/data/settings';
import { createTestDb } from '@/data/testDb';
import { newAttachment } from '@/data/testHelpers';
import { createVaccination } from '@/data/vaccinations';
import { attachments, pets, vaccinations } from '@/db/schema';

import { buildBackupData } from './buildData';
import { attachmentFromBackup, attachmentToBackup, petFromBackup, petToBackup, vaccinationFromBackup, vaccinationToBackup } from './rows';
import { backupSchema } from './schema';

const NOW = new Date('2026-11-12T14:03:00Z');

function populate() {
  const db = createTestDb();
  const thor = createPet(db, { name: 'Thor', species: 'dog', breed: 'SRD', sex: 'male', birthOn: '2023-05-01', photoFile: '55555555-5555-4555-8555-555555555555.jpg' });
  const mimi = createPet(db, { name: 'Mimi', species: 'cat' });
  const full = createVaccination(db, {
    petId: thor.id, catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica', appliedOn: '2026-10-02', nextDueOn: '2027-10-02',
    batch: 'L1', brand: 'B', vetName: 'Dra. Ana', vetLicense: 'CRMV-SP 1', clinic: 'Clínica', notes: 'ok', remindersEnabled: false,
  });
  createVaccination(db, { petId: mimi.id, vaccineName: 'V4', appliedOn: '2026-09-01' });
  newAttachment(db, full.id);
  newAttachment(db, full.id);
  archivePet(db, mimi.id, 'rehomed', '2026-11-01');
  setSetting(db, 'backup_warning_days', 21);
  setSetting(db, 'due_soon_days', 45);
  setSetting(db, 'reminder_offsets_days', [14, 3, 0]);
  setSetting(db, 'last_backup_at', '2026-10-01T00:00:00.000Z');
  return db;
}

describe('buildBackupData', () => {
  it('produces a backup that passes backupSchema, with the envelope fields', () => {
    const data = buildBackupData(populate(), NOW, '1.2.3');
    expect(backupSchema.safeParse(data).success).toBe(true);
    expect(data).toMatchObject({ format: 'petvaccines-backup', schemaVersion: 1, appVersion: '1.2.3', exportedAt: '2026-11-12T14:03:00.000Z' });
  });

  it('includes archived pets and all records and attachments', () => {
    const data = buildBackupData(populate(), NOW, '1.0.0');
    expect(data.pets.map((p) => [p.name, p.status, p.archived_reason, p.archived_on]).sort()).toEqual([
      ['Mimi', 'archived', 'rehomed', '2026-11-01'],
      ['Thor', 'active', null, null],
    ]);
    expect(data.vaccinations).toHaveLength(2);
    expect(data.attachments).toHaveLength(2);
  });

  it('writes snake_case column names, nulls for empty optionals and a boolean', () => {
    const data = buildBackupData(populate(), NOW, '1.0.0');
    const rabies = data.vaccinations.find((v) => v.vaccine_name === 'Antirrábica');
    expect(rabies).toMatchObject({ catalog_id: 'br-dog-rabies', vet_license: 'CRMV-SP 1', reminders_enabled: false, next_due_on: '2027-10-02' });
    const v4 = data.vaccinations.find((v) => v.vaccine_name === 'V4');
    expect(v4).toMatchObject({ next_due_on: null, batch: null, reminders_enabled: true });
  });

  it('keeps only the three preferences in settings', () => {
    const data = buildBackupData(populate(), NOW, '1.0.0');
    expect(data.settings).toEqual({ backup_warning_days: 21, due_soon_days: 45, reminder_offsets_days: [14, 3, 0] });
  });

  it('uses the default settings on a fresh database', () => {
    expect(buildBackupData(createTestDb(), NOW, '1.0.0').settings).toEqual({
      backup_warning_days: 14, due_soon_days: 30, reminder_offsets_days: [7, 0],
    });
  });

  it('round-trips: database rows to backup rows and back equals the originals', () => {
    const db = populate();
    const data = buildBackupData(db, NOW, '1.0.0');
    const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));
    expect(byId(data.pets.map(petFromBackup))).toEqual(byId(db.select().from(pets).all()));
    expect(byId(data.vaccinations.map(vaccinationFromBackup))).toEqual(byId(db.select().from(vaccinations).all()));
    expect(byId(data.attachments.map(attachmentFromBackup))).toEqual(byId(db.select().from(attachments).all()));
    // and the other direction
    expect(byId(db.select().from(pets).all().map(petToBackup))).toEqual(byId(data.pets));
    expect(byId(db.select().from(vaccinations).all().map(vaccinationToBackup))).toEqual(byId(data.vaccinations));
    expect(byId(db.select().from(attachments).all().map(attachmentToBackup))).toEqual(byId(data.attachments));
  });
});
