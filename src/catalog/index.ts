import { normalizeVaccineName, type CatalogMatcher } from '@/domain/current';
import br from './br.json';

type Species = 'dog' | 'cat';

export type CatalogVaccine = {
  id: string;
  name: string;
  species: Species;
  boosterIntervalDays: number;
};

// br.json is checked against its schema in index.test.ts, so the cast is safe.
const vaccines = br.vaccines as CatalogVaccine[];

/** Catalog items for a species, in alphabetical order (pt-BR aware). */
export function listCatalog(species: Species): CatalogVaccine[] {
  return vaccines
    .filter((v) => v.species === species)
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}

export function findCatalogVaccine(id: string): CatalogVaccine | undefined {
  return vaccines.find((v) => v.id === id);
}

/** Matcher for `vaccineKey`/`splitCurrent`: resolves a normalized name to an item of this species. */
export function catalogMatcher(species: Species): CatalogMatcher {
  const idByName = new Map(
    vaccines.filter((v) => v.species === species).map((v) => [normalizeVaccineName(v.name), v.id]),
  );
  return (normalizedName) => idByName.get(normalizedName);
}
