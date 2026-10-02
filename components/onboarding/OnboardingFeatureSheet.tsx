import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { CaptureStory } from './CaptureStory';
import { DialogueStory } from './DialogueStory';
import { FeatureStoryControls, STORY_DEMO_STEP, useFeatureStory } from './FeatureStory';
import { SymbolConstellation } from './SymbolConstellation';

export type OnboardingFeature = 'capture' | 'connect' | 'explore';

const CAPTIONS = {
  capture: ['onboarding.intro.signal.capture.body', 'onboarding.feature.capture.benefit_2.title', 'onboarding.feature.capture.benefit_3.title'],
  connect: ['onboarding.feature.connect.benefit_1.title', 'onboarding.feature.connect.benefit_2.title', 'onboarding.feature.connect.benefit_3.title'],
  explore: ['onboarding.feature.explore.benefit_1.title', 'onboarding.feature.explore.benefit_2.title', 'onboarding.feature.explore.benefit_3.title'],
} as const;

export function OnboardingFeatureSheet({ feature, onClose }: { feature: OnboardingFeature; onClose: () => void }) {
  const { t } = useTranslation();
  const { colors, mode } = useTheme();
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const tokens = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const story = useFeatureStory();
  const sheetHeight = Math.max(160, Math.min(height * 0.8, height - insets.top - insets.bottom - 96) - 48);
  const demo = story.step === STORY_DEMO_STEP;

  return (
    <StandardBottomSheet
      visible
      onClose={onClose}
      title={t(`onboarding.feature.${feature}.title`)}
      testID="sheet.onboarding.feature"
      // Leave room for the platform host's handle and padding (web caps at 85vh).
      style={{ height: sheetHeight, ...(Platform.OS === 'web' ? { width } : {}) }}
      surfaceColor={colors.backgroundCard}
      transparentContent
      closeButton={{ label: t('journal.detail.share_modal.close'), testID: 'btn.onboarding.feature.close' }}
    >
      <FeatureStoryControls story={story} tokens={tokens} />
      <Text style={[styles.caption, { color: tokens.text.primary }]}>
        {t(CAPTIONS[feature][Math.min(story.step, 2)])}
      </Text>
      <View testID={`component.onboarding.preview.${feature}`}>
        <View testID={`component.onboarding.story.${feature}.${story.step}`} onTouchStart={story.stop} onFocus={story.stop}>
          {feature === 'capture' ? <>
            <View style={styles.captureMethod}>
              <IconSymbol name="mic" size={16} color={tokens.accent.text} />
              <IconSymbol name="pencil" size={16} color={tokens.accent.text} />
              <Text style={[styles.captureLabel, { color: tokens.text.secondary }]}>{t('onboarding.feature.capture.benefit_1.title')}</Text>
            </View>
            <CaptureStory step={story.step} reduced={story.reduced} tokens={tokens} stageHeight={Math.max(210, Math.min(380, sheetHeight - 248))} />
          </> : feature === 'connect' ? <SymbolConstellation tokens={tokens} storyStep={demo ? undefined : story.step} onInteraction={story.stop} /> :
            <DialogueStory step={story.step} tokens={tokens} onInteraction={story.stop} />}
        </View>
      </View>
      {!demo ? <Text style={[styles.example, { color: tokens.text.tertiary }]}>{t('onboarding.feature.example')}</Text> : null}
      {feature !== 'capture' ? <Text style={[styles.note, { color: tokens.text.tertiary }]}>{t('onboarding.feature.reflection_note')}</Text> : null}
    </StandardBottomSheet>
  );
}

const styles = StyleSheet.create({
  caption: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 15, lineHeight: 22, textAlign: 'center', paddingTop: 2, paddingBottom: 12 },
  captureMethod: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingTop: 4, paddingBottom: 12 },
  captureLabel: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 18 },
  example: { fontFamily: Fonts.spaceGrotesk.medium, fontSize: 11, lineHeight: 16, textAlign: 'center', paddingVertical: 12 },
  note: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 11, lineHeight: 17, textAlign: 'center', paddingBottom: 14 },
});
