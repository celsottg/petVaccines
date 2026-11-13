import { eq } from 'drizzle-orm';

import { attachments } from '@/db/schema';

import { addAttachment, deleteAttachment } from './attachments';
import { createTestDb } from './testDb';
import { newAttachment, newPet, newVaccination } from './testHelpers';

describe('addAttachment', () => {
  it('stores the row with a creation instant', () => {
    const db = createTestDb();
    const v = newVaccination(db, newPet(db).id);
    const row = addAttachment(db, {
      id: 'a1',
      vaccinationId: v.id,
      file: 'a1.jpg',
      sizeBytes: 2048,
      width: 1200,
      height: 900,
    });
    expect(row).toMatchObject({ id: 'a1', vaccinationId: v.id, file: 'a1.jpg', sizeBytes: 2048 });
    expect(row.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('throws ATTACHMENT_LIMIT on the fourth attachment of the same vaccination', () => {
    const db = createTestDb();
    const v = newVaccination(db, newPet(db).id);
    newAttachment(db, v.id);
    newAttachment(db, v.id);
    newAttachment(db, v.id);

    expect(() => newAttachment(db, v.id)).toThrow('ATTACHMENT_LIMIT');
    expect(db.select().from(attachments).all()).toHaveLength(3);
  });

  it('counts the limit per vaccination', () => {
    const db = createTestDb();
    const pet = newPet(db);
    const v1 = newVaccination(db, pet.id);
    const v2 = newVaccination(db, pet.id, 'V10');
    for (let i = 0; i < 3; i += 1) newAttachment(db, v1.id);
    expect(() => newAttachment(db, v2.id)).not.toThrow();
  });
});

describe('deleteAttachment', () => {
  it('removes the row and returns its file name', () => {
    const db = createTestDb();
    const v = newVaccination(db, newPet(db).id);
    const a = newAttachment(db, v.id);
    expect(deleteAttachment(db, a.id)).toBe(a.file);
    expect(db.select().from(attachments).where(eq(attachments.id, a.id)).all()).toEqual([]);
  });

  it('throws for an unknown attachment', () => {
    expect(() => deleteAttachment(createTestDb(), 'missing')).toThrow('Attachment not found');
  });
});
