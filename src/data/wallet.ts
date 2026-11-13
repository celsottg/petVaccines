import { catalogMatcher } from '@/catalog';
import { splitCurrent } from '@/domain/current';
import { todayLocal, type IsoDate } from '@/domain/dates';
import { getStatus, type VaccinationStatus } from '@/domain/status';

import type { Pet, Vaccination } from './types';

export type WalletFilter = 'all' | 'due_soon' | 'overdue';

export interface WalletEntry {
  vaccination: Vaccination;
  /** Only current records of an active pet have a due-date status. */
  status: VaccinationStatus | null;
  hasAttachments: boolean;
}

export interface Wallet {
  current: WalletEntry[];
  previous: WalletEntry[];
}

export interface VaccinationDetail {
  vaccination: Vaccination;
  pet: Pet;
  isCurrent: boolean;
  status: VaccinationStatus | null;
  hasAttachments: boolean;
}

function statusOf(pet: Pet, vaccination: Vaccination, dueSoonDays: number, today: IsoDate): VaccinationStatus | null {
  return pet.status === 'active' ? getStatus(vaccination.nextDueOn, today, dueSoonDays) : null;
}

// ISO dates compare chronologically as text; records without a next dose go last.
function byNextDue(a: WalletEntry, b: WalletEntry): number {
  const left = a.vaccination.nextDueOn;
  const right = b.vaccination.nextDueOn;
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
}

const byAppliedDesc = (a: WalletEntry, b: WalletEntry) =>
  a.vaccination.appliedOn < b.vaccination.appliedOn ? 1 : a.vaccination.appliedOn > b.vaccination.appliedOn ? -1 : 0;

/**
 * The wallet of one pet: the current record of each vaccine (most urgent first)
 * and the previous applications (newest first). `vaccinations` are the pet's own.
 */
export function buildWallet(
  pet: Pet,
  vaccinations: Vaccination[],
  attachedIds: ReadonlySet<string>,
  dueSoonDays: number,
  today: IsoDate = todayLocal(),
): Wallet {
  const { current, previous } = splitCurrent(vaccinations, catalogMatcher(pet.species));
  const entry = (vaccination: Vaccination, withStatus: boolean): WalletEntry => ({
    vaccination,
    status: withStatus ? statusOf(pet, vaccination, dueSoonDays, today) : null,
    hasAttachments: attachedIds.has(vaccination.id),
  });
  return {
    current: current.map((v) => entry(v, true)).sort(byNextDue),
    previous: previous.map((v) => entry(v, false)).sort(byAppliedDesc),
  };
}

/** A status filter looks at current records only, so previous applications are hidden with it. */
export function filterWallet(wallet: Wallet, filter: WalletFilter): Wallet {
  if (filter === 'all') return wallet;
  return { current: wallet.current.filter((e) => e.status === filter), previous: [] };
}

/** `siblings` are all the pet's records, the vaccination itself included. */
export function buildVaccinationDetail(
  pet: Pet,
  vaccination: Vaccination,
  siblings: Vaccination[],
  hasAttachments: boolean,
  dueSoonDays: number,
  today: IsoDate = todayLocal(),
): VaccinationDetail {
  const { current } = splitCurrent(siblings, catalogMatcher(pet.species));
  const isCurrent = current.some((v) => v.id === vaccination.id);
  return {
    vaccination,
    pet,
    isCurrent,
    status: isCurrent ? statusOf(pet, vaccination, dueSoonDays, today) : null,
    hasAttachments,
  };
}
