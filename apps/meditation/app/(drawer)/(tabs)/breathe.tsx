import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { ArtworkGlassPanel, Rule, Text } from '@/components/ui';
import { WorldScene } from '@/components/worlds/WorldScene';
import { BREATHING_PATTERNS, type BreathingPattern } from '@/content/breathing';
import { useTranslation } from '@/context/LanguageContext';
import { useTabBarInset } from '@/hooks/useTabBarInset';
import { TID } from '@/lib/testIDs';
import { useSubscription } from '@/context/SubscriptionContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { cycleDurationMs } from '@/lib/breathing';
import type { TranslationKey } from '@/lib/i18n';
import { useCompactLayout } from '@/hooks/useCompactLayout';
import { useWorld } from '@/context/WorldContext';
import type { ThemeMode } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PatternCard({
  pattern,
  compact,
  signatureLabel,
  appearance,
}: {
  pattern: BreathingPattern;
  compact: boolean;
  signatureLabel?: string;
  appearance: ThemeMode;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { gateForPattern, openPaywall } = useSubscription();
  const { style, handlePressIn, handlePressOut } = usePressMotion({ surface: 'card' });
  const gate = gateForPattern(pattern.id);

  // The rhythm, written out: "4 · 7 · 8" says more than any description.
  const rhythm = pattern.phases.map((phase) => phase.seconds).join(' · ');
  const cycleSec = Math.round(cycleDurationMs(pattern) / 1000);

  return (
    <AnimatedPressable
      testID={pattern.id === 'calm' ? TID.Option.BreatheCalm : undefined}
      accessibilityRole="button"
      onPress={() => {
        if (!gate.allowed) {
          openPaywall(gate.reason);
          return;
        }
        router.push(`/breathe/${pattern.id}`);
      }}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={style}
      className="rounded-xl">
      <ArtworkGlassPanel
        appearance={appearance}
        contentStyle={compact ? styles.compactPatternContent : styles.patternContent}
        testID={`breathe.option-glass.${pattern.id}`}>
        <Text variant="overline">
          {signatureLabel ? `${signatureLabel} · ` : ''}
          {rhythm}
          {gate.allowed ? '' : ` · ${t('common.plus')}`}
        </Text>
        <Text variant="h2">{t(`breathe.pattern.${pattern.id}.name` as TranslationKey)}</Text>
        <Text variant="bodySm">
          {t(`breathe.pattern.${pattern.id}.hint` as TranslationKey)} · {cycleSec}s
        </Text>
      </ArtworkGlassPanel>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  compactPatternContent: {
    minHeight: 112,
    justifyContent: 'center',
    gap: 4,
    padding: 16,
  },
  patternContent: {
    minHeight: 128,
    justifyContent: 'center',
    gap: 4,
    padding: 20,
  },
});

export default function BreatheTab() {
  const tabBarInset = useTabBarInset();
  const { t } = useTranslation();
  const compact = useCompactLayout();
  const { world } = useWorld();
  const role = t(`world.${world.id}.role` as TranslationKey);
  const signaturePatternId = world.personality.breathingPatternId;
  const patterns = [
    ...BREATHING_PATTERNS.filter((pattern) => pattern.id === signaturePatternId),
    ...BREATHING_PATTERNS.filter((pattern) => pattern.id !== signaturePatternId),
  ];
  return (
    <WorldScene
      world={world}
      artwork="trainer"
      edges={['top']}
      scrimStrength={1.08}>
      <ScrollView
        testID={TID.Screen.Breathe}
        contentContainerClassName={compact ? 'gap-4 px-4 pt-3' : 'gap-6 px-gutter pt-4'}
        contentContainerStyle={{ paddingBottom: tabBarInset }}
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant={compact ? 'h2' : 'h1'}>{t('breathe.title')}</Text>
          <Rule className="self-start" />
          <Text variant="overline">{role}</Text>
          <Text variant="bodySm">
            {t(`world.${world.id}.ritual` as TranslationKey)}
          </Text>
        </View>

        <View className={compact ? 'gap-3' : 'gap-4'} testID="breathe.pattern-list">
          {patterns.map((pattern) => (
            <PatternCard
              key={pattern.id}
              pattern={pattern}
              compact={compact}
              appearance={world.appearance}
              signatureLabel={
                pattern.id === signaturePatternId
                  ? t(world.nameKey)
                  : undefined
              }
            />
          ))}
        </View>
      </ScrollView>
    </WorldScene>
  );
}
