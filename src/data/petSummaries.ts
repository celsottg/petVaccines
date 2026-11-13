import { catalogMatcher } from '@/catalog';
import { todayLocal, type IsoDate } from '@/domain/dates';
import { splitCurrent } from '@/domain/current';
import { getStatus, worstStatus, type VaccinationStatus } from '@/domain/status';

import type { Pet, Vaccination } from './types';

/** Worst status among the current records and how many records have it; `none` when the pet has no records. */
export interface PetBadge {
  status: VaccinationStatus | 'none';
  count: number;
}

export interface PetSummary {
  pet: Pet;
  /** Null for archived pets: the due-date badge only exists for active wallets. */
  badge: PetBadge | null;
}

export function buildPetSummaries(
  pets: Pet[],
  vaccinations: Vaccination[],
  dueSoonDays: number,
  today: IsoDate = todayLocal(),
): PetSummary[] {
  return pets.map((pet) => {
    if (pet.status === 'archived') return { pet, badge: null };
    const records = vaccinations.filter((v) => v.petId === pet.id);
    const { current } = splitCurrent(records, catalogMatcher(pet.species));
    const statuses = current.map((v) => getStatus(v.nextDueOn, today, dueSoonDays));
    const worst = worstStatus(statuses);
    if (worst === null) return { pet, badge: { status: 'none', count: 0 } };
    return { pet, badge: { status: worst, count: statuses.filter((s) => s === worst).length } };
  });
}
