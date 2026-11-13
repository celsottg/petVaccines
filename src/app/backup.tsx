import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { RestoreSection } from '@/components/RestoreSection';
import { useExportAction } from '@/components/useExportAction';
import { useGuardedAction } from '@/components/useGuardedAction';
import { setSetting } from '@/data/settings';
import { useBackupStatus, type BackupStatus } from '@/data/useBackupStatus';
import { db } from '@/db/client';
import { backupAgeDays } from '@/domain/backupWarning';
import { formatBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { parseBackupWarningDays } from '@/domain/settingsInput';
import { t } from '@/i18n';
import { exportBackup } from '@/services/backup/export';
import { useTheme } from '@/theme';

export default function BackupScreen() {
  const status = useBackupStatus();
  // The warning field reads its starting value once, so it waits for the first read.
  return status.loaded ? <BackupContent status={status} /> : null;
}

function BackupContent({ status }: { status: BackupStatus }) {
  const { colors, spacing, radius, typography } = useTheme();
  const backup = useExportAction(exportBackup, { failed: t('backup.error'), unavailable: t('backup.unavailable') });
  const [days, setDays] = useState(String(status.warningDays));
  const [invalid, setInvalid] = useState(false);
  const [saved, setSaved] = useState(false);
  const guard = useGuardedAction();
  const now = new Date();

  function saveDays() {
    setSaved(false);
    const value = parseBackupWarningDays(days);
    setInvalid(value === undefined);
    if (value === undefined) return;
    guard.run(() => db.transaction((tx) => setSetting(tx, 'backup_warning_days', value)), {
      onSuccess: () => setSaved(true),
      unlockOnSuccess: true,
    });
  }

  const lastBackup =
    status.lastBackupAt === null
      ? t('backup.never')
      : t('backup.lastBackupValue', {
          date: formatBrDate(todayLocal(new Date(status.lastBackupAt))),
          age: t('backup.ago', { count: backupAgeDays(status.lastBackupAt, now) }),
        });
  const content = t('backup.contentValue', {
    pets: t('backup.petsCount', { count: status.counts.pets }),
    vaccinations: t('backup.vaccinationsCount', { count: status.counts.vaccinations }),
    photos: t('backup.photosCount', { count: status.counts.photos }),
  });
  const rows = [
    [t('backup.lastBackup'), lastBackup],
    [t('backup.changes'), t('backup.changesCount', { count: status.vaccinationsSince })],
    [t('backup.content'), content],
  ];
  const missing = backup.result?.missingPhotos ?? 0;

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('backup.title') }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <Text style={[typography.body, { color: colors.text }]}>{t('backup.intro')}</Text>

        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }]}>
          {rows.map(([label, value]) => (
            <View key={label} accessible accessibilityLabel={`${label}: ${value}`} style={styles.row}>
              <Text style={[typography.body, styles.label, { color: colors.textSecondary }]}>{label}</Text>
              <Text style={[typography.body, styles.value, { color: colors.text }]}>{value}</Text>
            </View>
          ))}
        </View>

        <Button label={backup.exporting ? t('backup.running') : t('backup.run')} busy={backup.exporting} onPress={() => void backup.start()} />
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('backup.runHint')}</Text>
        <FormError message={backup.error} />
        {backup.result ? (
          <Text accessibilityLiveRegion="polite" style={[typography.label, { color: colors.text }]}>
            {t('backup.done')}
          </Text>
        ) : null}
        {missing > 0 ? (
          <Text accessibilityRole="alert" style={[typography.label, { color: colors.status.dueSoon.text }]}>
            {t('backup.missingPhotos', { count: missing })}
          </Text>
        ) : null}

        <RestoreSection device={status.counts} />

        <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text }]}>
          {t('backup.warningTitle')}
        </Text>
        <FormField
          label={t('backup.warningDays')}
          hint={t('backup.warningDaysHint')}
          error={invalid ? t('backup.warningDaysInvalid') : undefined}
          value={days}
          onChangeText={(text) => {
            setDays(text);
            setSaved(false);
          }}
          keyboardType="number-pad"
          maxLength={3}
        />
        <Button variant="secondary" label={t('backup.save')} onPress={saveDays} />
        {saved ? (
          <Text accessibilityLiveRegion="polite" style={[typography.label, { color: colors.text }]}>
            {t('backup.saved')}
          </Text>
        ) : null}
        <FormError message={guard.error} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  label: { flexShrink: 1 },
  value: { flexShrink: 1, fontWeight: '600', textAlign: 'right' },
});
