import type { Vaccination } from '@/data/types';
import { formatBrDate } from '@/domain/dateInput';
import { diffDays, type IsoDate } from '@/domain/dates';
import type { VaccinationStatus } from '@/domain/status';
import { t } from '@/i18n';

/** "Vence em 20 dias", "Vencida há 3 dias" or "Em dia"; `nextDueOn` is null only for "Em dia". */
export function statusLabel(status: VaccinationStatus, nextDueOn: IsoDate | null, today: IsoDate): string {
  if (nextDueOn === null || status === 'ok') return t('vaccinations.status.ok');
  const days = diffDays(nextDueOn, today);
  if (status === 'due_soon' && days === 0) return t('vaccinations.status.due_soon_today');
  // Plural keys (`overdue_one`, `due_soon_other`, ...) are resolved by i18next from the count.
  return t(`vaccinations.status.${status}`, { count: Math.abs(days) });
}

/** "Aplicada em 02/12/2025 · Próxima dose em 02/12/2026"; the next dose is left out when `withNextDue` is false. */
export function vaccinationDates(vaccination: Pick<Vaccination, 'appliedOn' | 'nextDueOn'>, withNextDue: boolean): string {
  const parts = [t('vaccinations.card.applied', { date: formatBrDate(vaccination.appliedOn) })];
  if (withNextDue && vaccination.nextDueOn) {
    parts.push(t('vaccinations.card.nextDue', { date: formatBrDate(vaccination.nextDueOn) }));
  }
  return parts.join(' · ');
}
