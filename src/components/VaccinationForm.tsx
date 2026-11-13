import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { catalogMatcher, findCatalogVaccine } from '@/catalog';
import type { Pet, Vaccination, VaccinationInput } from '@/data/types';
import { normalizeVaccineName } from '@/domain/current';
import { formatBrDate, maskBrDate, parseOptionalBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { suggestNextDue } from '@/domain/nextDose';
import { vaccinationInputSchema } from '@/domain/validation';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { FormError } from './FormError';
import { FormField } from './FormField';
import { VaccineNameField } from './VaccineNameField';
import { dateErrorLabel } from './petLabels';
import { useGuardedAction } from './useGuardedAction';

type VaccinationFields = Omit<VaccinationInput, 'petId'>;

interface VaccinationFormProps {
  pet: Pet;
  /** The record being edited; omitted when creating one. */
  vaccination?: Vaccination;
  /** Vaccine name already chosen, such as when registering a booster. */
  initialName?: string;
  /** Writes the record. A throw is shown as a save error. */
  onSubmit: (input: VaccinationFields) => void;
  /** Runs after a successful write, typically navigation. */
  onSaved: () => void;
}

type Errors = { vaccineName?: string; appliedOn?: string; nextDueOn?: string };

const blankToNull = (text: string) => text.trim() || null;

export function VaccinationForm({ pet, vaccination, initialName, onSubmit, onSaved }: VaccinationFormProps) {
  const { colors, spacing, typography } = useTheme();
  const [name, setName] = useState(vaccination?.vaccineName ?? initialName ?? '');
  const [applied, setApplied] = useState(formatBrDate(vaccination?.appliedOn ?? todayLocal()));
  // null: the user has not touched the field, so it shows the catalog suggestion. Once they type, it is theirs.
  const [nextDue, setNextDue] = useState<string | null>(
    vaccination ? (vaccination.nextDueOn ? formatBrDate(vaccination.nextDueOn) : '') : null,
  );
  const [batch, setBatch] = useState(vaccination?.batch ?? '');
  const [brand, setBrand] = useState(vaccination?.brand ?? '');
  const [vetName, setVetName] = useState(vaccination?.vetName ?? '');
  const [vetLicense, setVetLicense] = useState(vaccination?.vetLicense ?? '');
  const [clinic, setClinic] = useState(vaccination?.clinic ?? '');
  const [notes, setNotes] = useState(vaccination?.notes ?? '');
  const [errors, setErrors] = useState<Errors>({});
  const guard = useGuardedAction();

  // An edit that leaves the name alone keeps the record's own catalog link; otherwise the typed name decides.
  const nameUnchanged = vaccination !== undefined && name === vaccination.vaccineName;
  const catalogId = nameUnchanged
    ? (vaccination.catalogId ?? undefined)
    : catalogMatcher(pet.species)(normalizeVaccineName(name));
  const catalogVaccine = catalogId ? findCatalogVaccine(catalogId) : undefined;
  const appliedDate = parseOptionalBrDate(applied);
  const suggested =
    catalogVaccine && appliedDate.ok && appliedDate.value
      ? formatBrDate(suggestNextDue(appliedDate.value, catalogVaccine.boosterIntervalDays))
      : '';
  const nextDueText = nextDue ?? suggested;

  function submit() {
    const found: Errors = {};
    const nextDate = parseOptionalBrDate(nextDueText);
    if (!appliedDate.ok) found.appliedOn = dateErrorLabel('invalid_date');
    else if (appliedDate.value === null) found.appliedOn = t('vaccinations.form.errors.appliedRequired');
    if (!nextDate.ok) found.nextDueOn = dateErrorLabel('invalid_date');

    const result = vaccinationInputSchema({ today: todayLocal(), birthOn: pet.birthOn }).safeParse({
      vaccineName: name,
      appliedOn: appliedDate.ok ? (appliedDate.value ?? '') : '',
      nextDueOn: nextDate.ok ? nextDate.value : null,
    });
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0];
        if (field === 'vaccineName') found.vaccineName = t('vaccinations.form.errors.nameRequired');
        if (field === 'appliedOn' && !found.appliedOn) found.appliedOn = appliedErrorLabel(issue.message);
        if (field === 'nextDueOn' && !found.nextDueOn) found.nextDueOn = nextDueErrorLabel(issue.message);
      }
    }
    setErrors(found);
    if (!result.success || Object.keys(found).length > 0) return;

    const input: VaccinationFields = {
      // A name that matches the catalog is stored as that catalog item, with the catalog's spelling.
      catalogId: catalogId ?? null,
      vaccineName: nameUnchanged ? vaccination.vaccineName : (catalogVaccine?.name ?? result.data.vaccineName),
      appliedOn: result.data.appliedOn,
      nextDueOn: result.data.nextDueOn ?? null,
      batch: blankToNull(batch),
      brand: blankToNull(brand),
      vetName: blankToNull(vetName),
      vetLicense: blankToNull(vetLicense),
      clinic: blankToNull(clinic),
      notes: blankToNull(notes),
      // updateVaccination replaces every field, so the current switch travels with the edit (Task 8 owns it).
      remindersEnabled: vaccination?.remindersEnabled ?? true,
    };
    guard.run(() => onSubmit(input), { onSuccess: onSaved });
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <VaccineNameField
          species={pet.species}
          value={name}
          onChangeText={setName}
          onPick={(vaccine) => {
            setName(vaccine.name);
            // An emptied field counts as empty: the suggestion fills it again.
            if (nextDue === '') setNextDue(null);
          }}
          error={errors.vaccineName}
        />
        <View style={[styles.row, { gap: spacing.md }]}>
          <View style={styles.half}>
            <FormField
              label={t('vaccinations.form.appliedOn')}
              placeholder={t('vaccinations.form.datePlaceholder')}
              keyboardType="number-pad"
              maxLength={10}
              value={applied}
              onChangeText={(text) => setApplied(maskBrDate(text))}
              error={errors.appliedOn}
            />
          </View>
          <View style={styles.half}>
            <FormField
              label={t('vaccinations.form.nextDue')}
              placeholder={t('vaccinations.form.datePlaceholder')}
              keyboardType="number-pad"
              maxLength={10}
              value={nextDueText}
              onChangeText={(text) => setNextDue(maskBrDate(text))}
              error={errors.nextDueOn}
            />
          </View>
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('vaccinations.form.nextDueHint')}</Text>
        {/* Task 7 adds the proof photos block here. */}
        <Text accessibilityRole="header" style={[typography.label, { color: colors.textSecondary }]}>
          {t('vaccinations.form.detailsTitle')}
        </Text>
        <FormField label={t('vaccinations.form.batch')} value={batch} onChangeText={setBatch} />
        <FormField label={t('vaccinations.form.brand')} value={brand} onChangeText={setBrand} />
        <FormField label={t('vaccinations.form.vetName')} value={vetName} onChangeText={setVetName} />
        <FormField label={t('vaccinations.form.vetLicense')} value={vetLicense} onChangeText={setVetLicense} />
        <FormField label={t('vaccinations.form.clinic')} value={clinic} onChangeText={setClinic} />
        <FormField label={t('vaccinations.form.notes')} value={notes} onChangeText={setNotes} />
        <FormError message={guard.error} />
      </ScrollView>
      <View style={[styles.footer, { padding: spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button label={t('vaccinations.form.save')} onPress={submit} />
      </View>
    </SafeAreaView>
  );
}

function appliedErrorLabel(code: string): string {
  return code === 'before_birth' ? t('vaccinations.form.errors.beforeBirth') : dateErrorLabel(code);
}

function nextDueErrorLabel(code: string): string {
  return code === 'next_not_after' ? t('vaccinations.form.errors.nextNotAfter') : dateErrorLabel(code);
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row' },
  half: { flex: 1 },
  footer: { borderTopWidth: 1 },
});
