import { router, Stack } from 'expo-router';
import { useRef } from 'react';

import { PetForm } from '@/components/PetForm';
import { createPet } from '@/data/pets';
import type { Pet } from '@/data/types';
import { db } from '@/db/client';
import { t } from '@/i18n';

export default function NewPetScreen() {
  const created = useRef<Pet>(undefined);

  return (
    <>
      <Stack.Screen options={{ title: t('pets.form.newTitle') }} />
      <PetForm
        onSubmit={(input) => {
          created.current = createPet(db, input);
        }}
        // The new pet's wallet takes the form's place, so "back" returns to Meus pets.
        onSaved={() => {
          if (created.current) router.replace({ pathname: '/pets/[petId]', params: { petId: created.current.id } });
        }}
      />
    </>
  );
}
