import { t } from '@/i18n';
import { formatBrDate } from '@/domain/dateInput';
import { petAge } from '@/domain/age';
import type { IsoDate } from '@/domain/dates';
import type { PetBadge } from '@/data/petSummaries';
import type { ArchiveReason, Pet } from '@/data/types';

/** "Cão · SRD · 3 anos": species, then breed and age when known. */
export function petDetails(pet: Pick<Pet, 'species' | 'breed' | 'birthOn'>, today: IsoDate): string {
  const age = petAge(pet.birthOn, today);
  const parts = [
    t(`pets.species.${pet.species}`),
    pet.breed?.trim() || null,
    age ? t(`pets.age.${age.unit}`, { count: age.count }) : null,
  ];
  return parts.filter(Boolean).join(' · ');
}

export function badgeLabel(badge: PetBadge): string {
  return t(`pets.badge.${badge.status}`, { count: badge.count });
}

export function archivedLine(reason: ArchiveReason | null, on: IsoDate | null): string {
  if (reason === null) return '';
  const label = t(`pets.reasons.${reason}`);
  return on ? t('pets.archived.reasonOn', { reason: label, date: formatBrDate(on) }) : label;
}

/** Message for an issue code from `petInputSchema` / `archiveInputSchema` on a date field. */
export function dateErrorLabel(code: string): string {
  return code === 'future_date' ? t('pets.form.errors.dateFuture') : t('pets.form.errors.dateInvalid');
}
