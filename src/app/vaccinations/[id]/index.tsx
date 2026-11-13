import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError } from '@/components/FormError';
import { NotFound } from '@/components/NotFound';
import { RemindersSection } from '@/components/RemindersSection';
import { SavedProofPhotos } from '@/components/SavedProofPhotos';
import { StatusBadge } from '@/components/StatusBadge';
import { useGuardedAction } from '@/components/useGuardedAction';
import { statusLabel } from '@/components/vaccinationLabels';
import { useVaccinationDetail } from '@/data/useVaccinations';
import { deleteVaccination, updateVaccination } from '@/data/vaccinations';
import { db } from '@/db/client';
import { formatBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { t } from '@/i18n';
import { discardFiles } from '@/services/discardFiles';
import { useTheme } from '@/theme';

export default function VaccinationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { detail, reminderOffsetsDays, loaded } = useVaccinationDetail(id);
  const { colors, spacing, radius, typography } = useTheme();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const removedFiles = useRef<string[]>([]);
  const guard = useGuardedAction();

  // Also covers the moment right after the record is deleted, before navigation finishes.
  if (!detail) return loaded && !leaving ? <NotFound /> : null;

  const { vaccination, pet, status, hasAttachments, isCurrent } = detail;
  const active = pet.status === 'active';
  const vet = [
    vaccination.vetName,
    vaccination.vetLicense ? t('vaccinations.detail.vetLicenseOnly', { license: vaccination.vetLicense }) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const rows: [string, string | null][] = [
    [t('vaccinations.detail.pet'), pet.name],
    [t('vaccinations.detail.appliedOn'), formatBrDate(vaccination.appliedOn)],
    [t('vaccinations.detail.nextDue'), vaccination.nextDueOn ? formatBrDate(vaccination.nextDueOn) : null],
    [t('vaccinations.detail.batch'), vaccination.batch],
    [t('vaccinations.detail.brand'), vaccination.brand],
    [t('vaccinations.detail.vet'), vet || null],
    [t('vaccinations.detail.clinic'), vaccination.clinic],
    [t('vaccinations.detail.notes'), vaccination.notes],
  ];
  const filled = rows.filter((row): row is [string, string] => row[1] !== null);

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: vaccination.vaccineName }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <View style={[styles.badges, { gap: spacing.sm }]}>
          {status ? <StatusBadge status={status} label={statusLabel(status, vaccination.nextDueOn, todayLocal())} /> : null}
          {hasAttachments ? null : <StatusBadge status="no_receipt" label={t('vaccinations.card.noReceipt')} />}
        </View>
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
          {filled.map(([label, value], index) => (
            <View
              key={label}
              style={[
                styles.row,
                { padding: spacing.md, gap: spacing.md, borderTopColor: colors.border, borderTopWidth: index === 0 ? 0 : 1 },
              ]}>
              <Text style={[typography.body, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[typography.body, styles.value, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
        </View>
        <SavedProofPhotos vaccinationId={vaccination.id} editable={active} />
        <RemindersSection
          pet={pet}
          vaccination={vaccination}
          isCurrent={isCurrent}
          offsetsDays={reminderOffsetsDays}
          onToggle={(remindersEnabled) =>
            // updateVaccination replaces every field, so each one is sent again with the new switch.
            guard.run(
              () =>
                updateVaccination(db, vaccination.id, {
                  catalogId: vaccination.catalogId,
                  vaccineName: vaccination.vaccineName,
                  appliedOn: vaccination.appliedOn,
                  nextDueOn: vaccination.nextDueOn,
                  batch: vaccination.batch,
                  brand: vaccination.brand,
                  vetName: vaccination.vetName,
                  vetLicense: vaccination.vetLicense,
                  clinic: vaccination.clinic,
                  notes: vaccination.notes,
                  remindersEnabled,
                }),
              { unlockOnSuccess: true },
            )
          }
        />
        <FormError message={guard.error} />
      </ScrollView>
      {active ? (
        <View style={[styles.footer, { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Button
            label={t('vaccinations.detail.booster')}
            onPress={() =>
              router.push({
                pathname: '/vaccinations/new',
                params: { petId: pet.id, fromVaccinationId: vaccination.id },
              })
            }
          />
          <Button
            variant="secondary"
            label={t('vaccinations.detail.edit')}
            onPress={() => router.push({ pathname: '/vaccinations/[id]/edit', params: { id: vaccination.id } })}
          />
          <Button variant="danger" label={t('vaccinations.detail.delete')} onPress={() => setConfirmingDelete(true)} />
        </View>
      ) : null}
      <ConfirmDialog
        visible={confirmingDelete}
        destructive
        title={t('vaccinations.detail.deleteConfirm.title', { name: vaccination.vaccineName })}
        message={t('vaccinations.detail.deleteConfirm.message')}
        confirmLabel={t('vaccinations.detail.deleteConfirm.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false);
          guard.run(
            () => {
              removedFiles.current = deleteVaccination(db, vaccination.id);
            },
            {
              onSuccess: () => {
                // The record is gone; a file that cannot be removed now is swept at the next start.
                discardFiles(removedFiles.current);
                setLeaving(true);
                router.dismissTo({ pathname: '/pets/[petId]', params: { petId: pet.id } });
              },
            },
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  footer: { borderTopWidth: 1 },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
  list: { borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { flex: 1, textAlign: 'right', fontWeight: '600' },
});
