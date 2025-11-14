import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';

import { ScreenContainer } from '@/components/ScreenContainer';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DESKTOP_BREAKPOINT } from '@/constants/layout';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { RITUALS, type RitualConfig, type RitualId } from '@/lib/inspirationRituals';
import { TID } from '@/lib/testIDs';
import type { ThemeMode } from '@/lib/types';
import { getRitualPreference, saveRitualPreference } from '@/services/storageService';

type IconName = Parameters<typeof IconSymbol>[0]['name'];

const TIP_KEYS = [
  'inspiration.tips.captureImmediately',
  'inspiration.tips.titleLater',
  'inspiration.tips.focusEmotion',
  'inspiration.tips.observePatterns',
  'inspiration.tips.prepareNight',
] as const;

type CopyCard = {
  id: string;
  icon: IconName;
  titleKey: string;
  bodyKey: string;
};

const PROMPT_CARDS: CopyCard[] = [
  {
    id: 'people',
    icon: 'lightbulb.fill',
    titleKey: 'inspiration.prompts.people.title',
    bodyKey: 'inspiration.prompts.people.body',
  },
  {
    id: 'emotion',
    icon: 'sparkles',
    titleKey: 'inspiration.prompts.emotions.title',
    bodyKey: 'inspiration.prompts.emotions.body',
  },
  {
    id: 'symbols',
    icon: 'moon.stars.fill',
    titleKey: 'inspiration.prompts.symbols.title',
    bodyKey: 'inspiration.prompts.symbols.body',
  },
];

const EXERCISE_CARDS: CopyCard[] = [
  {
    id: 'intention',
    icon: 'moon.stars.fill',
    titleKey: 'inspiration.exercises.intention.title',
    bodyKey: 'inspiration.exercises.intention.body',
  },
  {
    id: 'patterns',
    icon: 'calendar',
    titleKey: 'inspiration.exercises.patterns.title',
    bodyKey: 'inspiration.exercises.patterns.body',
  },
  {
    id: 'micro',
    icon: 'pencil',
    titleKey: 'inspiration.exercises.microjournaling.title',
    bodyKey: 'inspiration.exercises.microjournaling.body',
  },
];

const MYTH_CARDS: CopyCard[] = [
  {
    id: 'memory',
    icon: 'quote.opening',
    titleKey: 'inspiration.myths.memory.title',
    bodyKey: 'inspiration.myths.memory.body',
  },
  {
    id: 'recurrence',
    icon: 'figure.walk',
    titleKey: 'inspiration.myths.recurrence.title',
    bodyKey: 'inspiration.myths.recurrence.body',
  },
];

export default function InspirationScreen() {
  const { colors, shadows, mode } = useTheme();
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIP_KEYS.length));
  const [selectedRitualId, setSelectedRitualId] = useState<RitualId>('starter');

  const isDesktopLayout = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const tips = useMemo(() => TIP_KEYS.map((key) => t(key)), [t]);
  const prompts = useMemo(
    () => PROMPT_CARDS.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: t(card.titleKey),
      body: t(card.bodyKey),
    })),
    [t]
  );
  const exercises = useMemo(
    () => EXERCISE_CARDS.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: t(card.titleKey),
      body: t(card.bodyKey),
    })),
    [t]
  );
  const myths = useMemo(
    () => MYTH_CARDS.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: t(card.titleKey),
      body: t(card.bodyKey),
    })),
    [t]
  );

  const activeRitual = useMemo(() => {
    const found = RITUALS.find((ritual) => ritual.id === selectedRitualId);
    return found ?? RITUALS[0];
  }, [selectedRitualId]);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        const stored = await getRitualPreference();
        if (!isMounted || !stored) return;
        const match = RITUALS.find((ritual) => ritual.id === stored);
        if (match) {
          setSelectedRitualId(match.id);
        }
      } catch (error) {
        if (__DEV__) {
          console.error('[InspirationScreen] Failed to load ritual preference', error);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleRitualChange = async (id: RitualId) => {
    setSelectedRitualId(id);
    try {
      await saveRitualPreference(id);
    } catch (error) {
      if (__DEV__) {
        console.error('[InspirationScreen] Failed to save ritual preference', error);
      }
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.backgroundDark }}
      contentContainerStyle={{ paddingBottom: 64 }}
    >
      <ScreenContainer style={styles.contentContainer}>
        <View style={isDesktopLayout ? styles.desktopGrid : undefined}>
          <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopHeroSection]}>
            <RitualCard
              colors={colors}
              shadows={shadows}
              mode={mode}
              rituals={RITUALS}
              activeRitual={activeRitual}
              selectedRitualId={selectedRitualId}
              onChangeRitual={handleRitualChange}
            />
          </View>

          <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopSideSection]}>
            <TipCard
              colors={colors}
              shadows={shadows}
              tip={tips[tipIndex]}
              onNext={() => setTipIndex((prev) => (prev + 1) % tips.length)}
              title={t('inspiration.tip.title')}
              subtitle={t('inspiration.tip.subtitle')}
              nextLabel={t('inspiration.tip.next')}
            />
          </View>

          <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopHalfSection]}>
            <SectionHeading
              title={t('inspiration.prompts.title')}
              subtitle={t('inspiration.prompts.subtitle')}
              colors={colors}
            />
            <View style={styles.stack16}>
              {prompts.map((prompt) => (
                <InfoCard key={prompt.id} colors={colors} icon={prompt.icon} title={prompt.title} body={prompt.body} />
              ))}
            </View>
          </View>

          <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopHalfSection]}>
            <SectionHeading
              title={t('inspiration.exercises.title')}
              subtitle={t('inspiration.exercises.subtitle')}
              colors={colors}
            />
            <View style={styles.stack16}>
              {exercises.map((exercise) => (
                <InfoCard
                  key={exercise.id}
                  colors={colors}
                  icon={exercise.icon}
                  title={exercise.title}
                  body={exercise.body}
                />
              ))}
            </View>
          </View>

          <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopHalfSection]}>
            <SectionHeading
              title={t('inspiration.myths.title')}
              subtitle={t('inspiration.myths.subtitle')}
              colors={colors}
            />
            <View style={styles.stack16}>
              {myths.map((myth) => (
                <InfoCard key={myth.id} colors={colors} icon={myth.icon} title={myth.title} body={myth.body} />
              ))}
            </View>
          </View>

          <View style={[styles.sectionSpacing, isDesktopLayout && styles.desktopHalfSection]}>
            <QuoteCard colors={colors} />
          </View>
        </View>
      </ScreenContainer>
    </ScrollView>
  );
}

