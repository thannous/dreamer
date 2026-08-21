import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { Screen } from '@/components/atmosphere/Screen';
import { SessionArtwork } from '@/components/session/SessionArtwork';
import { Rule, Text } from '@/components/ui';
import { BREATHING_PATTERNS, type BreathingPattern } from '@/content/breathing';
import { useTranslation } from '@/context/LanguageContext';
import { TID } from '@/lib/testIDs';
import { useSubscription } from '@/context/SubscriptionContext';
import { usePressMotion } from '@/hooks/usePressMotion';
import { cycleDurationMs } from '@/lib/breathing';
import type { TranslationKey } from '@/lib/i18n';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function PatternCard({ pattern }: { pattern: BreathingPattern }) {
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
      style={style}>
      <SessionArtwork accent={pattern.accent} rounded="xl" className="min-h-32 justify-end">
        <View className="gap-1 p-gutter">
          <Text variant="overline">
            {rhythm}
            {gate.allowed ? '' : ` · ${t('common.plus')}`}
          </Text>
          <Text variant="h2">{t(`breathe.pattern.${pattern.id}.name` as TranslationKey)}</Text>
          <Text variant="bodySm">
            {t(`breathe.pattern.${pattern.id}.hint` as TranslationKey)} · {cycleSec}s
          </Text>
        </View>
      </SessionArtwork>
    </AnimatedPressable>
  );
}

export default function BreatheTab() {
  const { t } = useTranslation();

  return (
    <Screen variant="subtle" edges={['top']} video="breathe" videoOpacity={0.35}>
      <ScrollView
        testID={TID.Screen.Breathe}
        contentContainerClassName="px-gutter pb-24 pt-4 gap-6"
        showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text variant="h1">{t('breathe.title')}</Text>
          <Rule className="self-start" />
          <Text variant="bodySm">{t('breathe.subtitle')}</Text>
        </View>

        <View className="gap-4">
          {BREATHING_PATTERNS.map((pattern) => (
            <PatternCard key={pattern.id} pattern={pattern} />
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
