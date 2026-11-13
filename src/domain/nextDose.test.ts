import { addDays } from './dates';
import { suggestNextDue } from './nextDose';

describe('suggestNextDue', () => {
  it('adds the booster interval to the application date', () => {
    expect(suggestNextDue('2026-11-12', 365)).toBe('2027-11-12');
  });

  it('counts days, not years, across a leap day', () => {
    expect(suggestNextDue('2027-11-12', 365)).toBe('2028-11-11');
  });
});

describe('suggestNextDue — casos adicionais', () => {
  it.each([
    ['2026-11-12', 0, '2026-11-12'],
    ['2026-11-12', 21, '2026-12-03'],
    ['2026-11-12', 180, '2027-05-11'],
    ['2026-01-31', 30, '2026-03-02'], // dias, não meses
    ['2028-02-29', 365, '2029-02-28'], // aplicada em 29/02
    ['2028-02-29', 366, '2029-03-01'],
    ['2026-12-31', 365, '2027-12-31'],
  ])('suggestNextDue(%s, %i) = %s', (applied, interval, expected) => {
    expect(suggestNextDue(applied, interval)).toBe(expected);
  });

  it('é sempre posterior à aplicação para intervalos positivos (a validação da Task 6 exige nextDueOn > appliedOn)', () => {
    for (const interval of [1, 21, 365, 730]) {
      expect(suggestNextDue('2026-11-12', interval) > '2026-11-12').toBe(true);
    }
  });

  it('é igual a addDays com o intervalo', () => {
    expect(suggestNextDue('2026-11-12', 365)).toBe(addDays('2026-11-12', 365));
  });
});
