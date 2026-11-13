import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

interface ChoiceChipsProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
}

/** Single choice, shown as chips. The selection is announced to screen readers, not only colored. */
export function ChoiceChips<T extends string>({ label, options, value, onChange, error }: ChoiceChipsProps<T>) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.row, { gap: spacing.sm }]}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="radio"
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(option.value)}
              style={{
                backgroundColor: selected ? colors.primary : colors.surface,
                borderColor: selected ? colors.primary : colors.border,
                borderWidth: 1,
                borderRadius: radius.pill,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 48,
                justifyContent: 'center',
              }}>
              <Text style={[typography.label, { color: selected ? colors.onPrimary : colors.text }]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: colors.status.overdue.text }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap' },
});
