import { StyleSheet, Text, View } from 'react-native';

import type { VaccinationStatus } from '@/domain/status';
import { useTheme } from '@/theme';

export type BadgeStatus = VaccinationStatus | 'none' | 'no_receipt';

interface StatusBadgeProps {
  status: BadgeStatus;
  label: string;
}

/** The label always carries the meaning; the color only reinforces it. */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = {
    ok: colors.status.ok,
    due_soon: colors.status.dueSoon,
    overdue: colors.status.overdue,
    none: colors.status.neutral,
    no_receipt: colors.status.neutral,
  }[status];

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.background,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xs,
        },
      ]}>
      <Text style={[typography.caption, styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start' },
  text: { fontWeight: '700' },
});
