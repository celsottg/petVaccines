import { addAttachment, deleteAttachment } from './attachments';
import { archivePet, createPet, deletePet, reactivatePet, updatePet } from './pets';
import { getSettings, setSetting, touchLastChange } from './settings';
import { createTestDb } from './testDb';
import { newAttachment, newPet, newVaccination } from './testHelpers';
import { createVaccination, deleteVaccination, updateVaccination } from './vaccinations';

describe('getSettings', () => {
  it('returns the defaults on a fresh database', () => {
    expect(getSettings(createTestDb())).toEqual({
      lastBackupAt: null,
      lastChangeAt: null,
      backupWarningDays: 14,
      dueSoonDays: 30,
      reminderOffsetsDays: [7, 0],
    });
  });
});

describe('setSetting', () => {
  it('round-trips strings, numbers, arrays and null, overwriting earlier values', () => {
    const db = createTestDb();
    setSetting(db, 'last_backup_at', '2026-11-01T10:00:00.000Z');
    setSetting(db, 'due_soon_days', 45);
    setSetting(db, 'due_soon_days', 60);
    setSetting(db, 'reminder_offsets_days', [14, 7, 0]);
    expect(getSettings(db)).toMatchObject({
      lastBackupAt: '2026-11-01T10:00:00.000Z',
      dueSoonDays: 60,
      reminderOffsetsDays: [14, 7, 0],
    });

    setSetting(db, 'last_backup_at', null);
    expect(getSettings(db).lastBackupAt).toBeNull();
  });
});

describe('touchLastChange', () => {
  it('stores the current instant', () => {
    jest.useFakeTimers({ now: new Date('2026-11-12T15:30:00Z') });
    try {
      const db = createTestDb();
      touchLastChange(db);
      expect(getSettings(db).lastChangeAt).toBe('2026-11-12T15:30:00.000Z');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('lastChangeAt on writes', () => {
  // Every write or delete of a pet, vaccination or attachment must move lastChangeAt.
  let tick = 0;
  beforeEach(() => {
    tick = 0;
    jest.useFakeTimers({ now: new Date('2026-11-01T00:00:00Z') });
  });
  afterEach(() => jest.useRealTimers());

  function touchedBy(setup: (db: ReturnType<typeof createTestDb>) => () => void) {
    const db = createTestDb();
    const action = setup(db);
    const before = getSettings(db).lastChangeAt;
    tick += 1;
    jest.setSystemTime(new Date(`2026-11-0${tick + 1}T00:00:00Z`));
    action();
    const after = getSettings(db).lastChangeAt;
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
    expect(after).toBe(new Date().toISOString());
  }

  it.each([
    ['createPet', (db: ReturnType<typeof createTestDb>) => () => void createPet(db, { name: 'A', species: 'dog' })],
    [
      'updatePet',
      (db: ReturnType<typeof createTestDb>) => {
        const p = newPet(db);
        return () => void updatePet(db, p.id, { name: 'B', species: 'dog' });
      },
    ],
    [
      'archivePet',
      (db: ReturnType<typeof createTestDb>) => {
        const p = newPet(db);
        return () => archivePet(db, p.id, 'rehomed', null);
      },
    ],
    [
      'reactivatePet',
      (db: ReturnType<typeof createTestDb>) => {
        const p = newPet(db);
        archivePet(db, p.id, 'rehomed', null);
        return () => reactivatePet(db, p.id);
      },
    ],
    [
      'deletePet',
      (db: ReturnType<typeof createTestDb>) => {
        const p = newPet(db);
        return () => void deletePet(db, p.id);
      },
    ],
    [
      'createVaccination',
      (db: ReturnType<typeof createTestDb>) => {
        const p = newPet(db);
        return () => void createVaccination(db, { petId: p.id, vaccineName: 'V', appliedOn: '2026-11-01' });
      },
    ],
    [
      'updateVaccination',
      (db: ReturnType<typeof createTestDb>) => {
        const v = newVaccination(db, newPet(db).id);
        return () => void updateVaccination(db, v.id, { vaccineName: 'W', appliedOn: '2026-11-02' });
      },
    ],
    [
      'deleteVaccination',
      (db: ReturnType<typeof createTestDb>) => {
        const v = newVaccination(db, newPet(db).id);
        return () => void deleteVaccination(db, v.id);
      },
    ],
    [
      'addAttachment',
      (db: ReturnType<typeof createTestDb>) => {
        const v = newVaccination(db, newPet(db).id);
        return () =>
          void addAttachment(db, { id: 'x', vaccinationId: v.id, file: 'x.jpg', sizeBytes: 1, width: 1, height: 1 });
      },
    ],
    [
      'deleteAttachment',
      (db: ReturnType<typeof createTestDb>) => {
        const a = newAttachment(db, newVaccination(db, newPet(db).id).id);
        return () => void deleteAttachment(db, a.id);
      },
    ],
  ])('%s updates lastChangeAt', (_name, setup) => touchedBy(setup));

  it('does not move lastChangeAt when a write is rejected', () => {
    const db = createTestDb();
    const v = newVaccination(db, newPet(db).id);
    for (let i = 0; i < 3; i += 1) newAttachment(db, v.id);
    const before = getSettings(db).lastChangeAt;
    jest.setSystemTime(new Date('2026-12-01T00:00:00Z'));
    expect(() => newAttachment(db, v.id)).toThrow('ATTACHMENT_LIMIT');
    expect(getSettings(db).lastChangeAt).toBe(before);
  });
});
