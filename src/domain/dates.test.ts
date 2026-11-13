import { addDays, diffDays, todayLocal } from './dates';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

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

describe('todayLocal — relógio do sistema e virada do dia (Review Focus 1)', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    // instante UTC, data local esperada em America/Sao_Paulo (UTC-3)
    ['2026-11-13T01:30:00Z', '2026-11-12'], // 22:30 local: em UTC já é dia 13
    ['2026-11-13T02:59:59.999Z', '2026-11-12'], // 23:59:59.999 local
    ['2026-11-13T03:00:00Z', '2026-11-13'], // 00:00:00 local
    ['2026-11-13T12:00:00Z', '2026-11-13'],
    ['2027-01-01T02:59:59Z', '2026-12-31'], // virada de ano: ainda 31/12 no Brasil
    ['2027-01-01T03:00:00Z', '2027-01-01'],
    ['2028-03-01T02:00:00Z', '2028-02-29'], // virada de mês em ano bissexto
  ])('sem argumento, usa o relógio do sistema: %s -> %s', (instant, expected) => {
    jest.useFakeTimers().setSystemTime(new Date(instant));
    expect(todayLocal()).toBe(expected);
  });

  it('recebe um instante absoluto (não só datas montadas com componentes locais)', () => {
    expect(todayLocal(new Date('2026-11-13T01:30:00Z'))).toBe('2026-11-12');
    expect(todayLocal(new Date('2026-11-13T03:00:00Z'))).toBe('2026-11-13');
  });

  it('cobre os limites do dia local: 00:00:00.000 e 23:59:59.999', () => {
    expect(todayLocal(new Date(2026, 10, 12, 0, 0, 0, 0))).toBe('2026-11-12');
    expect(todayLocal(new Date(2026, 10, 12, 23, 59, 59, 999))).toBe('2026-11-12');
  });

  it('sempre devolve YYYY-MM-DD', () => {
    expect(todayLocal(new Date(2026, 0, 1))).toMatch(ISO);
    expect(todayLocal(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });
});

describe('addDays — casos adicionais', () => {
  it('com 0 dias devolve a mesma data', () => {
    expect(addDays('2026-11-12', 0)).toBe('2026-11-12');
  });

  it.each([
    ['2026-01-31', 1, '2026-02-01'],
    ['2026-04-30', 1, '2026-05-01'],
    ['2027-02-28', 1, '2027-03-01'], // ano comum
    ['2100-02-28', 1, '2100-03-01'], // 2100 não é bissexto
    ['2000-02-28', 2, '2000-03-01'], // 2000 é bissexto
    ['2026-12-31', 1, '2027-01-01'],
    ['2027-01-01', -1, '2026-12-31'],
    ['2026-03-01', -1, '2026-02-28'],
    ['2028-03-01', -1, '2028-02-29'],
    ['2026-11-12', 30, '2026-12-12'],
    ['2026-11-12', -30, '2026-10-13'],
    ['2026-11-12', 365, '2027-11-12'],
    ['2028-02-29', 365, '2029-02-28'],
    ['2026-11-12', 3650, '2036-11-09'],
  ])('addDays(%s, %i) = %s', (date, days, expected) => {
    expect(addDays(date, days)).toBe(expected);
  });

  it('atravessa as duas viradas do antigo horário de verão do Brasil sem pular nem repetir dia', () => {
    // 2018-11-04: dia de 23 h (início). 2019-02-17: dia de 25 h (fim).
    expect(addDays('2018-11-03', 1)).toBe('2018-11-04');
    expect(addDays('2018-11-04', 1)).toBe('2018-11-05');
    expect(addDays('2019-02-16', 1)).toBe('2019-02-17');
    expect(addDays('2019-02-17', 1)).toBe('2019-02-18');
    expect(diffDays('2019-02-18', '2019-02-16')).toBe(2);
  });
});

describe('diffDays — casos adicionais', () => {
  it('é zero para a mesma data', () => {
    expect(diffDays('2026-11-12', '2026-11-12')).toBe(0);
  });

  it('é antissimétrico: diffDays(a, b) = -diffDays(b, a)', () => {
    expect(diffDays('2026-11-12', '2026-12-02')).toBe(-diffDays('2026-12-02', '2026-11-12'));
  });

  it('conta 365 dias em ano comum e 366 em ano bissexto', () => {
    expect(diffDays('2027-01-01', '2026-01-01')).toBe(365);
    expect(diffDays('2029-01-01', '2028-01-01')).toBe(366);
  });

  it('funciona entre meses e anos diferentes', () => {
    expect(diffDays('2027-03-01', '2026-11-12')).toBe(109);
    expect(diffDays('2026-11-12', '2027-03-01')).toBe(-109);
  });
});

describe('propriedade: addDays e diffDays são inversas (2016-2031, todos os dias)', () => {
  const offsets = [-400, -31, -1, 0, 1, 7, 30, 365, 366];

  it('diffDays(addDays(d, n), d) === n e o resultado é sempre YYYY-MM-DD', () => {
    const failures: string[] = [];
    for (let d = '2016-01-01'; d <= '2031-12-31'; d = addDays(d, 1)) {
      for (const n of offsets) {
        const r = addDays(d, n);
        if (!ISO.test(r) || diffDays(r, d) !== n || addDays(r, -n) !== d) failures.push(`${d} + ${n}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('avançar um dia por vez nunca repete nem pula data', () => {
    let prev = '2016-01-01';
    for (let i = 1; i <= 5800; i++) {
      const next = addDays(prev, 1);
      if (diffDays(next, prev) !== 1) throw new Error(`salto inesperado: ${prev} -> ${next}`);
      prev = next;
    }
    expect(prev).toBe(addDays('2016-01-01', 5800));
  });
});
