import { addDays, diffDays, todayLocal } from './dates';

describe('todayLocal', () => {
  it('uses the device local date, not UTC (22:30 in UTC-3 is already the 13th in UTC)', () => {
    expect(todayLocal(new Date(2026, 10, 12, 22, 30))).toBe('2026-11-12');
  });

  it('pads month and day with zeros', () => {
    expect(todayLocal(new Date(2027, 0, 5, 0, 0))).toBe('2027-01-05');
  });
});

describe('addDays', () => {
  it('crosses the year boundary', () => {
    expect(addDays('2026-12-25', 7)).toBe('2027-01-01');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('accepts negative offsets', () => {
    expect(addDays('2026-11-12', -7)).toBe('2026-11-05');
  });
});

describe('diffDays', () => {
  it('returns a − b in days', () => {
    expect(diffDays('2026-12-02', '2026-11-12')).toBe(20);
  });

  it('is negative when a is before b', () => {
    expect(diffDays('2026-11-11', '2026-11-12')).toBe(-1);
  });

  it('counts whole days across a former Brazilian DST change', () => {
    // Brazil used DST until 2019; 2018-11-04 was a 23-hour day in São Paulo.
    expect(diffDays('2018-11-05', '2018-11-03')).toBe(2);
    expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
  });
});
