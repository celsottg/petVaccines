import { formatBrDate, maskBrDate, parseBrDate, parseOptionalBrDate } from './dateInput';

describe('maskBrDate', () => {
  it.each([
    ['', ''],
    ['1', '1'],
    ['12', '12'],
    ['121', '12/1'],
    ['1211', '12/11'],
    ['12112', '12/11/2'],
    ['12112026', '12/11/2026'],
    ['12/11/2026', '12/11/2026'],
    ['1a2b1c1', '12/11'],
    ['121120261234', '12/11/2026'],
  ])('masks %j as %j', (input, expected) => {
    expect(maskBrDate(input)).toBe(expected);
  });
});

describe('parseBrDate', () => {
  it('converts DD/MM/YYYY to an ISO date', () => {
    expect(parseBrDate('10/08/2023')).toBe('2023-08-10');
  });

  it('accepts a leap day only in leap years', () => {
    expect(parseBrDate('29/02/2024')).toBe('2024-02-29');
    expect(parseBrDate('29/02/2023')).toBeNull();
  });

  it.each(['31/02/2024', '00/01/2024', '32/01/2024', '10/13/2024', '10/00/2024', '1/1/2024', '10/08/23', '', 'abc', '10-08-2023'])(
    'rejects %j',
    (text) => {
      expect(parseBrDate(text)).toBeNull();
    },
  );
});

describe('formatBrDate', () => {
  it('converts an ISO date to DD/MM/YYYY', () => {
    expect(formatBrDate('2023-08-10')).toBe('10/08/2023');
  });

  it('round-trips with parseBrDate', () => {
    expect(parseBrDate(formatBrDate('2026-11-12'))).toBe('2026-11-12');
  });
});

describe('parseOptionalBrDate', () => {
  it('treats blank text as no date', () => {
    expect(parseOptionalBrDate('')).toEqual({ ok: true, value: null });
    expect(parseOptionalBrDate('   ')).toEqual({ ok: true, value: null });
  });

  it('parses a complete date', () => {
    expect(parseOptionalBrDate('10/08/2023')).toEqual({ ok: true, value: '2023-08-10' });
  });

  it('flags a partial or impossible date', () => {
    expect(parseOptionalBrDate('10/08')).toEqual({ ok: false });
    expect(parseOptionalBrDate('31/02/2024')).toEqual({ ok: false });
  });
});
