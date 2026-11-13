import { petAge } from './age';

const today = '2026-11-12';

describe('petAge', () => {
  it('returns null without a birth date', () => {
    expect(petAge(null, today)).toBeNull();
  });

  it('counts whole years from one year on', () => {
    expect(petAge('2023-08-10', today)).toEqual({ unit: 'years', count: 3 });
    expect(petAge('2025-11-12', today)).toEqual({ unit: 'years', count: 1 });
  });

  it('does not count a year before the birthday', () => {
    expect(petAge('2025-11-13', today)).toEqual({ unit: 'months', count: 11 });
  });

  it('counts whole months under one year', () => {
    expect(petAge('2026-03-12', today)).toEqual({ unit: 'months', count: 8 });
    expect(petAge('2026-03-13', today)).toEqual({ unit: 'months', count: 7 });
  });

  it('reports under a month', () => {
    expect(petAge('2026-10-13', today)).toEqual({ unit: 'lessThanMonth', count: 0 });
    expect(petAge('2026-11-12', today)).toEqual({ unit: 'lessThanMonth', count: 0 });
  });

  it('handles month ends and leap days without throwing', () => {
    expect(petAge('2024-02-29', '2025-02-28')).toEqual({ unit: 'months', count: 11 });
    expect(petAge('2024-02-29', '2025-03-01')).toEqual({ unit: 'years', count: 1 });
  });
});
