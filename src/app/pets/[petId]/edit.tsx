import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { PetForm } from '@/components/PetForm';
import { useGuardedAction } from '@/components/useGuardedAction';
import { deletePet, updatePet } from '@/data/pets';
import { usePet } from '@/data/usePets';
import { db } from '@/db/client';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

export default function EditPetScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { pet } = usePet(petId);
  const { spacing } = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const guard = useGuardedAction();

  // Also covers the moment right after the pet is deleted, before navigation finishes.
  if (!pet) return null;

  return (
    <>
      <Stack.Screen options={{ title: t('pets.form.editTitle') }} />
      <PetForm
        pet={pet}
        onSubmit={(input) => updatePet(db, pet.id, input)}
        onSaved={() => router.dismissTo('/')}>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            variant="secondary"
            label={t('pets.form.archive')}
            onPress={() => router.push({ pathname: '/pets/[petId]/archive', params: { petId: pet.id } })}
          />
          <Button variant="danger" label={t('pets.form.delete')} onPress={() => setConfirmingDelete(true)} />
          <FormError message={guard.error} />
        </View>
      </PetForm>
      <ConfirmDialog
        visible={confirmingDelete}
        destructive
        title={t('pets.form.deleteConfirm.title', { name: pet.name })}
        message={t('pets.form.deleteConfirm.message')}
        confirmLabel={t('pets.form.deleteConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          guard.run(
            () => {
              // The returned file names (photo, proof photos) are removed from disk in Task 7.
              deletePet(db, pet.id);
            },
            { onSuccess: () => router.dismissTo('/') },
          );
        }}
      />
    </>
  );
}
