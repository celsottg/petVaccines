import { archiveInputSchema, petInputSchema } from './validation';

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
