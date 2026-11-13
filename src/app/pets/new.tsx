import { router, Stack } from 'expo-router';

import { PetForm } from '@/components/PetForm';
import { createPet } from '@/data/pets';
import { db } from '@/db/client';
import { t } from '@/i18n';

export default function NewPetScreen() {
  return (
    <>
      <Stack.Screen options={{ title: t('pets.form.newTitle') }} />
      <PetForm
        onSubmit={(input) => createPet(db, input)}
        // Task 6 sends a new pet to its wallet; until that route exists, back to the list.
        onSaved={() => router.dismissTo('/')}
      />
    </>
  );
}
