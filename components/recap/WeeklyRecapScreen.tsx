import { router } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AtmosphericBackground } from '@/components/inspiration/AtmosphericBackground';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { ThemeLayout } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useDreamsData } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useSubscription } from '@/hooks/useSubscription';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamThemeLabel, getEmotionFamilyLabel } from '@/lib/dreamLabels';
import { buildPaywallHref } from '@/lib/paywallRoute';
import { TID } from '@/lib/testIDs';
import { buildWeeklyRecap } from '@/lib/weeklyRecap';

/**
 * "Your week in dreams": the Sunday-morning recap opened from the weekly push
 * or from the home screen. Free users see rhythm, theme and symbol; the
 * recurring emotion stays a Plus signal (same gate as the Statistics screen)
 * and doubles as a contextual entry to the paywall.
 */
export function WeeklyRecapScreen() {
  const { colors, mode, shadows } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { formatDate } = useLocaleFormatting();
  const { dreams, loaded } = useDreamsData();
  const { isActive: isPlus } = useSubscription();
  const [now] = useState(() => Date.now());

  const recap = useMemo(() => buildWeeklyRecap(dreams, now), [dreams, now]);

  const rangeLabel = useMemo(() => {
    try {
      const start = formatDate(new Date(recap.weekStart), { day: 'numeric', month: 'short' });
      const end = formatDate(new Date(recap.weekEnd), { day: 'numeric', month: 'short' });
      return `${start} – ${end}`;
    } catch {
      return '';
    }
  }, [formatDate, recap.weekEnd, recap.weekStart]);

  const delta = recap.dreamCount - recap.previousWeekCount;
  const deltaLabel =
    recap.previousWeekCount === 0 && recap.dreamCount === 0
      ? null
      : delta > 0
        ? t('weekly_recap.delta.more', { count: delta })
        : delta < 0
          ? t('weekly_recap.delta.fewer', { count: Math.abs(delta) })
          : t('weekly_recap.delta.same');

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }, []);

  const handleRecord = useCallback(() => {
    router.push('/recording');
  }, []);

  const handleOpenDream = useCallback((id: number) => {
    router.push(`/journal/${id}`);
  }, []);

  const handleUnlockEmotions = useCallback(() => {
    router.push(buildPaywallHref('stats_profile'));
  }, []);

  const backButtonTop = insets.top + ThemeLayout.spacing.sm;
  const contentPaddingTop = backButtonTop + 44 + ThemeLayout.spacing.md;
  const cardStyle = [
    styles.card,
    { backgroundColor: noctalia.surface.raised, borderColor: noctalia.surface.border },
  ];

  const themeLabel = recap.topTheme ? getDreamThemeLabel(recap.topTheme.theme, t) : null;
  const emotionLabel = recap.topEmotion ? getEmotionFamilyLabel(recap.topEmotion.family, t) : null;
  const nextDream = recap.dreamToExplore ?? recap.dreamToAnalyze;

  return (
    <View style={[styles.container, { backgroundColor: noctalia.screen.background }]} testID={TID.Screen.WeeklyRecap}>
      <AtmosphericBackground />

      <Pressable
        onPress={handleBack}
        style={[
          styles.floatingBackButton,
          { top: backButtonTop, backgroundColor: noctalia.surface.raised },
          shadows.lg,
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('journal.back_button')}
        testID={TID.Button.WeeklyRecapBack}
      >
        <IconSymbol name="chevron.left" size={22} color={noctalia.accent.text} />
      </Pressable>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{
          paddingBottom: insets.bottom + ThemeLayout.spacing.xl,
          paddingTop: contentPaddingTop,
        }}
      >
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <Text style={[styles.eyebrow, { color: noctalia.accent.text }]}>{rangeLabel}</Text>
            <Text style={[styles.title, { color: noctalia.text.primary }]}>{t('weekly_recap.title')}</Text>
            <Text style={[styles.subtitle, { color: noctalia.text.secondary }]}>
              {loaded && recap.dreamCount === 0
                ? t('weekly_recap.empty.subtitle')
                : t('weekly_recap.subtitle')}
            </Text>
          </View>

          <View style={styles.tiles}>
            <View style={[styles.tile, cardStyle]}>
              <Text style={[styles.tileValue, { color: noctalia.text.primary }]} testID={TID.Text.WeeklyRecapCount}>
                {recap.dreamCount}
              </Text>
              <Text style={[styles.tileLabel, { color: noctalia.text.secondary }]}>
                {recap.dreamCount === 1 ? t('weekly_recap.tile.dreams_one') : t('weekly_recap.tile.dreams')}
              </Text>
              {deltaLabel ? (
                <Text style={[styles.tileHint, { color: noctalia.text.tertiary }]}>{deltaLabel}</Text>
              ) : null}
            </View>
            <View style={[styles.tile, cardStyle]}>
              <Text style={[styles.tileValue, { color: noctalia.text.primary }]}>{recap.currentStreak}</Text>
              <Text style={[styles.tileLabel, { color: noctalia.text.secondary }]}>
                {recap.currentStreak === 1 ? t('weekly_recap.tile.streak_one') : t('weekly_recap.tile.streak')}
              </Text>
            </View>
            <View style={[styles.tile, cardStyle]}>
              <Text style={[styles.tileValue, { color: noctalia.text.primary }]}>{recap.analyzedCount}</Text>
              <Text style={[styles.tileLabel, { color: noctalia.text.secondary }]}>{t('weekly_recap.tile.analyzed')}</Text>
            </View>
          </View>

          {recap.dreamCount === 0 ? (
            <View style={cardStyle}>
              <Text style={[styles.cardTitle, { color: noctalia.text.primary }]}>{t('weekly_recap.empty.title')}</Text>
              <Text style={[styles.cardBody, { color: noctalia.text.secondary }]}>{t('weekly_recap.empty.body')}</Text>
              <Pressable
                onPress={handleRecord}
                accessibilityRole="button"
                testID={TID.Button.WeeklyRecapRecord}
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.primaryLabel, { color: noctalia.action.primaryText }]}>{t('weekly_recap.empty.cta')}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={cardStyle}>
                <View style={styles.cardHeader}>
                  <IconSymbol name="sparkles" size={18} color={noctalia.accent.text} />
                  <Text style={[styles.cardEyebrow, { color: noctalia.accent.text }]}>{t('weekly_recap.signals.title')}</Text>
                </View>
                <View style={styles.signalRow}>
                  <Text style={[styles.signalLabel, { color: noctalia.text.secondary }]}>{t('weekly_recap.signals.theme')}</Text>
                  <Text style={[styles.signalValue, { color: noctalia.text.primary }]} testID={TID.Text.WeeklyRecapTheme}>
                    {themeLabel ?? t('weekly_recap.signals.none')}
                  </Text>
                </View>
                <View style={styles.signalRow}>
                  <Text style={[styles.signalLabel, { color: noctalia.text.secondary }]}>{t('weekly_recap.signals.symbol')}</Text>
                  <Text style={[styles.signalValue, { color: noctalia.text.primary }]} testID={TID.Text.WeeklyRecapSymbol}>
                    {recap.topSymbol
                      ? t('weekly_recap.signals.symbol_value', { name: recap.topSymbol.name, count: recap.topSymbol.count })
                      : t('weekly_recap.signals.none')}
                  </Text>
                </View>
                <View style={[styles.signalRow, styles.signalRowLast]}>
                  <Text style={[styles.signalLabel, { color: noctalia.text.secondary }]}>{t('weekly_recap.signals.emotion')}</Text>
                  {isPlus ? (
                    <Text style={[styles.signalValue, { color: noctalia.text.primary }]} testID={TID.Text.WeeklyRecapEmotion}>
                      {emotionLabel ?? t('weekly_recap.signals.none')}
                    </Text>
                  ) : (
                    <Pressable
                      onPress={handleUnlockEmotions}
                      accessibilityRole="button"
                      testID={TID.Button.WeeklyRecapUnlockEmotion}
                      style={[styles.lockedPill, { backgroundColor: noctalia.surface.soft, borderColor: noctalia.surface.border }]}
                    >
                      <IconSymbol name="lock.fill" size={12} color={noctalia.accent.text} />
                      <Text style={[styles.lockedLabel, { color: noctalia.accent.text }]}>
                        {recap.topEmotion
                          ? t('weekly_recap.signals.emotion_locked')
                          : t('weekly_recap.signals.emotion_locked_empty')}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {nextDream ? (
                <View style={cardStyle}>
                  <View style={styles.cardHeader}>
                    <IconSymbol name="moon.stars.fill" size={18} color={noctalia.accent.text} />
                    <Text style={[styles.cardEyebrow, { color: noctalia.accent.text }]}>
                      {recap.dreamToExplore ? t('weekly_recap.next.explore_title') : t('weekly_recap.next.analyze_title')}
                    </Text>
                  </View>
                  <Text style={[styles.cardTitle, { color: noctalia.text.primary }]} numberOfLines={2}>
                    {nextDream.title || t('weekly_recap.next.untitled')}
                  </Text>
                  <Text style={[styles.cardBody, { color: noctalia.text.secondary }]} numberOfLines={3}>
                    {nextDream.transcript}
                  </Text>
                  <Pressable
                    onPress={() => handleOpenDream(nextDream.id)}
                    accessibilityRole="button"
                    testID={TID.Button.WeeklyRecapOpenDream}
                    style={({ pressed }) => [
                      styles.primary,
                      { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.primaryLabel, { color: noctalia.action.primaryText }]}>
                      {recap.dreamToExplore ? t('weekly_recap.next.explore_cta') : t('weekly_recap.next.analyze_cta')}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={cardStyle}>
                  <Text style={[styles.cardTitle, { color: noctalia.text.primary }]}>{t('weekly_recap.next.all_done_title')}</Text>
                  <Text style={[styles.cardBody, { color: noctalia.text.secondary }]}>{t('weekly_recap.next.all_done_body')}</Text>
                  <Pressable
                    onPress={handleRecord}
                    accessibilityRole="button"
                    testID={TID.Button.WeeklyRecapRecord}
                    style={({ pressed }) => [
                      styles.primary,
                      { backgroundColor: noctalia.action.primary, borderColor: noctalia.action.primaryBorder },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.primaryLabel, { color: noctalia.action.primaryText }]}>{t('weekly_recap.empty.cta')}</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  floatingBackButton: {
    position: 'absolute',
    left: 20,
    zIndex: 50,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    gap: 18,
  },
  titleSection: {
    gap: 6,
    marginBottom: 4,
  },
  eyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.fraunces.bold,
    fontSize: 30,
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    gap: 2,
  },
  tileValue: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 26,
    lineHeight: 30,
  },
  tileLabel: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 12,
    textAlign: 'center',
  },
  tileHint: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 11,
    textAlign: 'center',
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardEyebrow: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontFamily: Fonts.fraunces.semiBold,
    fontSize: 20,
    lineHeight: 26,
  },
  cardBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(127,127,127,0.25)',
  },
  signalRowLast: {
    borderBottomWidth: 0,
  },
  signalLabel: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
  },
  signalValue: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  lockedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
  },
  lockedLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 12,
  },
  primary: {
    marginTop: 6,
    minHeight: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 15,
  },
  pressed: {
    opacity: 0.85,
  },
});

export default WeeklyRecapScreen;
