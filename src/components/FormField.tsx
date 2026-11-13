import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

interface FormFieldProps
  extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'maxLength' | 'autoCapitalize' | 'testID'> {
  label: string;
  hint?: string;
  error?: string;
}

/** Stable id for UI tests, from the visible label: "Data de aplicação" becomes "input-data-de-aplicacao". */
export function defaultTestId(label: string): string {
  const slug = label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `input-${slug}`;
}

export function FormField({ label, hint, error, ...inputProps }: FormFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const message = error ?? hint;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...inputProps}
        // The label Text and this input both read as the label; the id tells UI tests which one is the input.
        testID={inputProps.testID ?? defaultTestId(label)}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        style={[
          typography.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.status.overdue.text : colors.border,
            borderRadius: radius.md,
            paddingHorizontal: spacing.md,
          },
        ]}
      />
      {message ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={[typography.caption, { color: error ? colors.status.overdue.text : colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: { borderWidth: 1, minHeight: 48 },
});
