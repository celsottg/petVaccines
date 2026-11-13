import { suggestNextDue } from './nextDose';

describe('suggestNextDue', () => {
  it('adds the booster interval to the application date', () => {
    expect(suggestNextDue('2026-11-12', 365)).toBe('2027-11-12');
  });

  it('counts days, not years, across a leap day', () => {
    expect(suggestNextDue('2027-11-12', 365)).toBe('2028-11-11');
  });
});
