import { t } from '@/i18n'; // keep first: initializes i18next before any screen renders

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

import { db } from '@/db/client';
import migrations from '@/db/migrations/migrations';
import { useTheme } from '@/theme';

type MigrationsArg = Parameters<typeof useMigrations>[1];

export default function RootLayout() {
  const { colors, spacing, typography } = useTheme();
  // drizzle-orm 1.0.0-rc.5 still types `journal` as required, but drizzle-kit no
  // longer generates it and the hook only reads `migrations`.
  const { success, error } = useMigrations(db, migrations as unknown as MigrationsArg);

  // Routes only render once the schema is up to date.
  if (error) {
    return (
      <View
        style={[styles.error, { backgroundColor: colors.background, padding: spacing.lg, gap: spacing.sm }]}>
        <Text accessibilityRole="header" style={[typography.title, { color: colors.text }]}>
          {t('database.error.title')}
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary }]}>
          {t('database.error.description')}
        </Text>
        <Text selectable style={[typography.body, { color: colors.text }]}>
          {error.message}
        </Text>
      </View>
    );
  }
  if (!success) return null;

  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.primary,
          headerTitleStyle: { color: colors.text },
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center' },
});
