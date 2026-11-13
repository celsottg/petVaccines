import type { IsoDate } from './dates';

type VaccineRef = { catalogId: string | null; vaccineName: string };
type DatedVaccine = VaccineRef & { appliedOn: IsoDate; createdAt: string };

/** Lowercase text without accents, with inner whitespace collapsed and the ends trimmed. */
export function normalizeVaccineName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Resolves a normalized name to a catalog item id, or undefined when it matches none. */
export type CatalogMatcher = (normalizedName: string) => string | undefined;

/**
 * Identifies "the same vaccine" across records: the catalog id when there is
 * one, otherwise the catalog item the free name matches, otherwise the
 * normalized name itself.
 */
export function vaccineKey(v: VaccineRef, matchCatalog?: CatalogMatcher): string {
  if (v.catalogId !== null) return `catalog:${v.catalogId}`;
  const name = normalizeVaccineName(v.vaccineName);
  const matchedId = matchCatalog?.(name);
  return matchedId !== undefined ? `catalog:${matchedId}` : `name:${name}`;
}

// Most recent application wins; ties on appliedOn go to the latest createdAt.
// Both are fixed-width ISO strings, so string comparison is chronological.
function isNewer(a: DatedVaccine, b: DatedVaccine): boolean {
  if (a.appliedOn !== b.appliedOn) return a.appliedOn > b.appliedOn;
  return a.createdAt > b.createdAt;
}

/**
 * Splits records into the current one per vaccine and the previous ones.
 * Both lists keep the input order. The list belongs to one pet, so
 * `matchCatalog` is the one for its species.
 */
export function splitCurrent<T extends DatedVaccine>(
  list: T[],
  matchCatalog?: CatalogMatcher,
): { current: T[]; previous: T[] } {
  const latest = new Map<string, T>();
  for (const item of list) {
    const key = vaccineKey(item, matchCatalog);
    const best = latest.get(key);
    if (best === undefined || isNewer(item, best)) latest.set(key, item);
  }
  const winners = new Set(latest.values());
  return {
    current: list.filter((item) => winners.has(item)),
    previous: list.filter((item) => !winners.has(item)),
  };
}
