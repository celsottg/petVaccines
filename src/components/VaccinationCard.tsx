import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { WalletEntry } from '@/data/wallet';
import { todayLocal } from '@/domain/dates';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { StatusBadge } from './StatusBadge';
import { statusLabel, vaccinationDates } from './vaccinationLabels';

interface VaccinationCardProps {
  entry: WalletEntry;
  onPress: () => void;
}

/** One record in the wallet. The due-date badge only exists for current records of active pets (`entry.status`). */
export function VaccinationCard({ entry: { vaccination, status, hasAttachments }, onPress }: VaccinationCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const today = todayLocal();
  const dates = vaccinationDates(vaccination, status !== null);
  const badges = [
    status ? { status, label: statusLabel(status, vaccination.nextDueOn, today) } : null,
    hasAttachments ? null : { status: 'no_receipt' as const, label: t('vaccinations.card.noReceipt') },
  ].filter((badge) => badge !== null);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[vaccination.vaccineName, dates, ...badges.map((b) => b.label)].join(', ')}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
          gap: spacing.xs,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[typography.body, styles.name, { color: colors.text }]}>{vaccination.vaccineName}</Text>
      <Text style={[typography.caption, { color: colors.textSecondary }]}>{dates}</Text>
      {badges.length > 0 ? (
        <View style={[styles.badges, { gap: spacing.sm }]}>
          {badges.map((badge) => (
            <StatusBadge key={badge.status} status={badge.status} label={badge.label} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, minHeight: 48 },
  name: { fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap' },
});
