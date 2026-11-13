import { Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

export default function PetsScreen() {
  const { colors, spacing, radius, typography } = useTheme();

  return (
    <SafeAreaView edges={['top']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false, title: t('pets.title') }} />
      <ScrollView contentContainerStyle={[styles.content, { padding: spacing.lg, gap: spacing.md }]}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {t('pets.title')}
        </Text>
        <View style={[styles.empty, { gap: spacing.sm, paddingVertical: spacing.xl }]}>
          <Text style={[typography.subtitle, styles.center, { color: colors.text }]}>
            {t('pets.empty.title')}
          </Text>
          <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>
            {t('pets.empty.description')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          // Navigation to the pet form is wired in Task 5, when the route exists.
          onPress={() => {}}
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: colors.primary,
              borderRadius: radius.md,
              paddingVertical: spacing.md,
              opacity: pressed ? 0.85 : 1,
            },
          ]}>
          <Text style={[typography.label, { color: colors.onPrimary }]}>{t('pets.add')}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
  empty: { alignItems: 'center' },
  center: { textAlign: 'center' },
  button: { alignItems: 'center' },
});
