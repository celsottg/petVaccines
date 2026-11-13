import { router } from 'expo-router';
import { Alert, Text } from 'react-native';

import { Button } from '@/components/Button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { FormError } from '@/components/FormError';
import { useBackupImport } from '@/components/useBackupImport';
import { formatBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { t } from '@/i18n';
import type { BackupPreview } from '@/services/backup/import';
import { useTheme } from '@/theme';

interface Counts {
  pets: number;
  vaccinations: number;
  photos: number;
}

function confirmMessage(preview: BackupPreview, device: Counts): string {
  const { counts, missing } = preview;
  const lines = [
    t('backup.import.summary', {
      date: formatBrDate(todayLocal(new Date(preview.exportedAt))),
      version: preview.appVersion,
      pets: t('backup.petsCount', { count: counts.pets }),
      vaccinations: t('backup.vaccinationsCount', { count: counts.vaccinations }),
      photos: t('backup.photosCount', { count: counts.photos }),
    }),
  ];
  if (missing.length > 0) lines.push(t('backup.import.missing', { count: missing.length }));
  lines.push(
    hasData(device)
      ? t('backup.import.replaceWarning', {
          pets: t('backup.petsCount', { count: device.pets }),
          vaccinations: t('backup.vaccinationsCount', { count: device.vaccinations }),
        })
      : t('backup.import.emptyDevice'),
  );
  return lines.join('\n\n');
}

const hasData = (device: Counts) => device.pets > 0 || device.vaccinations > 0 || device.photos > 0;

/** The "Restaurar" part of the backup screen. `device` is what is on this device now. */
export function RestoreSection({ device }: { device: Counts }) {
  const { colors, spacing, typography } = useTheme();
  const restore = useBackupImport();
  const busy = restore.reading || restore.applying;
  const { preview } = restore;

  async function confirm() {
    const missing = preview?.missing.length ?? 0;
    if (!(await restore.confirm())) return;
    router.dismissTo('/');
    const note = missing > 0 ? `\n\n${t('backup.import.missing', { count: missing })}` : '';
    Alert.alert(t('backup.import.doneTitle'), `${t('backup.import.done')}${note}`);
  }

  return (
    <>
      <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text, marginTop: spacing.sm }]}>
        {t('backup.import.title')}
      </Text>
      <Button
        variant="secondary"
        busy={busy}
        label={restore.applying ? t('backup.import.restoring') : restore.reading ? t('backup.import.reading') : t('backup.import.run')}
        onPress={() => void restore.choose()}
      />
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('backup.import.hint')}</Text>
      <FormError message={restore.error} />
      {preview ? (
        <ConfirmDialog
          visible={!restore.applying}
          title={t('backup.import.confirmTitle')}
          message={confirmMessage(preview, device)}
          confirmLabel={hasData(device) ? t('backup.import.confirmReplace') : t('backup.import.confirmRestore')}
          cancelLabel={t('backup.import.cancel')}
          destructive={hasData(device)}
          onConfirm={() => void confirm()}
          onCancel={restore.cancel}
        />
      ) : null}
    </>
  );
}
