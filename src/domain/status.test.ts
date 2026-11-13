import { getStatus, worstStatus } from './status';

const today = '2026-11-12';

describe('getStatus', () => {
  it('is ok when there is no next dose', () => {
    expect(getStatus(null, today, 30)).toBe('ok');
  });

  it('is ok when the next dose is more than dueSoonDays away (31 days)', () => {
    expect(getStatus('2026-12-13', today, 30)).toBe('ok');
  });

  it('is due_soon at exactly dueSoonDays (30 days)', () => {
    expect(getStatus('2026-12-12', today, 30)).toBe('due_soon');
  });

  it('is due_soon when it is due today', () => {
    expect(getStatus('2026-11-12', today, 30)).toBe('due_soon');
  });

  it('is overdue from the day after the due date', () => {
    expect(getStatus('2026-11-11', today, 30)).toBe('overdue');
  });
});

describe('worstStatus', () => {
  it('picks overdue over due_soon over ok', () => {
    expect(worstStatus(['ok', 'overdue', 'due_soon'])).toBe('overdue');
    expect(worstStatus(['ok', 'due_soon'])).toBe('due_soon');
    expect(worstStatus(['ok'])).toBe('ok');
  });

  it('returns null for an empty list', () => {
    expect(worstStatus([])).toBeNull();
  });
});
