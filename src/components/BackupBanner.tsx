import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { useBackupStatus } from '@/data/useBackupStatus';
import { backupAgeDays, shouldWarnBackup } from '@/domain/backupWarning';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Button } from './Button';

/**
 * Warns on top of "Meus pets" that the backup is out of date. Renders nothing
 * unless `shouldWarnBackup` holds; it follows the database, so it appears or
 * disappears by itself after a backup or a change.
 */
export function BackupBanner() {
  const { colors, spacing, radius, typography } = useTheme();
  const status = useBackupStatus();
  const now = new Date();

  if (!status.loaded || !shouldWarnBackup({ ...status, now })) return null;

  const title =
    status.lastBackupAt === null
      ? t('backup.banner.titleNever')
      : t('backup.banner.title', { count: backupAgeDays(status.lastBackupAt, now) });
  const body = t(status.lastBackupAt === null ? 'backup.banner.bodyNever' : 'backup.banner.body', {
    count: status.vaccinationsSince,
  });
  const { background, text } = colors.status.dueSoon;

  return (
    <View style={[styles.banner, { backgroundColor: background, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }]}>
      <View accessible accessibilityRole="summary" accessibilityLabel={`${title}. ${body}`} style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: text }]}>{title}</Text>
        <Text style={[typography.body, { color: text }]}>{body}</Text>
      </View>
      <Button label={t('backup.banner.action')} onPress={() => router.push('/backup')} />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignSelf: 'stretch' },
});
