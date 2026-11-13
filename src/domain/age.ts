import type { IsoDate } from './dates';

export type PetAge = { unit: 'years' | 'months' | 'lessThanMonth'; count: number };

/** Age in whole years (from one year on), else whole months, else "under a month". */
export function petAge(birthOn: IsoDate | null, today: IsoDate): PetAge | null {
  if (birthOn === null) return null;
  const [by, bm, bd] = birthOn.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months >= 12) return { unit: 'years', count: Math.floor(months / 12) };
  if (months >= 1) return { unit: 'months', count: months };
  return { unit: 'lessThanMonth', count: 0 };
}
