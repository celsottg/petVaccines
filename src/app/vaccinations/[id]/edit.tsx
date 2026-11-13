import { router, Stack, useLocalSearchParams } from 'expo-router';

import { NotFound } from '@/components/NotFound';
import { VaccinationForm } from '@/components/VaccinationForm';
import { updateVaccination } from '@/data/vaccinations';
import { useVaccinationDetail } from '@/data/useVaccinations';
import { db } from '@/db/client';
import { t } from '@/i18n';

export default function EditVaccinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, loaded } = useVaccinationDetail(id);

  if (!detail || detail.pet.status !== 'active') return loaded ? <NotFound /> : null;

  return (
    <>
      <Stack.Screen options={{ title: t('vaccinations.form.editTitle') }} />
      <VaccinationForm
        pet={detail.pet}
        vaccination={detail.vaccination}
        onSubmit={(input) => updateVaccination(db, detail.vaccination.id, input)}
        onSaved={() => router.dismissTo({ pathname: '/vaccinations/[id]', params: { id: detail.vaccination.id } })}
      />
    </>
  );
}
