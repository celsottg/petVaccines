import { addAttachment } from '@/data/attachments';
import { createPet } from '@/data/pets';
import { getSettings, setSetting } from '@/data/settings';
import { createTestDb } from '@/data/testDb';
import { createVaccination } from '@/data/vaccinations';
import { attachments, pets, settings, vaccinations } from '@/db/schema';

import { replaceAllData } from './replaceAllData';
import { sampleBackup } from './fixture';
import type { BackupData } from './schema';

const PET_PHOTO = '33333333-3333-4333-8333-333333333333.jpg';
const PROOF = '44444444-4444-4444-8444-444444444444.jpg';

function deviceWithTwoPets() {
  const db = createTestDb();
  const a = createPet(db, { name: 'Old A', species: 'dog' });
  const b = createPet(db, { name: 'Old B', species: 'cat' });
  for (const pet of [a, b]) {
    const v = createVaccination(db, { petId: pet.id, vaccineName: 'Old vaccine', appliedOn: '2026-01-01' });
    addAttachment(db, { id: crypto.randomUUID(), vaccinationId: v.id, file: `${crypto.randomUUID()}.jpg`, sizeBytes: 1, width: 1, height: 1 });
  }
  setSetting(db, 'due_soon_days', 60);
  setSetting(db, 'last_backup_at', '2026-01-01T00:00:00.000Z');
  return db;
}

/** The sample backup reduced to one pet with its vaccination and attachment. */
function onePet(): BackupData {
  const data = sampleBackup();
  const [thor] = data.pets;
  const vaccinationRows = data.vaccinations.filter((v) => v.pet_id === thor.id);
  const ids = new Set(vaccinationRows.map((v) => v.id));
  return { ...data, pets: [thor], vaccinations: vaccinationRows, attachments: data.attachments.filter((a) => ids.has(a.vaccination_id)) };
}

describe('replaceAllData', () => {
  it('leaves exactly the backup: its pets, records, attachments and preferences', () => {
    const db = deviceWithTwoPets();
    const data = onePet();

    replaceAllData(db, data, []);

    expect(db.select().from(pets).all().map((p) => p.name)).toEqual(['Thor']);
    expect(db.select().from(vaccinations).all()).toHaveLength(data.vaccinations.filter((v) => v.pet_id === data.pets[0].id).length);
    expect(db.select().from(attachments).all().map((a) => a.file)).toEqual([PROOF]);
    expect(getSettings(db)).toMatchObject({ backupWarningDays: 14, dueSoonDays: 30, reminderOffsetsDays: [7, 0] });
  });

  it('sets both last_backup_at and last_change_at to the time of the backup', () => {
    const db = deviceWithTwoPets();
    const data = onePet();

    replaceAllData(db, data, []);

    expect(getSettings(db)).toMatchObject({ lastBackupAt: data.exportedAt, lastChangeAt: data.exportedAt });
  });

  it('does not insert attachments in the skip list and clears the photo of a pet in it', () => {
    const db = deviceWithTwoPets();

    replaceAllData(db, onePet(), [PROOF, PET_PHOTO]);

    expect(db.select().from(attachments).all()).toEqual([]);
    expect(db.select().from(pets).all()[0].photoFile).toBeNull();
    expect(db.select().from(vaccinations).all().length).toBeGreaterThan(0);
  });

  it('keeps a pet photo that is not in the skip list', () => {
    const db = createTestDb();

    replaceAllData(db, onePet(), [PROOF]);

    expect(db.select().from(pets).all()[0].photoFile).toBe(PET_PHOTO);
  });

  it('works on an empty database', () => {
    const db = createTestDb();

    replaceAllData(db, sampleBackup(), []);

    expect(db.select().from(pets).all()).toHaveLength(2);
  });

  it('rolls everything back when a step fails: pets, records and settings stay as they were', () => {
    const db = deviceWithTwoPets();
    const before = {
      pets: db.select().from(pets).all(),
      vaccinations: db.select().from(vaccinations).all(),
      attachments: db.select().from(attachments).all(),
      settings: db.select().from(settings).all(),
    };
    const broken = onePet();
    // The same id twice: the second insert fails after the old data was deleted and the first pet inserted.
    broken.pets = [broken.pets[0], { ...broken.pets[0] }];

    expect(() => replaceAllData(db, broken, [])).toThrow();

    expect({
      pets: db.select().from(pets).all(),
      vaccinations: db.select().from(vaccinations).all(),
      attachments: db.select().from(attachments).all(),
      settings: db.select().from(settings).all(),
    }).toEqual(before);
  });

  it('rolls back when a vaccination points to a pet that does not exist', () => {
    const db = deviceWithTwoPets();
    const broken = onePet();
    broken.vaccinations[0] = { ...broken.vaccinations[0], pet_id: '77777777-7777-4777-8777-777777777777' };

    expect(() => replaceAllData(db, broken, [])).toThrow();

    expect(db.select().from(pets).all()).toHaveLength(2);
  });
});

