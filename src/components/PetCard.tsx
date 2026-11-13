import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { PetAvatar } from './PetAvatar';
import { StatusBadge, type BadgeStatus } from './StatusBadge';

interface PetCardProps {
  name: string;
  details: string;
  /** Uri of the pet's photo; the initial shows when omitted. */
  photoUri?: string;
  /** Extra line under the details, such as the archive reason. */
  note?: string;
  badge?: { status: BadgeStatus; label: string };
  /** When set, the whole card is a button. */
  onPress?: () => void;
  /** Actions shown under the text. */
  children?: ReactNode;
}

export function PetCard({ name, details, photoUri, note, badge, onPress, children }: PetCardProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const content = (
    <>
      <View style={[styles.row, { gap: spacing.md }]}>
        <PetAvatar name={name} photoUri={photoUri} />
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
  body: { flex: 1 },
  name: { fontWeight: '700' },
});
