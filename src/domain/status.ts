import { diffDays, type IsoDate } from './dates';

export type VaccinationStatus = 'ok' | 'due_soon' | 'overdue';

const SEVERITY: Record<VaccinationStatus, number> = { ok: 0, due_soon: 1, overdue: 2 };

/** Due today counts as due soon; overdue starts the day after `nextDueOn`. */
export function getStatus(nextDueOn: IsoDate | null, today: IsoDate, dueSoonDays: number): VaccinationStatus {
  if (nextDueOn === null) return 'ok';
  const daysLeft = diffDays(nextDueOn, today);
  if (daysLeft < 0) return 'overdue';
  if (daysLeft <= dueSoonDays) return 'due_soon';
  return 'ok';
}

export function worstStatus(statuses: VaccinationStatus[]): VaccinationStatus | null {
  if (statuses.length === 0) return null;
  return statuses.reduce((worst, s) => (SEVERITY[s] > SEVERITY[worst] ? s : worst));
}
