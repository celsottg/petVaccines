import { z } from 'zod';
import { normalizeVaccineName } from '@/domain/current';
import br from './br.json';
import { catalogMatcher, findCatalogVaccine, listCatalog } from './index';

const fileSchema = z.object({
  country: z.literal('BR'),
  vaccines: z.array(
    z.object({
      id: z.string().regex(/^br-(dog|cat)-[a-z0-9-]+$/),
      name: z.string().min(1),
      species: z.enum(['dog', 'cat']),
      boosterIntervalDays: z.number().int().positive(),
    }),
  ),
});

describe('br.json', () => {
  it('passes the schema', () => {
    expect(fileSchema.safeParse(br).success).toBe(true);
  });

  it('has no repeated id', () => {
    const ids = br.vaccines.map((v) => v.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Records store these ids, so an id may be added to this list but never renamed or removed.
  it('keeps the released ids', () => {
    expect(br.vaccines.map((v) => v.id).sort()).toEqual([
      'br-cat-polyvalent',
      'br-cat-rabies',
      'br-dog-giardia',
      'br-dog-kennel-cough',
      'br-dog-leishmaniasis',
      'br-dog-polyvalent',
      'br-dog-rabies',
    ]);
  });

  it('has an id prefix that matches the species', () => {
    for (const v of br.vaccines) expect(v.id.startsWith(`br-${v.species}-`)).toBe(true);
  });

  it('has no two items of the same species with the same normalized name', () => {
    const keys = br.vaccines.map((v) => `${v.species}:${normalizeVaccineName(v.name)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('listCatalog', () => {
  it('returns only items of the requested species', () => {
    expect(listCatalog('cat').length).toBeGreaterThan(0);
    expect(listCatalog('cat').every((v) => v.species === 'cat')).toBe(true);
    expect(listCatalog('dog').every((v) => v.species === 'dog')).toBe(true);
  });

  it('is in alphabetical order, accent-aware', () => {
    expect(listCatalog('dog').map((v) => v.name)).toEqual([
      'Antirrábica',
      'Giárdia',
      'Gripe canina',
      'Leishmaniose',
      'Polivalente (V8/V10)',
    ]);
    expect(listCatalog('cat').map((v) => v.name)).toEqual(['Antirrábica', 'Polivalente (V3/V4/V5)']);
  });
});

describe('findCatalogVaccine', () => {
  it('finds an item by id', () => {
    expect(findCatalogVaccine('br-dog-rabies')?.name).toBe('Antirrábica');
  });

  it('returns undefined for an unknown id', () => {
    expect(findCatalogVaccine('br-dog-nope')).toBeUndefined();
  });
});

describe('catalogMatcher', () => {
  it('matches a normalized name to the item of the same species', () => {
    expect(catalogMatcher('dog')('antirrabica')).toBe('br-dog-rabies');
  });

  it('never returns an item of the other species', () => {
    expect(catalogMatcher('cat')('antirrabica')).toBe('br-cat-rabies');
    expect(catalogMatcher('cat')('gripe canina')).toBeUndefined();
  });

  it('returns undefined for an unknown name', () => {
    expect(catalogMatcher('dog')('inexistente')).toBeUndefined();
  });
});
