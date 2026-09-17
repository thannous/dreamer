import { MarkdownText } from '@/components/ui/MarkdownText';
import React, { useEffect, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale, Reveal } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { DarkTheme, MorningTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useTranslation } from '@/hooks/useTranslation';
import type { DreamAnalysis } from '@/lib/types';

type Props = {
  dream: Pick<DreamAnalysis, 'title' | 'shareableQuote' | 'interpretation'>;
  onClose: () => void;
};

/** Mount only for a newly completed analysis. Revisiting a dream is ordinary reading. */
export function AnalysisReadingModal({ dream, onClose }: Props) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = usePrefersReducedMotion();
  const [presented, setPresented] = useState(false);
  const [readingVisible, setReadingVisible] = useState(false);
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const quote = dream.shareableQuote?.trim();
  const backgroundColor = mode === 'dark' ? DarkTheme.backgroundCard : MorningTheme.backgroundCard;

  // Start the pause when the native modal is actually on screen, not while it opens.
  useEffect(() => {
    if (!presented || reducedMotion || !quote) return;
    const timer = setTimeout(() => setReadingVisible(true), 500);
    return () => clearTimeout(timer);
  }, [presented, quote, reducedMotion]);

  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" onShow={() => setPresented(true)} onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor }]} accessibilityViewIsModal testID="analysis.reading.modal">
        {mode === 'dark' ? (
          <LinearGradient colors={[tokens.screen.gradient[1], backgroundColor]} style={styles.glow} pointerEvents="none" />
        ) : null}
        <View style={[styles.toolbar, { paddingTop: insets.top + 8, paddingRight: Math.max(insets.right, 28) }]}>
          <PressableScale
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('analysis.reading.close')}
            testID="analysis.reading.close"
            style={[styles.close, { backgroundColor: tokens.surface.soft }]}
          >
            <IconSymbol name="xmark" size={23} color={tokens.text.primary} />
          </PressableScale>
        </View>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, paddingLeft: Math.max(insets.left, 28), paddingRight: Math.max(insets.right, 28) }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.eyebrow, { color: tokens.text.primary }]}>{t('analysis.reading.eyebrow')}</Text>
          {quote ? (
            <View style={styles.quoteBlock}>
              <Text style={[styles.quote, { color: tokens.text.primary }]}>{`« ${quote} »`}</Text>
              <View style={[styles.rule, { backgroundColor: tokens.accent.base }]} />
            </View>
          ) : null}
          {presented && (readingVisible || reducedMotion || !quote) ? (
            <Reveal distance={0} testID="analysis.reading.body">
              <Text accessibilityRole="header" style={[styles.title, { color: tokens.text.primary }]}>{dream.title}</Text>
              <MarkdownText variant="reading" style={[styles.body, { color: tokens.text.primary }]}>{dream.interpretation?.trim() ?? ''}</MarkdownText>
            </Reveal>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  toolbar: { alignItems: 'flex-end', paddingBottom: 20 },
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 10, width: '100%', maxWidth: 620, alignSelf: 'center' },
  eyebrow: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 14, lineHeight: 22, textAlign: 'center', marginBottom: 28 },
  quoteBlock: { marginBottom: 44 },
  quote: { fontFamily: Fonts.lora.regularItalic, fontSize: 30, lineHeight: 42, textAlign: 'center' },
  rule: { height: 1, width: 56, alignSelf: 'center', marginTop: 30 },
  title: { fontFamily: Fonts.lora.regular, fontSize: 26, lineHeight: 35, marginBottom: 18 },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 17, lineHeight: 28 },
});
