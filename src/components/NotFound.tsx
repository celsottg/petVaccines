import { router, Stack } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { Button } from './Button';

/** Shown when the pet or vaccination in the route no longer exists. */
export function NotFound() {
  const { colors, spacing, typography } = useTheme();

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('notFound.title') }} />
      <View style={[styles.content, { padding: spacing.lg, gap: spacing.md }]}>
        <Text accessibilityRole="header" style={[typography.subtitle, styles.center, { color: colors.text }]}>
          {t('notFound.title')}
        </Text>
        <Text style={[typography.body, styles.center, { color: colors.textSecondary }]}>{t('notFound.description')}</Text>
        <Button label={t('notFound.back')} onPress={() => router.dismissTo('/')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: 'center' },
  center: { textAlign: 'center' },
});
