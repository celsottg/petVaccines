import { StyleSheet, Switch, Text, View, Pressable } from 'react-native';

import type { Pet, Vaccination } from '@/data/types';
import { catalogMatcher } from '@/catalog';
import { formatBrDate } from '@/domain/dateInput';
import { todayLocal } from '@/domain/dates';
import { planReminders } from '@/domain/reminders';
import { t } from '@/i18n';
import { useTheme } from '@/theme';

import { useNotificationPermission } from './useNotificationPermission';

interface RemindersSectionProps {
  pet: Pet;
  vaccination: Vaccination;
  /** Whether this is the current record of its vaccine; only that one has reminders. */
  isCurrent: boolean;
  offsetsDays: number[];
  /** Writes the new state of the switch. */
  onToggle: (enabled: boolean) => void;
}

/** Why a record has no reminders, or null when it can have them. */
function unavailableMessage(pet: Pet, vaccination: Vaccination, isCurrent: boolean): string | null {
  if (pet.status !== 'active') return t('reminders.detail.archived');
  if (!isCurrent) return t('reminders.detail.notCurrent');
  if (vaccination.nextDueOn === null) return t('reminders.detail.noNextDue');
  return null;
}

/** Reminder dates, switch and system-permission notice for the vaccination detail screen. */
export function RemindersSection({ pet, vaccination, isCurrent, offsetsDays, onToggle }: RemindersSectionProps) {
  const { colors, spacing, radius, typography } = useTheme();
  const permission = useNotificationPermission();
  const unavailable = unavailableMessage(pet, vaccination, isCurrent);
  const enabled = vaccination.remindersEnabled;

  // The dates this record alone would get: the planner decides which ones are still ahead.
  const dates = planReminders({
    pets: [pet],
    vaccinations: [vaccination],
    offsetsDays,
    today: todayLocal(),
    limit: offsetsDays.length,
    matcherFor: catalogMatcher,
  }).sort((a, b) => b.daysBefore - a.daysBefore);

  return (
    <View style={{ gap: spacing.sm }}>
      <Text accessibilityRole="header" style={[typography.subtitle, { color: colors.text }]}>
        {t('reminders.detail.title')}
      </Text>
      {unavailable ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>{unavailable}</Text>
      ) : (
        <>
          <Pressable
            accessibilityRole="switch"
            accessibilityLabel={t('reminders.detail.switchLabel')}
            accessibilityState={{ checked: enabled }}
            onPress={() => onToggle(!enabled)}
            style={[
              styles.switchRow,
              { padding: spacing.md, gap: spacing.md, backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg },
            ]}>
            <Text style={[typography.body, styles.switchText, { color: colors.text }]}>{t('reminders.detail.switchLabel')}</Text>
            <Switch
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              pointerEvents="none"
              value={enabled}
              trackColor={{ true: colors.primary, false: colors.border }}
            />
          </Pressable>
          {enabled ? (
            dates.length > 0 ? (
              <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radius.lg }]}>
                {dates.map((reminder, index) => (
                  <View
                    key={reminder.daysBefore}
                    style={[
                      styles.row,
                      { padding: spacing.md, gap: spacing.md, borderTopColor: colors.border, borderTopWidth: index === 0 ? 0 : 1 },
                    ]}>
                    <Text style={[typography.body, { color: colors.textSecondary }]}>
                      {reminder.daysBefore === 0
                        ? t('reminders.detail.onTheDay')
                        : t('reminders.detail.daysBefore', { count: reminder.daysBefore })}
                    </Text>
                    <Text style={[typography.body, styles.value, { color: colors.text }]}>{formatBrDate(reminder.fireOn)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={[typography.body, { color: colors.textSecondary }]}>{t('reminders.detail.allPassed')}</Text>
            )
          ) : (
            <Text style={[typography.body, { color: colors.textSecondary }]}>{t('reminders.detail.switchedOff')}</Text>
          )}
          {permission === 'denied' ? (
            <Text
              accessibilityRole="alert"
              style={[typography.label, { color: colors.status.dueSoon.text, backgroundColor: colors.status.dueSoon.background, padding: spacing.md, borderRadius: radius.md }]}>
              {t('reminders.detail.permissionDenied')}
            </Text>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, minHeight: 48 },
  switchText: { flex: 1 },
  list: { borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  value: { fontWeight: '600' },
});
