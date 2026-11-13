import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Pet, PetInput } from '@/data/types';
import { formatBrDate, maskBrDate, parseOptionalBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { petInputSchema } from '@/domain/validation';
import { t } from '@/i18n';
import { discardFiles } from '@/services/discardFiles';
import { petPhotoUri } from '@/services/files';
import { preparePetPhoto } from '@/services/photos';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { ChoiceChips } from './ChoiceChips';
import { FormField } from './FormField';
import { FormError } from './FormError';
import { PetAvatar } from './PetAvatar';
import { PhotoSourceSheet } from './PhotoSourceSheet';
import { dateErrorLabel } from './petLabels';
import { useGuardedAction } from './useGuardedAction';
import { usePhotoPicker } from './usePhotoPicker';

interface PetFormProps {
  /** The pet being edited; omitted when creating one. */
  pet?: Pet;
  /** Writes the pet. A throw is shown as a save error. */
  onSubmit: (input: PetInput) => void;
  /** Runs after a successful write, typically navigation. */
  onSaved: () => void;
  /** Extra actions shown under the fields, such as "Dar baixa". */
  children?: ReactNode;
}

type Errors = { name?: string; birthOn?: string };

export function PetForm({ pet, onSubmit, onSaved, children }: PetFormProps) {
  const { colors, spacing, typography } = useTheme();
  const [name, setName] = useState(pet?.name ?? '');
  const [species, setSpecies] = useState<Pet['species']>(pet?.species ?? 'dog');
  const [breed, setBreed] = useState(pet?.breed ?? '');
  const [sex, setSex] = useState<Pet['sex']>(pet?.sex ?? null);
  const [birth, setBirth] = useState(pet?.birthOn ? formatBrDate(pet.birthOn) : '');
  const [errors, setErrors] = useState<Errors>({});
  const guard = useGuardedAction();
  const [choosingPhoto, setChoosingPhoto] = useState(false);
  const [confirmingRemoval, setConfirmingRemoval] = useState(false);
  // The photo the pet had when the form opened. A different `photoFile` is a new file that no row points to yet.
  const [originalPhoto] = useState(pet?.photoFile ?? null);
  const [photoFile, setPhotoFile] = useState(originalPhoto);
  const photoRef = useRef(photoFile);
  useEffect(() => {
    photoRef.current = photoFile;
  });
  const saved = useRef(false);
  const picker = usePhotoPicker(preparePetPhoto, (photo) => {
    // Replacing a file chosen earlier in this form: nothing references it, so it goes now.
    if (photoRef.current && photoRef.current !== originalPhoto) discardFiles([photoRef.current]);
    setPhotoFile(photo.file);
  });
  useEffect(
    () => () => {
      const unsaved = photoRef.current;
      if (!saved.current && unsaved && unsaved !== originalPhoto) discardFiles([unsaved]);
    },
    [originalPhoto],
  );

  function removePhoto() {
    if (photoFile && photoFile !== originalPhoto) discardFiles([photoFile]);
    // The pet's saved photo is only deleted once the form is saved without it.
    setPhotoFile(null);
  }

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
      // updatePet replaces every field, so the photo reference travels with every edit.
      photoFile,
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === 'name') found.name = t('pets.form.errors.nameRequired');
        if (issue.path[0] === 'birthOn') found.birthOn = dateErrorLabel(issue.message);
      }
    }
    setErrors(found);
    if (result.success && !found.birthOn) {
      guard.run(() => onSubmit(result.data), {
        onSuccess: () => {
          saved.current = true;
          if (originalPhoto && originalPhoto !== photoFile) discardFiles([originalPhoto]);
          onSaved();
        },
      });
    }
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={[styles.photoRow, { gap: spacing.md }]}>
          <PetAvatar name={name} photoUri={photoFile ? petPhotoUri(photoFile) : undefined} size={84} />
          <View style={[styles.photoActions, { gap: spacing.sm }]}>
            <Button
              variant="secondary"
              label={photoFile ? t('photos.pet.change') : t('photos.pet.choose')}
              onPress={() => setChoosingPhoto(true)}
            />
            {photoFile ? <Button variant="secondary" label={t('photos.pet.remove')} onPress={() => setConfirmingRemoval(true)} /> : null}
          </View>
        </View>
        <Text style={[typography.caption, { color: picker.message ? colors.status.overdue.text : colors.textSecondary }]}>
          {picker.message ?? t('photos.pet.hint')}
        </Text>
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
      <ConfirmDialog
        visible={confirmingRemoval}
        destructive
        title={t('photos.pet.removeConfirm.title')}
        message={t('photos.pet.removeConfirm.message')}
        confirmLabel={t('photos.pet.removeConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmingRemoval(false)}
        onConfirm={() => {
          setConfirmingRemoval(false);
          removePhoto();
        }}
      />
      <PhotoSourceSheet
        visible={choosingPhoto}
        onCancel={() => setChoosingPhoto(false)}
        onPick={(source) => {
          setChoosingPhoto(false);
          void picker.pick(source);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: 1 },
  photoRow: { flexDirection: 'row', alignItems: 'center' },
  photoActions: { flex: 1 },
});
