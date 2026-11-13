import { Text } from 'react-native';

import { useTheme } from '@/theme';

/** Announced error line for a failed action. Renders nothing without a message. */
export function FormError({ message }: { message?: string }) {
  const { colors, typography } = useTheme();
  if (!message) return null;
  return (
    <Text accessibilityRole="alert" accessibilityLiveRegion="assertive" style={[typography.label, { color: colors.status.overdue.text }]}>
      {message}
    </Text>
  );
}
