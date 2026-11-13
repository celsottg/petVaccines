import { StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme';

interface FormFieldProps
  extends Pick<TextInputProps, 'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'maxLength' | 'autoCapitalize'> {
  label: string;
  hint?: string;
  error?: string;
}

export function FormField({ label, hint, error, ...inputProps }: FormFieldProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const message = error ?? hint;

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        {...inputProps}
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
