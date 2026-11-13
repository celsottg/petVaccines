import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { StatusBadge, type BadgeStatus } from './StatusBadge';

interface PetCardProps {
  name: string;
  details: string;
  /** Extra line under the details, such as the archive reason. */
  note?: string;
  badge?: { status: BadgeStatus; label: string };
  /** When set, the whole card is a button. */
  onPress?: () => void;
  /** Actions shown under the text. */
  children?: ReactNode;
}

export function PetCard({ name, details, note, badge, onPress, children }: PetCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  // Photos arrive in Task 7; until then the avatar shows the initial.
  const initial = name.trim().charAt(0).toUpperCase();

  const content = (
    <>
      <View style={[styles.row, { gap: spacing.md }]}>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[styles.avatar, { backgroundColor: colors.status.neutral.background }]}>
          <Text style={[typography.subtitle, { color: colors.status.neutral.text }]}>{initial}</Text>
        </View>
        <View style={[styles.body, { gap: spacing.xs }]}>
          <Text style={[typography.body, styles.name, { color: colors.text }]}>{name}</Text>
          {details ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{details}</Text> : null}
          {note ? <Text style={[typography.caption, { color: colors.textSecondary }]}>{note}</Text> : null}
          {badge ? <StatusBadge status={badge.status} label={badge.label} /> : null}
        </View>
      </View>
      {children}
    </>
  );

  const cardStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
  };

  if (!onPress) return <View style={[styles.card, cardStyle]}>{content}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[name, details, badge?.label].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, cardStyle, { opacity: pressed ? 0.85 : 1 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1 },
  name: { fontWeight: '700' },
});
