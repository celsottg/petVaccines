import { archiveInputSchema, petInputSchema, vaccinationInputSchema } from './validation';

const schema = petInputSchema('2026-11-12');

describe('petInputSchema', () => {
  it('accepts only name and species', () => {
    expect(schema.safeParse({ name: 'Thor', species: 'dog' }).success).toBe(true);
  });

  it('trims the name', () => {
    const result = schema.safeParse({ name: '  Thor  ', species: 'dog' });
    expect(result.success && result.data.name).toBe('Thor');
  });

  it.each(['', '   '])('rejects an empty name (%j)', (name) => {
    const result = schema.safeParse({ name, species: 'dog' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ['name'], message: 'required' });
  });

  it('rejects an unknown species', () => {
    expect(schema.safeParse({ name: 'Piu', species: 'bird' }).success).toBe(false);
  });

  it('rejects a birth date in the future', () => {
    const result = schema.safeParse({ name: 'Thor', species: 'dog', birthOn: '2026-11-13' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['birthOn'], message: 'future_date' });
  });

  it('accepts a birth date today', () => {
    expect(schema.safeParse({ name: 'Thor', species: 'dog', birthOn: '2026-11-12' }).success).toBe(true);
  });

  it('rejects a birth date that is not a real calendar date', () => {
    const result = schema.safeParse({ name: 'Thor', species: 'dog', birthOn: '2024-02-31' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['birthOn'], message: 'invalid_date' });
  });

  it('accepts null for the optional fields', () => {
    const input = { name: 'Thor', species: 'cat', breed: null, sex: null, birthOn: null, photoFile: null };
    expect(schema.safeParse(input).success).toBe(true);
  });
});

describe('archiveInputSchema', () => {
  const archive = archiveInputSchema('2026-11-12');

  it('accepts a reason without a date', () => {
    expect(archive.safeParse({ reason: 'deceased', on: null }).success).toBe(true);
  });

  it('accepts today and past dates, rejects future ones', () => {
    expect(archive.safeParse({ reason: 'rehomed', on: '2026-11-12' }).success).toBe(true);
    expect(archive.safeParse({ reason: 'rehomed', on: '2026-11-13' }).error?.issues[0].message).toBe('future_date');
  });

  it('rejects an unknown reason', () => {
    expect(archive.safeParse({ reason: 'lost', on: null }).success).toBe(false);
  });
});

describe('vaccinationInputSchema', () => {
  const vaccination = vaccinationInputSchema({ today: '2026-11-12', birthOn: '2023-08-10' });

  it('accepts only the vaccine name and the application date', () => {
    expect(vaccination.safeParse({ vaccineName: 'Antirrábica', appliedOn: '2026-11-12' }).success).toBe(true);
  });

  it('trims the vaccine name and rejects an empty one', () => {
    const trimmed = vaccination.safeParse({ vaccineName: '  Giárdia ', appliedOn: '2026-11-12' });
    expect(trimmed.success && trimmed.data.vaccineName).toBe('Giárdia');
    const empty = vaccination.safeParse({ vaccineName: '   ', appliedOn: '2026-11-12' });
    expect(empty.error?.issues[0]).toMatchObject({ path: ['vaccineName'], message: 'required' });
  });

  it('rejects an application date in the future', () => {
    const result = vaccination.safeParse({ vaccineName: 'V10', appliedOn: '2026-11-13' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['appliedOn'], message: 'future_date' });
  });

  it('rejects an application date before the pet was born, and accepts the birth date itself', () => {
    const before = vaccination.safeParse({ vaccineName: 'V10', appliedOn: '2023-08-09' });
    expect(before.error?.issues[0]).toMatchObject({ path: ['appliedOn'], message: 'before_birth' });
    expect(vaccination.safeParse({ vaccineName: 'V10', appliedOn: '2023-08-10' }).success).toBe(true);
  });

  it('does not apply the birth rule when the birth date is unknown', () => {
    const unknownBirth = vaccinationInputSchema({ today: '2026-11-12', birthOn: null });
    expect(unknownBirth.safeParse({ vaccineName: 'V10', appliedOn: '1990-01-01' }).success).toBe(true);
  });

  it.each(['2026-11-01', '2026-10-01'])('rejects a next dose on or before the application date (%s)', (nextDueOn) => {
    const result = vaccination.safeParse({ vaccineName: 'V10', appliedOn: '2026-11-01', nextDueOn });
    expect(result.error?.issues[0]).toMatchObject({ path: ['nextDueOn'], message: 'next_not_after' });
  });

  it('accepts a next dose after the application date, in the future', () => {
    const result = vaccination.safeParse({ vaccineName: 'V10', appliedOn: '2026-11-01', nextDueOn: '2027-11-01' });
    expect(result.success).toBe(true);
  });

  it('rejects a next dose that is not a real calendar date', () => {
    const result = vaccination.safeParse({ vaccineName: 'V10', appliedOn: '2026-11-01', nextDueOn: '2027-02-30' });
    expect(result.error?.issues[0]).toMatchObject({ path: ['nextDueOn'], message: 'invalid_date' });
  });

  it('accepts null for every optional field', () => {
    const result = vaccination.safeParse({
      vaccineName: 'V10',
      appliedOn: '2026-11-01',
      catalogId: null,
      nextDueOn: null,
      batch: null,
      brand: null,
      vetName: null,
      vetLicense: null,
      clinic: null,
      notes: null,
      remindersEnabled: false,
    });
    expect(result.success).toBe(true);
  });
});
