import { router, Stack, useLocalSearchParams } from 'expo-router';

import { findCatalogVaccine } from '@/catalog';
import { NotFound } from '@/components/NotFound';
import { VaccinationForm } from '@/components/VaccinationForm';
import { createVaccinationWithPhotos } from '@/data/vaccinations';
import { usePet } from '@/data/usePets';
import { useVaccinationDetail } from '@/data/useVaccinations';
import { db } from '@/db/client';
import { t } from '@/i18n';

/** `fromVaccinationId` comes from "Registrar reforço": the form starts with that vaccine chosen. */
export default function NewVaccinationScreen() {
  const { petId, fromVaccinationId } = useLocalSearchParams<{ petId: string; fromVaccinationId?: string }>();
  const { pet, loaded } = usePet(petId);
  const sourceState = useVaccinationDetail(fromVaccinationId ?? '');
  const source = sourceState.detail?.vaccination;

  if (!pet || pet.status !== 'active') return loaded ? <NotFound /> : null;
  // The form reads its starting values once, so it waits for the booster's source record.
  if (fromVaccinationId && !sourceState.loaded) return null;

  const initialName = source
    ? (source.catalogId ? findCatalogVaccine(source.catalogId)?.name : undefined) ?? source.vaccineName
    : undefined;

  return (
    <>
      <Stack.Screen options={{ title: t('vaccinations.form.newTitle') }} />
      <VaccinationForm
        pet={pet}
        initialName={initialName}
        onSubmit={(input, photos) => createVaccinationWithPhotos(db, { petId: pet.id, ...input }, photos)}
        onSaved={() => router.dismissTo({ pathname: '/pets/[petId]', params: { petId: pet.id } })}
      />
    </>
  );
}
