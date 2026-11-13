import { eq } from 'drizzle-orm';

import { attachments, pets, vaccinations } from '@/db/schema';

import { archivePet, createPet, deletePet, reactivatePet, updatePet } from './pets';
import { createTestDb } from './testDb';
import { newAttachment, newPet, newVaccination } from './testHelpers';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('createPet', () => {
  it('returns an active pet with a UUID id and timestamps', () => {
    const pet = createPet(createTestDb(), { name: 'Mia', species: 'cat', breed: 'SRD' });
    expect(pet.status).toBe('active');
    expect(pet.id).toMatch(UUID);
    expect(pet).toMatchObject({ name: 'Mia', species: 'cat', breed: 'SRD', sex: null, archivedReason: null });
    expect(pet.createdAt).toBe(pet.updatedAt);
  });
});

describe('updatePet', () => {
  it('replaces the editable fields and bumps updatedAt', () => {
    jest.useFakeTimers({ now: new Date('2026-11-01T10:00:00Z') });
    try {
      const db = createTestDb();
      const pet = newPet(db, { breed: 'Poodle' });
      jest.setSystemTime(new Date('2026-11-02T10:00:00Z'));
      const updated = updatePet(db, pet.id, { name: 'Max', species: 'dog', sex: 'male' });
      expect(updated).toMatchObject({ id: pet.id, name: 'Max', sex: 'male', breed: null });
      expect(updated.createdAt).toBe('2026-11-01T10:00:00.000Z');
      expect(updated.updatedAt).toBe('2026-11-02T10:00:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });

  it('throws for an unknown pet', () => {
    expect(() => updatePet(createTestDb(), 'missing', { name: 'x', species: 'dog' })).toThrow('Pet not found');
  });
});

describe('archivePet and reactivatePet', () => {
  it('archivePet stores status, reason and date; reactivatePet clears them', () => {
    const db = createTestDb();
    const pet = newPet(db);

    archivePet(db, pet.id, 'deceased', '2026-11-12');
    const archived = db.select().from(pets).where(eq(pets.id, pet.id)).get();
    expect(archived).toMatchObject({ status: 'archived', archivedReason: 'deceased', archivedOn: '2026-11-12' });

    reactivatePet(db, pet.id);
    const active = db.select().from(pets).where(eq(pets.id, pet.id)).get();
    expect(active).toMatchObject({ status: 'active', archivedReason: null, archivedOn: null });
  });

  it('accepts a null archive date', () => {
    const db = createTestDb();
    const pet = newPet(db);
    archivePet(db, pet.id, 'other', null);
    expect(db.select().from(pets).get()).toMatchObject({ archivedReason: 'other', archivedOn: null });
  });

  it('throws for an unknown pet', () => {
    const db = createTestDb();
    expect(() => archivePet(db, 'missing', 'other', null)).toThrow('Pet not found');
    expect(() => reactivatePet(db, 'missing')).toThrow('Pet not found');
  });
});

describe('deletePet', () => {
  it('removes the pet, its vaccinations and attachments, and returns 4 files', () => {
    const db = createTestDb();
    const pet = newPet(db, { photoFile: 'pet-photo.jpg' });
    const other = newPet(db, { name: 'Other' });
    const v1 = newVaccination(db, pet.id);
    const v2 = newVaccination(db, pet.id, 'V10');
    const otherVaccination = newVaccination(db, other.id);
    const a1 = newAttachment(db, v1.id);
    const a2 = newAttachment(db, v1.id);
    const a3 = newAttachment(db, v2.id);
    const otherAttachment = newAttachment(db, otherVaccination.id);

    const files = deletePet(db, pet.id);

    expect(files).toHaveLength(4);
    expect(files.sort()).toEqual(['pet-photo.jpg', a1.file, a2.file, a3.file].sort());
    // Only the other pet's rows survive, so the cascade ran and foreign keys are enforced.
    expect(db.select().from(pets).all().map((p) => p.id)).toEqual([other.id]);
    expect(db.select().from(vaccinations).all().map((v) => v.id)).toEqual([otherVaccination.id]);
    expect(db.select().from(attachments).all().map((a) => a.id)).toEqual([otherAttachment.id]);
  });

  it('returns no files for a pet without photo or attachments', () => {
    const db = createTestDb();
    expect(deletePet(db, newPet(db).id)).toEqual([]);
  });

  it('throws for an unknown pet', () => {
    expect(() => deletePet(createTestDb(), 'missing')).toThrow('Pet not found');
  });
});
