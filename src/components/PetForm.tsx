import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Pet, PetInput } from '@/data/types';
import { formatBrDate, maskBrDate, parseOptionalBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { petInputSchema } from '@/domain/validation';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { ChoiceChips } from './ChoiceChips';
import { FormField } from './FormField';
import { FormError } from './FormError';
import { dateErrorLabel } from './petLabels';
import { useGuardedAction } from './useGuardedAction';

interface PetFormProps {
  /** The pet being edited; omitted when creating one. */
  pet?: Pet;
  onSubmit: (input: PetInput) => void;
  /** Extra actions shown under the fields, such as "Dar baixa". */
  children?: ReactNode;
}

type Errors = { name?: string; birthOn?: string };

export function PetForm({ pet, onSubmit, children }: PetFormProps) {
  const { colors, spacing } = useTheme();
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Pet['species']>(pet?.species ?? 'dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [sex, setSex] = useState<Pet['sex']>(pet?.sex ?? null);
  const [birth, setBirth] = useState(pet?.birthOn ? formatBrDate(pet.birthOn) : '');
  const [errors, setErrors] = useState<Errors>({});
  const guard = useGuardedAction();

  function submit() {
    const found: Errors = {};
    const birthDate = parseOptionalBrDate(birth);
    if (!birthDate.ok) found.birthOn = dateErrorLabel('invalid_date');

    const result = petInputSchema(todayLocal()).safeParse({
      name,
      species,
      breed: breed.trim() || null,
      sex,
      birthOn: birthDate.ok ? birthDate.value : null,
      // updatePet replaces every field, so the existing photo reference must travel with the edit.
      photoFile: pet?.photoFile ?? null,
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'name') found.name = t('pets.form.errors.nameRequired');
        if (issue.path[0] === 'birthOn') found.birthOn = dateErrorLabel(issue.message);
      }
    }
    setErrors(found);
    if (result.success && !found.birthOn) guard.run(() => onSubmit(result.data));
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <FormField label={t('pets.form.name')} value={name} onChangeText={setName} error={errors.name} />
        <ChoiceChips
          label={t('pets.form.species')}
          value={species}
          onChange={setSpecies}
          options={[
            { value: 'dog', label: t('pets.species.dog') },
            { value: 'cat', label: t('pets.species.cat') },
          ]}
        />
        <FormField label={t('pets.form.breed')} hint={t('pets.form.breedHint')} value={breed} onChangeText={setBreed} />
        <ChoiceChips
          label={t('pets.form.sex')}
          value={sex ?? null}
          // Pressing the selected option again clears it: the sex is optional.
          onChange={(value) => setSex(value === sex ? null : value)}
          options={[
            { value: 'male', label: t('pets.form.male') },
            { value: 'female', label: t('pets.form.female') },
          ]}
        />
        <FormField
          label={t('pets.form.birth')}
          hint={t('pets.form.birthHint')}
          error={errors.birthOn}
          placeholder={t('pets.form.birthPlaceholder')}
          keyboardType="number-pad"
          maxLength={10}
          value={birth}
          onChangeText={(text) => setBirth(maskBrDate(text))}
        />
        {children}
        <FormError message={guard.error} />
      </ScrollView>
      <View style={[styles.footer, { padding: spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button label={t('pets.form.save')} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: 1 },
});
