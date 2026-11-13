import { eq } from 'drizzle-orm';

import { attachments, vaccinations } from '@/db/schema';

import { createTestDb } from './testDb';
import { newAttachment, newPet, newVaccination } from './testHelpers';
import {
  countVaccinationsCreatedAfter,
  createVaccination,
  createVaccinationWithPhotos,
  deleteVaccination,
  updateVaccination,
} from './vaccinations';

describe('createVaccination', () => {
  it('stores the record with reminders enabled by default', () => {
    const db = createTestDb();
    const pet = newPet(db);
    const v = createVaccination(db, {
      petId: pet.id,
      vaccineName: 'Antirrábica',
      appliedOn: '2026-11-01',
      nextDueOn: '2027-11-01',
      catalogId: 'br-dog-rabies',
    });
    expect(v).toMatchObject({
      petId: pet.id,
      catalogId: 'br-dog-rabies',
      appliedOn: '2026-11-01',
      nextDueOn: '2027-11-01',
      remindersEnabled: true,
      batch: null,
    });
  });

  it('rejects a vaccination for a pet that does not exist (foreign keys are enforced)', () => {
    expect(() => newVaccination(createTestDb(), 'missing')).toThrow();
  });
});

describe('updateVaccination', () => {
  it('replaces the editable fields and keeps the owner pet', () => {
    const db = createTestDb();
    const pet = newPet(db);
    const v = newVaccination(db, pet.id);
    const updated = updateVaccination(db, v.id, {
      vaccineName: 'V10',
      appliedOn: '2026-11-05',
      remindersEnabled: false,
      clinic: 'Clínica Vet',
    });
    expect(updated).toMatchObject({
      id: v.id,
      petId: pet.id,
      vaccineName: 'V10',
      appliedOn: '2026-11-05',
      remindersEnabled: false,
      clinic: 'Clínica Vet',
    });
  });

  it('throws for an unknown vaccination', () => {
    expect(() =>
      updateVaccination(createTestDb(), 'missing', { vaccineName: 'x', appliedOn: '2026-11-01' }),
    ).toThrow('Vaccination not found');
  });
});

describe('deleteVaccination', () => {
  it('removes the row and its attachments and returns their files', () => {
    const db = createTestDb();
    const pet = newPet(db);
    const v = newVaccination(db, pet.id);
    const a1 = newAttachment(db, v.id);
    const a2 = newAttachment(db, v.id);

    expect(deleteVaccination(db, v.id).sort()).toEqual([a1.file, a2.file].sort());
    expect(db.select().from(vaccinations).where(eq(vaccinations.id, v.id)).all()).toEqual([]);
    expect(db.select().from(attachments).all()).toEqual([]);
  });

  it('throws for an unknown vaccination', () => {
    expect(() => deleteVaccination(createTestDb(), 'missing')).toThrow('Vaccination not found');
  });
});

describe('countVaccinationsCreatedAfter', () => {
  it('counts all records for null and only newer ones for an instant', () => {
    jest.useFakeTimers({ now: new Date('2026-11-01T10:00:00Z') });
    try {
      const db = createTestDb();
      const pet = newPet(db);
      newVaccination(db, pet.id);
      jest.setSystemTime(new Date('2026-11-05T10:00:00Z'));
      newVaccination(db, pet.id);
      newVaccination(db, pet.id);

      expect(countVaccinationsCreatedAfter(db, null)).toBe(3);
      expect(countVaccinationsCreatedAfter(db, '2026-11-03T00:00:00.000Z')).toBe(2);
      // Strictly after: a record created exactly at the instant is not counted.
      expect(countVaccinationsCreatedAfter(db, '2026-11-05T10:00:00.000Z')).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('createVaccinationWithPhotos', () => {
  const photo = (n: number) => ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    file: `00000000-0000-4000-8000-00000000000${n}.jpg`,
    sizeBytes: 1000,
    width: 800,
    height: 600,
  });

  it('creates the record and links every photo in one transaction', () => {
    const db = createTestDb();
    const pet = newPet(db);

    const vaccination = createVaccinationWithPhotos(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-11-01' }, [
      photo(1),
      photo(2),
    ]);

    expect(
      db.select().from(attachments).all().map((row) => [row.id, row.vaccinationId, row.file]),
    ).toEqual([
      [photo(1).id, vaccination.id, photo(1).file],
      [photo(2).id, vaccination.id, photo(2).file],
    ]);
  });

  it('stores nothing when a photo cannot be linked, so a retry does not duplicate the record', () => {
    const db = createTestDb();
    const pet = newPet(db);

    expect(() =>
      createVaccinationWithPhotos(db, { petId: pet.id, vaccineName: 'V10', appliedOn: '2026-11-01' }, [
        photo(1),
        photo(2),
        photo(3),
        photo(4),
      ]),
    ).toThrow('ATTACHMENT_LIMIT');

    expect(db.select().from(vaccinations).all()).toEqual([]);
    expect(db.select().from(attachments).all()).toEqual([]);
  });
});
