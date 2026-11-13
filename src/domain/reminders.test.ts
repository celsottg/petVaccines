import type { Pet, Vaccination } from '@/data/types';

import type { CatalogMatcher } from './current';
import { earliestReminderDay, planReminders, reminderFireDate } from './reminders';

const TODAY = '2026-11-12';
const noCatalog: CatalogMatcher = () => undefined;

const pet = (overrides: Partial<Pet> = {}): Pet => ({
  id: 'pet-1',
  name: 'Thor',
  species: 'dog',
  breed: null,
  sex: null,
  birthOn: null,
  photoFile: null,
  status: 'active',
  archivedReason: null,
  archivedOn: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

let seq = 0;
const vaccination = (overrides: Partial<Vaccination> = {}): Vaccination => {
  seq += 1;
  return {
    id: `vac-${seq}`,
    petId: 'pet-1',
    catalogId: null,
    vaccineName: `Vacina ${seq}`,
    appliedOn: '2025-12-02',
    nextDueOn: '2026-12-02',
    batch: null,
    brand: null,
    vetName: null,
    vetLicense: null,
    clinic: null,
    notes: null,
    remindersEnabled: true,
    createdAt: '2025-12-02T10:00:00.000Z',
    updatedAt: '2025-12-02T10:00:00.000Z',
    ...overrides,
  };
};

const plan = (pets: Pet[], vaccinations: Vaccination[], overrides: Partial<Parameters<typeof planReminders>[0]> = {}) =>
  planReminders({ pets, vaccinations, offsetsDays: [7, 0], today: TODAY, limit: 50, matcherFor: () => noCatalog, ...overrides });

describe('planReminders', () => {
  it('plans the 7-day and the same-day reminder for a current record due on 2026-12-02', () => {
    const v = vaccination({ vaccineName: 'Antirrábica' });
    expect(plan([pet()], [v])).toEqual([
      { vaccinationId: v.id, petName: 'Thor', vaccineName: 'Antirrábica', fireOn: '2026-11-25', daysBefore: 7 },
      { vaccinationId: v.id, petName: 'Thor', vaccineName: 'Antirrábica', fireOn: '2026-12-02', daysBefore: 0 },
    ]);
  });

  it('plans nothing for an archived pet', () => {
    expect(plan([pet({ status: 'archived' })], [vaccination()])).toEqual([]);
  });

  it('plans nothing for a previous application even when it still has a future next dose', () => {
    const previous = vaccination({ vaccineName: 'Antirrábica', appliedOn: '2024-12-02', nextDueOn: '2026-12-20' });
    const current = vaccination({ vaccineName: 'Antirrábica', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });
    const result = plan([pet()], [previous, current]);
    expect(result.map((r) => r.vaccinationId)).toEqual([current.id, current.id]);
    expect(plan([pet()], [previous]).map((r) => r.vaccinationId)).toEqual([previous.id, previous.id]);
  });

  it('uses the catalog matcher to decide that a free name and a catalog record are the same vaccine', () => {
    // Same vaccine ONLY through the matcher: different names, one without a catalog id.
    const older = vaccination({ vaccineName: 'Antirrábica', catalogId: null, appliedOn: '2024-12-02', nextDueOn: '2026-12-20' });
    const newer = vaccination({ vaccineName: 'Raiva', catalogId: 'dog-rabies', appliedOn: '2025-12-02', nextDueOn: '2026-12-02' });
    const matcherFor = jest.fn((species: 'dog' | 'cat'): CatalogMatcher => (name) => (name === 'antirrabica' ? `${species}-rabies` : undefined));

    const withMatcher = plan([pet()], [older, newer], { matcherFor });
    expect(new Set(withMatcher.map((r) => r.vaccinationId))).toEqual(new Set([newer.id]));
    expect(matcherFor).toHaveBeenCalledWith('dog');

    const withoutMatcher = plan([pet()], [older, newer]);
    expect(new Set(withoutMatcher.map((r) => r.vaccinationId))).toEqual(new Set([older.id, newer.id]));
  });

  it('plans nothing when reminders are disabled or there is no next dose', () => {
    expect(plan([pet()], [vaccination({ remindersEnabled: false })])).toEqual([]);
    expect(plan([pet()], [vaccination({ nextDueOn: null })])).toEqual([]);
  });

  it('keeps only the same-day reminder when the 7-day one has already passed', () => {
    const result = plan([pet()], [vaccination({ nextDueOn: '2026-11-15' })]);
    expect(result.map((r) => [r.fireOn, r.daysBefore])).toEqual([['2026-11-15', 0]]);
  });

  it('includes a reminder whose fire date is today', () => {
    const result = plan([pet()], [vaccination({ nextDueOn: TODAY })]);
    expect(result.map((r) => [r.fireOn, r.daysBefore])).toEqual([[TODAY, 0]]);
    const week = plan([pet()], [vaccination({ nextDueOn: '2026-11-19' })]);
    expect(week.map((r) => [r.fireOn, r.daysBefore])).toEqual([[TODAY, 7], ['2026-11-19', 0]]);
  });

  it('plans nothing for a due date that already passed', () => {
    expect(plan([pet()], [vaccination({ nextDueOn: '2026-11-11' })])).toEqual([]);
  });

  it('keeps the 50 nearest of 80 candidates, in ascending order', () => {
    const list = Array.from({ length: 40 }, (_, i) => {
      // Distinct due dates, shuffled so input order is not already sorted.
      const day = (i * 7) % 40;
      const due = new Date(Date.UTC(2026, 11, 1 + day, 12)).toISOString().slice(0, 10);
      return vaccination({ vaccineName: `Vacina ${i}`, nextDueOn: due });
    });
    const result = plan([pet()], list);
    expect(result).toHaveLength(50);
    const dates = result.map((r) => r.fireOn);
    expect(dates).toEqual([...dates].sort());
    const all = plan([pet()], list, { limit: 1000 });
    expect(all).toHaveLength(80);
    expect(result).toEqual(all.slice(0, 50));
  });

  it('deduplicates repeated offsets and follows the configured ones', () => {
    const result = plan([pet()], [vaccination()], { offsetsDays: [30, 30, 1] });
    // 30 days before 2026-12-02 is 2026-11-02, which already passed.
    expect(result.map((r) => [r.fireOn, r.daysBefore])).toEqual([['2026-12-01', 1]]);
  });

  it('scopes records to their own pet', () => {
    const rex = pet({ id: 'pet-2', name: 'Rex' });
    const a = vaccination({ vaccineName: 'Antirrábica', petId: 'pet-1' });
    const b = vaccination({ vaccineName: 'Antirrábica', petId: 'pet-2', nextDueOn: '2026-12-10' });
    const result = plan([pet(), rex], [a, b]);
    expect(new Set(result.map((r) => r.petName))).toEqual(new Set(['Thor', 'Rex']));
  });
});

describe('earliestReminderDay', () => {
  it('is today while 09:00 is still ahead', () => {
    expect(earliestReminderDay(new Date(2026, 10, 12, 8, 59, 59))).toBe('2026-11-12');
  });

  it('is tomorrow from 09:00 on, since a reminder at that instant is not in the future', () => {
    expect(earliestReminderDay(new Date(2026, 10, 12, 9, 0, 0))).toBe('2026-11-13');
    expect(earliestReminderDay(new Date(2026, 10, 12, 22, 0, 0))).toBe('2026-11-13');
  });

  it('is based on the local clock time, in the early morning too', () => {
    expect(earliestReminderDay(new Date(2026, 10, 12, 1, 0, 0))).toBe('2026-11-12');
  });
});

describe('reminderFireDate', () => {
  it('is 09:00 local on the calendar date, not a UTC instant', () => {
    const date = reminderFireDate('2026-12-02');
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 11, 2, 9]);
    expect(date.toISOString()).toBe('2026-12-02T12:00:00.000Z');
  });
});
