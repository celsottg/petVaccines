import { Modal, StyleSheet, Text, View } from 'react-native';

import type { PhotoSource } from '@/services/photos';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Button } from './Button';

interface PhotoSourceSheetProps {
  visible: boolean;
  onPick: (source: PhotoSource) => void;
  onCancel: () => void;
}

/** Small chooser between the camera and the gallery, the same on Android and iOS. */
export function PhotoSourceSheet({ visible, onPick, onCancel }: PhotoSourceSheetProps) {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onCancel}>
      <View style={[styles.backdrop, { padding: spacing.lg, backgroundColor: colors.scrim }]}>
        <View
          accessibilityViewIsModal
          style={{ backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.md }}>
          <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text }]}>
            {t('photos.source.title')}
          </Text>
          <View style={{ gap: spacing.sm }}>
            <Button label={t('photos.source.camera')} onPress={() => onPick('camera')} />
            <Button variant="secondary" label={t('photos.source.library')} onPress={() => onPick('library')} />
            <Button variant="secondary" label={t('common.cancel')} onPress={onCancel} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center' },
});
