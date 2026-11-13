import type { IsoDate } from './dates';

type VaccineRef = { catalogId: string | null; vaccineName: string };
type DatedVaccine = VaccineRef & { appliedOn: IsoDate; createdAt: string };

/**
 * Identifies "the same vaccine" across records: the catalog id when there is
 * one, otherwise the free name without accents, case or surrounding spaces.
 */
export function vaccineKey(v: VaccineRef): string {
  if (v.catalogId !== null) return `catalog:${v.catalogId}`;
  const name = v.vaccineName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();
  return `name:${name}`;
}

// Most recent application wins; ties on appliedOn go to the latest createdAt.
// Both are fixed-width ISO strings, so string comparison is chronological.
function isNewer(a: DatedVaccine, b: DatedVaccine): boolean {
  if (a.appliedOn !== b.appliedOn) return a.appliedOn > b.appliedOn;
  return a.createdAt > b.createdAt;
}

/**
 * Splits records into the current one per vaccine and the previous ones.
 * Both lists keep the input order.
 */
export function splitCurrent<T extends DatedVaccine>(list: T[]): { current: T[]; previous: T[] } {
  const latest = new Map<string, T>();
  for (const item of list) {
    const key = vaccineKey(item);
    const best = latest.get(key);
    if (best === undefined || isNewer(item, best)) latest.set(key, item);
  }
  const winners = new Set(latest.values());
  return {
    current: list.filter((item) => winners.has(item)),
    previous: list.filter((item) => !winners.has(item)),
  };
}
