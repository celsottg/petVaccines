// Task 2 rules working together, in the Review Focus scenarios.
import { splitCurrent, type CatalogMatcher } from './current';
import { todayLocal } from './dates';
import { suggestNextDue } from './nextDose';
import { getStatus, worstStatus } from './status';

describe('Review Focus 1 — local-day rollover in the Brazilian timezone', () => {
  it('at 22:00 on the due date the vaccine is due_soon, not overdue', () => {
    const now = new Date('2026-11-13T01:00:00Z'); // 22:00 in UTC-3; already the 13th in UTC
    const today = todayLocal(now);
    expect(today).toBe('2026-11-12');
    expect(getStatus('2026-11-12', today, 30)).toBe('due_soon');
    // with the UTC date (the bug this test guards against) it would show as overdue a day early
    expect(getStatus('2026-11-12', now.toISOString().slice(0, 10), 30)).toBe('overdue');
  });

  it('at 00:00 the next day it becomes overdue', () => {
    const today = todayLocal(new Date('2026-11-13T03:00:00Z'));
    expect(getStatus('2026-11-12', today, 30)).toBe('overdue');
  });
});

describe('Flow: register, add a booster and compute the pet badge', () => {
  const today = '2026-11-12';
  const mk = (id: string, name: string, appliedOn: string, interval = 365) => ({
    id,
    catalogId: null,
    vaccineName: name,
    appliedOn,
    createdAt: `${appliedOn}T12:00:00.000Z`,
    nextDueOn: suggestNextDue(appliedOn, interval),
  });

  it('the old (overdue) application stops counting after the booster; the pet badge only uses current records', () => {
    const list = [
      mk('rabies-2024', 'Antirrabica', '2024-11-28'), // next: 2025-11-28, overdue
      mk('rabies-2026', 'ANTIRRÁBICA ', today), // booster today, next: 2027-11-12
      mk('v10', 'V10', '2026-01-10'), // next: 2027-01-10
    ];
    const { current } = splitCurrent(list);
    expect(current.map((r) => r.id)).toEqual(['rabies-2026', 'v10']);
    const statuses = current.map((r) => getStatus(r.nextDueOn, today, 30));
    expect(statuses).toEqual(['ok', 'ok']);
    expect(worstStatus(statuses)).toBe('ok');
  });

  it('without the booster, the same vaccine gives the pet an overdue badge', () => {
    const { current } = splitCurrent([mk('rabies-2024', 'Antirrábica', '2024-11-28'), mk('v10', 'V10', '2026-01-10')]);
    const statuses = current.map((r) => getStatus(r.nextDueOn, today, 30));
    expect(worstStatus(statuses)).toBe('overdue');
  });

  it('a next dose suggested from today starts as ok', () => {
    const next = suggestNextDue(today, 365);
    expect(next).toBe('2027-11-12');
    expect(getStatus(next, today, 30)).toBe('ok');
  });
});

describe('Flow: a free-name record is matched to the catalog item', () => {
  const today = '2026-12-02';
  const match: CatalogMatcher = (n) => (n === 'antirrabica' ? 'br-dog-rabies' : undefined);
  const mk = (id: string, catalogId: string | null, name: string, appliedOn: string) => ({
    id,
    catalogId,
    vaccineName: name,
    appliedOn,
    createdAt: `${appliedOn}T12:00:00.000Z`,
    nextDueOn: suggestNextDue(appliedOn, 365),
  });

  it('the catalog booster replaces the free-name record, so the old one no longer drives the badge', () => {
    const list = [
      mk('free-2025', null, 'Antirrábica', '2025-12-02'), // next: 2026-12-02, due today
      mk('catalog-2026', 'br-dog-rabies', 'Raiva', '2026-12-01'), // next: 2027-12-01
    ];
    const { current, previous } = splitCurrent(list, match);
    expect(current.map((r) => r.id)).toEqual(['catalog-2026']);
    expect(previous.map((r) => r.id)).toEqual(['free-2025']);
    expect(worstStatus(current.map((r) => getStatus(r.nextDueOn, today, 30)))).toBe('ok');
    // without the matcher the old free-name record would still be current and due soon
    const unmatched = splitCurrent(list).current;
    expect(worstStatus(unmatched.map((r) => getStatus(r.nextDueOn, today, 30)))).toBe('due_soon');
  });
});
