import { Pressable, StyleSheet, Text } from 'react-native';

import { useTheme } from '@/theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  /** Longer label for screen readers when the visible text needs context. */
  accessibilityLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger';
  /** A long action is running: announced to screen readers, and presses are ignored. */
  busy?: boolean;
}

export function Button({ label, onPress, variant = 'primary', accessibilityLabel, busy = false }: ButtonProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const palette = {
    primary: { background: colors.primary, border: colors.primary, text: colors.onPrimary },
    secondary: { background: colors.surface, border: colors.border, text: colors.text },
    danger: { background: colors.surface, border: colors.status.overdue.text, text: colors.status.overdue.text },
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={busy ? { busy: true, disabled: true } : undefined}
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: palette.background,
          borderColor: palette.border,
          borderRadius: radius.md,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.sm,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[typography.label, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, minHeight: 48 },
});
