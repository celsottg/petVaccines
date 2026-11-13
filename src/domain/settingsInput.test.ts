import { validateSettingsInput } from './settingsInput';

describe('validateSettingsInput', () => {
  it('accepts valid values and sorts the offsets from the farthest to the day itself', () => {
    expect(validateSettingsInput({ dueSoonDays: ' 30 ', offsets: ['0', '7', '14'] })).toEqual({
      ok: true,
      value: { dueSoonDays: 30, reminderOffsetsDays: [14, 7, 0] },
    });
  });

  it.each(['', 'abc', '0', '-5', '1.5', '1,5', '366', '1e2', ' '])('rejects %p as the due-soon window', (text) => {
    const result = validateSettingsInput({ dueSoonDays: text, offsets: ['7'] });
    expect(result).toMatchObject({ ok: false, errors: { dueSoonDays: 'dueSoonInvalid' } });
  });

  it('accepts the bounds 1 and 365 for the due-soon window and 0 and 365 for offsets', () => {
    expect(validateSettingsInput({ dueSoonDays: '1', offsets: ['0'] }).ok).toBe(true);
    expect(validateSettingsInput({ dueSoonDays: '365', offsets: ['365'] }).ok).toBe(true);
  });

  it.each(['', 'x', '-1', '2.5', '366'])('rejects %p as an offset, pointing at its position', (text) => {
    const result = validateSettingsInput({ dueSoonDays: '30', offsets: ['7', text] });
    expect(result).toMatchObject({ ok: false, errors: { offsets: [undefined, 'offsetInvalid'] } });
  });

  it('rejects a duplicate offset on the later one', () => {
    const result = validateSettingsInput({ dueSoonDays: '30', offsets: ['7', '0', '7'] });
    expect(result).toMatchObject({ ok: false, errors: { offsets: [undefined, undefined, 'offsetDuplicate'] } });
  });

  it('treats 07 and 7 as the same offset', () => {
    const result = validateSettingsInput({ dueSoonDays: '30', offsets: ['7', '07'] });
    expect(result).toMatchObject({ ok: false, errors: { offsets: [undefined, 'offsetDuplicate'] } });
  });

  it('requires at least one offset', () => {
    expect(validateSettingsInput({ dueSoonDays: '30', offsets: [] })).toMatchObject({
      ok: false,
      errors: { offsetsRequired: true },
    });
  });

  it('reports every problem at once', () => {
    const result = validateSettingsInput({ dueSoonDays: '0', offsets: ['x'] });
    expect(result).toMatchObject({ ok: false, errors: { dueSoonDays: 'dueSoonInvalid', offsets: ['offsetInvalid'] } });
  });
});
