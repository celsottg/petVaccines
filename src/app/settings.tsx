import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { FormError } from '@/components/FormError';
import { FormField } from '@/components/FormField';
import { useGuardedAction } from '@/components/useGuardedAction';
import { setSetting, type Settings } from '@/data/settings';
import { useSettings } from '@/data/useSettings';
import { db } from '@/db/client';
import { validateSettingsInput, type SettingsErrors } from '@/domain/settingsInput';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

const REPOSITORY_URL = 'https://github.com/celsottg/petVaccines';

export default function SettingsScreen() {
  const { settings, loaded } = useSettings();
  // The form reads its starting values once, so it waits for the first read.
  return loaded ? <SettingsForm settings={settings} /> : null;
}

function SettingsForm({ settings }: { settings: Settings }) {
  const { colors, spacing, radius, typography } = useTheme();
  const [dueSoon, setDueSoon] = useState(String(settings.dueSoonDays));
  const [offsets, setOffsets] = useState(settings.reminderOffsetsDays.map(String));
  const [errors, setErrors] = useState<SettingsErrors>();
  const [browserError, setBrowserError] = useState(false);
  const guard = useGuardedAction();

  function save() {
    const result = validateSettingsInput({ dueSoonDays: dueSoon, offsets });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors(undefined);
    guard.run(
      () =>
        db.transaction((tx) => {
          setSetting(tx, 'due_soon_days', result.value.dueSoonDays);
          setSetting(tx, 'reminder_offsets_days', result.value.reminderOffsetsDays);
        }),
      { onSuccess: () => router.dismissTo('/') },
    );
  }

  async function openRepository() {
    setBrowserError(false);
    try {
      await Linking.openURL(REPOSITORY_URL);
    } catch {
      setBrowserError(true);
    }
  }

  const offsetError = (index: number) => {
    const code = errors?.offsets[index];
    return code ? t(`settings.errors.${code}`) : undefined;
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.flex, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t('settings.title') }} />
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <FormField
          label={t('settings.dueSoonDays')}
          hint={t('settings.dueSoonHint')}
          error={errors?.dueSoonDays ? t('settings.errors.dueSoonInvalid') : undefined}
          value={dueSoon}
          onChangeText={setDueSoon}
          keyboardType="number-pad"
          maxLength={3}
        />

        <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text }]}>
          {t('settings.offsetsTitle')}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('settings.offsetsHint')}</Text>
        {offsets.map((value, index) => (
          <View key={index} style={[styles.offsetRow, { gap: spacing.sm }]}>
            <View style={styles.flex}>
              <FormField
                label={t('settings.offsetLabel', { index: index + 1 })}
                error={offsetError(index)}
                value={value}
                onChangeText={(text) => setOffsets((list) => list.map((item, i) => (i === index ? text : item)))}
                keyboardType="number-pad"
                maxLength={3}
              />
            </View>
            <Button
              variant="secondary"
              label={t('settings.removeOffset')}
              accessibilityLabel={t('settings.removeOffsetLabel', { index: index + 1 })}
              onPress={() => setOffsets((list) => list.filter((_, i) => i !== index))}
            />
          </View>
        ))}
        {errors?.offsetsRequired ? <FormError message={t('settings.errors.offsetsRequired')} /> : null}
        <Button variant="secondary" label={t('settings.addOffset')} onPress={() => setOffsets((list) => [...list, ''])} />

        <View style={[styles.about, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, gap: spacing.sm }]}>
          <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text }]}>
            {t('settings.about.title')}
          </Text>
          <View style={styles.aboutRow}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('settings.about.version')}</Text>
            <Text style={[typography.body, styles.value, { color: colors.text }]}>{Constants.expoConfig?.version}</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('settings.about.license')}</Text>
            <Text style={[typography.body, styles.value, { color: colors.text }]}>{t('settings.about.licenseValue')}</Text>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('settings.about.repositoryLink')}
            onPress={() => void openRepository()}
            style={styles.link}>
            <Text style={[typography.label, { color: colors.primary }]}>{t('settings.about.repositoryLink')}</Text>
          </Pressable>
          {browserError ? <FormError message={t('settings.about.repositoryError')} /> : null}
          <Text style={[typography.caption, { color: colors.textSecondary }]}>{t('settings.about.disclaimer')}</Text>
        </View>
        <FormError message={guard.error} />
      </ScrollView>
      <View style={[styles.footer, { padding: spacing.md, backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Button label={t('settings.save')} onPress={save} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  offsetRow: { flexDirection: 'row', alignItems: 'flex-start' },
  about: { borderWidth: 1 },
  aboutRow: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontWeight: '600' },
  link: { minHeight: 48, justifyContent: 'center' },
  footer: { borderTopWidth: 1 },
});
