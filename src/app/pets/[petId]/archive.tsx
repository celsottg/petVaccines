import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ChoiceChips } from '@/components/ChoiceChips';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { PetCard } from '@/components/PetCard';
import { useGuardedAction } from '@/components/useGuardedAction';
import { dateErrorLabel, petDetails } from '@/components/petLabels';
import { archivePet } from '@/data/pets';
import type { ArchiveReason } from '@/data/types';
import { usePet } from '@/data/usePets';
import { db } from '@/db/client';
import { maskBrDate, parseOptionalBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { archiveInputSchema } from '@/domain/validation';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

const REASONS: ArchiveReason[] = ['deceased', 'rehomed', 'other'];
const EFFECTS = ['reminders', 'badges', 'list', 'history', 'backup'] as const;

export default function ArchivePetScreen() {
  const { petId } = useLocalSearchParams<{ petId: string }>();
  const { pet } = usePet(petId);
  const { colors, spacing, radius, typography } = useTheme();
  const [reason, setReason] = useState<ArchiveReason | null>(null);
  const [date, setDate] = useState('');
  const [dateError, setDateError] = useState<string>();
  const [reasonError, setReasonError] = useState<string>();
  const guard = useGuardedAction();

  if (!pet) return null;

  function confirm() {
    if (!pet) return;
    setDateError(undefined);
    setReasonError(reason ? undefined : t('pets.archive.reasonRequired'));
    const parsed = parseOptionalBrDate(date);
    if (!parsed.ok) return setDateError(dateErrorLabel('invalid_date'));
    const result = archiveInputSchema(todayLocal()).safeParse({ reason, on: parsed.value });
    if (!result.success) {
      const issue = result.error.issues[0];
      if (issue.path[0] === 'on') setDateError(dateErrorLabel(issue.message));
      return;
    }
    guard.run(() => {
      archivePet(db, pet.id, result.data.reason, result.data.on);
      router.dismissTo('/');
    });
  }

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('pets.archive.title') }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <PetCard name={pet.name} details={petDetails(pet, todayLocal())} />
        <Text style={[typography.body, { color: colors.text }]}>{t('pets.archive.intro', { name: pet.name })}</Text>
        <ChoiceChips
          label={t('pets.archive.reason')}
          value={reason}
          onChange={(value) => {
            setReason(value);
            setReasonError(undefined);
          }}
          error={reasonError}
          options={REASONS.map((value) => ({ value, label: t(`pets.reasons.${value}`) }))}
        />
        <FormField
          label={t('pets.archive.date')}
          placeholder={t('pets.form.birthPlaceholder')}
          keyboardType="number-pad"
          maxLength={10}
          value={date}
          onChangeText={(text) => setDate(maskBrDate(text))}
          error={dateError}
        />
        <Text accessibilityRole="header" style={[typography.label, { color: colors.textSecondary }]}>
          {t('pets.archive.whatHappens')}
        </Text>
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          {EFFECTS.map((effect, index) => (
            <View
              key={effect}
              style={[
                styles.effect,
                { padding: spacing.md, gap: spacing.md, borderTopColor: colors.border, borderTopWidth: index === 0 ? 0 : 1 },
              ]}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>{t(`pets.archive.effects.${effect}.label`)}</Text>
              <Text style={[typography.body, styles.effectValue, { color: colors.text }]}>
                {t(`pets.archive.effects.${effect}.value`)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('pets.archive.reactivateHint')}</Text>
      </ScrollView>
      <View style={[styles.footer, { padding: spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <FormError message={guard.error} />
        <Button label={t('pets.archive.confirm')} onPress={confirm} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { borderWidth: 1 },
  effect: { flexDirection: 'row', justifyContent: 'space-between' },
  effectValue: { flex: 1, textAlign: 'right', fontWeight: '600' },
  footer: { borderTopWidth: 1 },
});
