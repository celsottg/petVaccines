import { Modal, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme';

import { Button } from './Button';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  /** Styles the confirm button as a destructive action. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={[styles.backdrop, { padding: spacing.lg }]}>
        <View
          accessibilityViewIsModal
          style={[styles.dialog, { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }]}>
          <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text }]}>
            {title}
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{message}</Text>
          <View style={{ gap: spacing.sm }}>
            <Button label={confirmLabel} variant={destructive ? 'danger' : 'primary'} onPress={onConfirm} />
            <Button label={cancelLabel} variant="secondary" onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Scrim over any screen; it is not part of the theme palette.
  backdrop: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  dialog: {},
});
