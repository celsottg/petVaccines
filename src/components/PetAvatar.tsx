import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

interface PetAvatarProps {
  name: string;
  /** The pet photo; the initial shows when there is none. */
  photoUri?: string;
  size?: number;
}

export function PetAvatar({ name, photoUri, size = 52 }: PetAvatarProps) {
  const { colors, typography } = useTheme();
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (photoUri) {
    return (
      <Image
        accessibilityLabel={t('photos.pet.avatarLabel', { name })}
        source={{ uri: photoUri }}
        contentFit="cover"
        style={[shape, { backgroundColor: colors.status.neutral.background }]}
      />
    );
  }
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.initial, shape, { backgroundColor: colors.status.neutral.background }]}>
      <Text style={[typography.subtitle, { color: colors.status.neutral.text }]}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  initial: { alignItems: 'center', justifyContent: 'center' },
});
