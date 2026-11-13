import { addAttachment } from '@/data/attachments';
import { archivePet, createPet } from '@/data/pets';
import { setSetting } from '@/data/settings';
import { createTestDb } from '@/data/testDb';
import { createVaccination } from '@/data/vaccinations';
import { attachments, pets, settings, vaccinations } from '@/db/schema';

import { buildBackupData } from './buildData';
import { replaceAllData } from './replaceAllData';
import { parseBackupJson } from './validate';

const dump = (db: ReturnType<typeof createTestDb>) => ({
  pets: db.select().from(pets).all().sort((a, b) => a.id.localeCompare(b.id)),
  vaccinations: db.select().from(vaccinations).all().sort((a, b) => a.id.localeCompare(b.id)),
  attachments: db.select().from(attachments).all().sort((a, b) => a.id.localeCompare(b.id)),
  settings: db
    .select()
    .from(settings)
    .all()
    .filter((row) => row.key !== 'last_backup_at' && row.key !== 'last_change_at')
    .sort((a, b) => a.key.localeCompare(b.key)),
});

describe('export then import (round trip)', () => {
  it('restores the database row for row, every column', () => {
    const db = createTestDb();
    const thor = createPet(db, {
      name: 'Thor', species: 'dog', breed: 'SRD', sex: 'male', birthOn: '2023-05-01',
      photoFile: '33333333-3333-4333-8333-333333333333.jpg',
    });
    const mimi = createPet(db, { name: 'Mimi', species: 'cat' });
    const bidu = createPet(db, { name: 'Bidu', species: 'dog', sex: 'female' });
    archivePet(db, bidu.id, 'rehomed', '2026-10-30');
    const full = createVaccination(db, {
      petId: thor.id, catalogId: 'br-dog-rabies', vaccineName: 'Antirrábica', appliedOn: '2026-10-02', nextDueOn: '2027-10-02',
      batch: 'L123', brand: 'Marca', vetName: 'Dra. Ana', vetLicense: 'CRMV-SP 1234', clinic: 'Clínica Pet', notes: 'Sem reação', remindersEnabled: false,
    });
    createVaccination(db, { petId: mimi.id, vaccineName: 'V4', appliedOn: '2026-10-04' });
    createVaccination(db, { petId: bidu.id, vaccineName: 'Gripe canina', appliedOn: '2026-01-04', nextDueOn: '2026-12-04' });
    addAttachment(db, { id: '44444444-4444-4444-8444-444444444444', vaccinationId: full.id, file: '44444444-4444-4444-8444-444444444444.jpg', sizeBytes: 123456, width: 1536, height: 2048 });
    addAttachment(db, { id: '55555555-5555-4555-8555-555555555555', vaccinationId: full.id, file: '55555555-5555-4555-8555-555555555555.jpg', sizeBytes: 9, width: 3, height: 2 });
    setSetting(db, 'backup_warning_days', 21);
    setSetting(db, 'due_soon_days', 45);
    setSetting(db, 'reminder_offsets_days', [30, 7, 1, 0]);
    const original = dump(db);

    // Through the file text, as a real backup goes.
    const text = JSON.stringify(buildBackupData(db, new Date('2026-11-13T12:00:00.000Z'), '1.0.0'));
    db.delete(attachments).run();
    db.delete(vaccinations).run();
    db.delete(pets).run();
    db.delete(settings).run();
    replaceAllData(db, parseBackupJson(text), []);

    expect(dump(db)).toEqual(original);
    expect(original.pets).toHaveLength(3);
    expect(original.settings).toHaveLength(3);
  });
});
