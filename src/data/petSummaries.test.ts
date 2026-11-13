import { eq } from 'drizzle-orm';

import { pets, vaccinations } from '@/db/schema';

import { buildPetSummaries } from './petSummaries';
import { archivePet } from './pets';
import { createTestDb } from './testDb';
import { newPet } from './testHelpers';
import { createVaccination } from './vaccinations';

const TODAY = '2026-11-12';

function setup() {
  const db = createTestDb();
  const vaccinate = (petId: string, vaccineName: string, appliedOn: string, nextDueOn: string | null) =>
    createVaccination(db, { petId, vaccineName, appliedOn, nextDueOn });
  const summaries = () =>
    buildPetSummaries(db.select().from(pets).all(), db.select().from(vaccinations).all(), 30, TODAY);
  return { db, vaccinate, summaries };
}

describe('buildPetSummaries', () => {
  it('has no badge counts for a pet without vaccinations', () => {
    const { db, summaries } = setup();
    newPet(db);
    expect(summaries()[0].badge).toEqual({ status: 'none', count: 0 });
  });

  it('uses the worst status among current records and counts them', () => {
    const { db, vaccinate, summaries } = setup();
    const pet = newPet(db);
    vaccinate(pet.id, 'Antirrábica', '2025-01-01', '2026-01-01'); // overdue
    vaccinate(pet.id, 'V10', '2026-10-01', '2026-11-20'); // due soon
    vaccinate(pet.id, 'Giárdia', '2026-10-01', '2026-11-05'); // overdue
    expect(summaries()[0].badge).toEqual({ status: 'overdue', count: 2 });
  });

  it('ignores previous records of the same vaccine', () => {
    const { db, vaccinate, summaries } = setup();
    const pet = newPet(db);
    vaccinate(pet.id, 'Antirrábica', '2025-01-01', '2026-01-01'); // overdue, superseded
    vaccinate(pet.id, 'antirrabica', '2026-10-01', '2027-10-01'); // current, ok
    expect(summaries()[0].badge).toEqual({ status: 'ok', count: 1 });
  });

  it('matches a free name to the catalog of the pet species when picking the current record', () => {
    const { db, vaccinate, summaries } = setup();
    const pet = newPet(db, { species: 'dog' });
    // Same catalog vaccine written two ways; only the later one is current.
    vaccinate(pet.id, 'Antirrábica', '2025-01-01', '2026-01-01');
    vaccinate(pet.id, 'ANTIRRÁBICA ', '2026-10-01', '2027-10-01');
    expect(summaries()[0].badge).toEqual({ status: 'ok', count: 1 });
  });

  it('does not mix vaccinations of other pets', () => {
    const { db, vaccinate, summaries } = setup();
    const a = newPet(db, { name: 'A' });
    const b = newPet(db, { name: 'B' });
    vaccinate(a.id, 'V10', '2025-01-01', '2026-01-01');
    const result = Object.fromEntries(summaries().map((s) => [s.pet.name, s.badge]));
    expect(result.A).toEqual({ status: 'overdue', count: 1 });
    expect(result.B).toEqual({ status: 'none', count: 0 });
    expect(b.id).toBeDefined();
  });

  it('gives an archived pet no badge', () => {
    const { db, vaccinate, summaries } = setup();
    const pet = newPet(db);
    vaccinate(pet.id, 'V10', '2025-01-01', '2026-01-01');
    archivePet(db, pet.id, 'deceased', null);
    expect(summaries()[0].badge).toBeNull();
  });

  it('respects the due-soon window and reads fresh data', () => {
    const { db, vaccinate } = setup();
    const pet = newPet(db);
    vaccinate(pet.id, 'V10', '2026-10-01', '2026-12-01'); // 19 days ahead
    const all = [db.select().from(pets).where(eq(pets.id, pet.id)).all(), db.select().from(vaccinations).all()] as const;
    expect(buildPetSummaries(all[0], all[1], 30, TODAY)[0].badge?.status).toBe('due_soon');
    expect(buildPetSummaries(all[0], all[1], 10, TODAY)[0].badge?.status).toBe('ok');
  });
});