type SectionHeadingProps = {
  title: string;
  subtitle?: string;
  colors: ReturnType<typeof useTheme>['colors'];
};

function SectionHeading({ title, subtitle, colors }: SectionHeadingProps) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

type RitualCardProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  mode: ThemeMode;
  rituals: RitualConfig[];
  activeRitual: RitualConfig;
  selectedRitualId: RitualId;
  onChangeRitual: (id: RitualId) => void;
};

function RitualCard({ colors, shadows, mode, rituals, activeRitual, selectedRitualId, onChangeRitual }: RitualCardProps) {
  const { t } = useTranslation();
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setCompletedSteps({});
  }, [selectedRitualId]);

  const toggleStep = (id: string) => {
    setCompletedSteps((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const checkboxBorderColor = mode === 'dark' ? colors.divider : colors.textSecondary;

  return (
    <View style={[styles.heroCard, { backgroundColor: colors.backgroundCard }, shadows.lg]}>
      <Text style={[styles.overline, { color: colors.textSecondary }]}>{t('inspiration.title')}</Text>
      <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>{t('inspiration.ritual.title')}</Text>
      <Text style={[styles.heroSubtitle, { color: colors.textSecondary }]}>{t('inspiration.ritual.subtitle')}</Text>

      <View style={styles.ritualSelectorRow}>
        {rituals.map((ritual) => {
          const isActive = ritual.id === selectedRitualId;
          return (
            <Pressable
              key={ritual.id}
              onPress={() => onChangeRitual(ritual.id)}
              style={({ pressed }) => [
                styles.ritualChip,
                {
                  backgroundColor: isActive ? colors.accent : 'transparent',
                  borderColor: isActive ? colors.accent : colors.divider,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  styles.ritualChipLabel,
                  { color: isActive ? colors.textOnAccentSurface : colors.textSecondary },
                ]}
              >
                {t(ritual.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.ritualDescription, { color: colors.textSecondary }]}>
        {t(activeRitual.descriptionKey)}
      </Text>

      <View style={styles.ritualSteps}>
        {activeRitual.steps.map((step) => {
          const done = completedSteps[step.id];
          return (
            <Pressable
              key={step.id}
              onPress={() => toggleStep(step.id)}
              style={({ pressed }) => [
                styles.ritualStep,
                { opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View
                style={[
                  styles.ritualCheckbox,
                  {
                    borderColor: done ? colors.accent : checkboxBorderColor,
                    backgroundColor: done ? colors.accent : 'transparent',
                  },
                ]}
              >
                {done ? (
                  <View
                    style={[
                      styles.ritualCheckboxInner,
                      { backgroundColor: colors.textOnAccentSurface },
                    ]}
                  />
                ) : null}
              </View>
              <View style={styles.ritualContent}>
                <Text style={[styles.ritualTitle, { color: colors.textPrimary }]}>
                  {t(step.titleKey)}
                </Text>
                <Text style={[styles.ritualBody, { color: colors.textSecondary }]}>
                  {t(step.bodyKey)}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.ritualActions}>
        <Pressable
          onPress={() => router.push('/recording')}
          style={({ pressed }) => [
            styles.ritualCta,
            {
              backgroundColor: colors.accent,
              opacity: pressed ? 0.85 : 1,
            },
            shadows.md,
          ]}
          testID={TID.Button.InspirationRitualCta}
          accessibilityRole="button"
          accessibilityLabel={t('inspiration.ritual.cta')}
        >
          <Text style={[styles.ritualCtaText, { color: colors.textOnAccentSurface }]}>
            {t('inspiration.ritual.cta')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type TipCardProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  shadows: ReturnType<typeof useTheme>['shadows'];
  title: string;
  subtitle: string;
  tip: string;
  nextLabel: string;
  onNext: () => void;
};

function TipCard({ colors, shadows, title, subtitle, tip, nextLabel, onNext }: TipCardProps) {
  return (
    <View style={[styles.tipCard, { backgroundColor: colors.backgroundCard }, shadows.md]} testID={TID.Component.InspirationTip}>
      <View style={styles.tipHeader}>
        <View>
          <Text style={[styles.tipTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[styles.tipSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        </View>
        <IconSymbol name="sparkles" size={24} color={colors.accent} />
      </View>
      <Text style={[styles.tipBody, { color: colors.textPrimary }]}>{tip}</Text>
      <Pressable
        onPress={onNext}
        style={({ pressed }) => [styles.tipButton, { opacity: pressed ? 0.6 : 1 }]}
        testID={TID.Button.InspirationTipNext}
      >
        <IconSymbol name="arrow.triangle.2.circlepath" size={18} color={colors.accent} />
        <Text style={[styles.tipButtonLabel, { color: colors.accent }]}>{nextLabel}</Text>
      </Pressable>
    </View>
  );
}

// QuickAccess section intentionally removed to keep the home
// focused on guidance, rituals and inspiration rather than navigation.

type InfoCardProps = {
  colors: ReturnType<typeof useTheme>['colors'];
  icon: IconName;
  title: string;
  body: string;
};

function InfoCard({ colors, icon, title, body }: InfoCardProps) {
  return (
    <View style={[styles.infoCard, { backgroundColor: colors.backgroundCard, borderColor: colors.divider }]}>
      <View style={[styles.infoIconWrapper, { backgroundColor: colors.backgroundSecondary }]}>
        <IconSymbol name={icon} size={20} color={colors.textOnAccentSurface} />
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.infoBody, { color: colors.textSecondary }]}>{body}</Text>
      </View>
    </View>
  );
}

function QuoteCard({ colors }: { colors: ReturnType<typeof useTheme>['colors'] }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.quoteCard, { backgroundColor: colors.backgroundCard, borderColor: colors.divider }]}>
      <IconSymbol name="quote.opening" size={28} color={colors.accent} />
      <Text style={[styles.quoteText, { color: colors.textPrimary }]}>{t('inspiration.quote.text')}</Text>
      <Text style={[styles.quoteAuthor, { color: colors.textSecondary }]}>{t('inspiration.quote.author')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  desktopGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -12,
  },
  desktopHeroSection: {
    width: '66.6667%',
    minWidth: 360,
    paddingHorizontal: 12,
  },
  desktopSideSection: {
    width: '33.3333%',
    minWidth: 320,
    paddingHorizontal: 12,
  },
  desktopHalfSection: {
    width: '50%',
    minWidth: 320,
    paddingHorizontal: 12,
  },
  sectionSpacing: {
    marginBottom: 32,
  },
  sectionHeading: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 20,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    marginTop: 4,
  },
  stack16: {
    gap: 16,
  },
  heroCard: {
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
  },
  overline: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  heroTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 12,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
  },
  heroButtonText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  tipCard: {
    borderRadius: 20,
    padding: 20,
  },
  tipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tipTitle: {
    fontFamily: Fonts.spaceGrotesk.bold,
    fontSize: 18,
    marginBottom: 4,
  },
  tipSubtitle: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
  },
  tipBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
  },
  tipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tipButtonLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
  },
  ritualSteps: {
    marginTop: 8,
    gap: 12,
  },
  ritualActions: {
    marginTop: 16,
  },
  ritualStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  ritualCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  ritualCheckboxInner: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  ritualContent: {
    flex: 1,
    gap: 4,
  },
  ritualTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  ritualBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  ritualSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 4,
  },
  ritualChip: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  ritualChipLabel: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 13,
  },
  ritualDescription: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 13,
    marginBottom: 8,
  },
  ritualCta: {
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  ritualCtaText: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 15,
  },
  infoCard: {
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 16,
  },
  infoIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    gap: 6,
  },
  infoTitle: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 16,
  },
  infoBody: {
    fontFamily: Fonts.spaceGrotesk.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  quoteCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  quoteText: {
    fontFamily: Fonts.lora.regularItalic,
    fontSize: 18,
    lineHeight: 26,
  },
  quoteAuthor: {
    fontFamily: Fonts.spaceGrotesk.medium,
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
