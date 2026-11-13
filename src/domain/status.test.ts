import { addDays } from './dates';
import { getStatus, worstStatus, type VaccinationStatus } from './status';

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

describe('getStatus — fronteiras em todos os dias de -3 a +35 (dueSoonDays = 30)', () => {
  it.each(Array.from({ length: 39 }, (_, i) => i - 3))('vence em %i dia(s)', (offset) => {
    const expected: VaccinationStatus = offset < 0 ? 'overdue' : offset <= 30 ? 'due_soon' : 'ok';
    expect(getStatus(addDays(today, offset), today, 30)).toBe(expected);
  });
});

describe('getStatus — janela configurável (Task 8 permite mudar dueSoonDays)', () => {
  it('dueSoonDays = 0: só o dia do vencimento é due_soon', () => {
    expect(getStatus('2026-11-11', today, 0)).toBe('overdue');
    expect(getStatus('2026-11-12', today, 0)).toBe('due_soon');
    expect(getStatus('2026-11-13', today, 0)).toBe('ok');
  });

  it('dueSoonDays = 7: dia 7 é due_soon e dia 8 é ok', () => {
    expect(getStatus('2026-11-19', today, 7)).toBe('due_soon');
    expect(getStatus('2026-11-20', today, 7)).toBe('ok');
  });

  it('dueSoonDays = 90 alcança datas de outro mês e de outro ano', () => {
    expect(getStatus('2027-02-10', today, 90)).toBe('due_soon'); // 90 dias
    expect(getStatus('2027-02-11', today, 90)).toBe('ok'); // 91 dias
  });
});

describe('getStatus — virada de mês/ano e extremos', () => {
  it('conta dias através da virada do ano', () => {
    expect(getStatus('2027-01-05', '2026-12-20', 30)).toBe('due_soon');
    expect(getStatus('2026-12-31', '2027-01-01', 30)).toBe('overdue');
  });

  it('vencida há um ano continua overdue; daqui a 10 anos continua ok', () => {
    expect(getStatus('2025-11-12', today, 30)).toBe('overdue');
    expect(getStatus('2036-11-12', today, 30)).toBe('ok');
  });

  it('é determinística: depende só dos argumentos, não do relógio', () => {
    jest.useFakeTimers().setSystemTime(new Date('2030-01-01T12:00:00Z'));
    try {
      expect(getStatus('2026-12-12', today, 30)).toBe('due_soon');
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('worstStatus — casos adicionais', () => {
  const all: VaccinationStatus[] = ['ok', 'due_soon', 'overdue'];

  it('devolve o próprio valor para lista de um item', () => {
    for (const s of all) expect(worstStatus([s])).toBe(s);
  });

  it('não depende da ordem (todas as permutações de ok/due_soon/overdue)', () => {
    const perms: VaccinationStatus[][] = [
      ['ok', 'due_soon', 'overdue'],
      ['ok', 'overdue', 'due_soon'],
      ['due_soon', 'ok', 'overdue'],
      ['due_soon', 'overdue', 'ok'],
      ['overdue', 'ok', 'due_soon'],
      ['overdue', 'due_soon', 'ok'],
    ];
    for (const p of perms) expect(worstStatus(p)).toBe('overdue');
  });

  it('aceita repetidos', () => {
    expect(worstStatus(['ok', 'ok', 'ok'])).toBe('ok');
    expect(worstStatus(['due_soon', 'ok', 'due_soon'])).toBe('due_soon');
    expect(worstStatus(['overdue', 'overdue'])).toBe('overdue');
  });

  it('não altera a lista recebida', () => {
    const input: VaccinationStatus[] = ['overdue', 'ok', 'due_soon'];
    worstStatus(input);
    expect(input).toEqual(['overdue', 'ok', 'due_soon']);
  });
});
