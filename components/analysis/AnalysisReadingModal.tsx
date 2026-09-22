import { MarkdownText } from '@/components/ui/MarkdownText';
import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useTranslation } from '@/hooks/useTranslation';
import { isPoeticDreamQuote } from '@/lib/dreamQuote';
import type { DreamAnalysis } from '@/lib/types';

export type AnalysisReadingModalProps = {
  dream: Pick<DreamAnalysis, 'title' | 'shareableQuote' | 'interpretation'> & Partial<Pick<DreamAnalysis,
    'promptVersion' | 'symbols' | 'emotions' | 'reflectionQuestions' | 'imageUrl' | 'imageJobStatus' | 'imageGenerationFailed'>>;
  /** Resolved through the journal media boundary (including private storage signing). */
  imageUri?: string;
  imageCacheKey?: string;
  imageLoadFailed?: boolean;
  onReloadImage?: () => void;
  onRetryImage?: () => void;
  isRetryingImage?: boolean;
  onClose: () => void;
};

function ReadingIllustration({ dream, imageUri, imageCacheKey, imageLoadFailed, onReloadImage, onRetryImage, isRetryingImage }: Omit<AnalysisReadingModalProps, 'onClose'>) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const [loaded, setLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const unavailable = loadFailed || imageLoadFailed;
  const hasImage = Boolean(dream.imageUrl?.trim());
  const pending = isRetryingImage || dream.imageJobStatus === 'queued' || dream.imageJobStatus === 'running';
  const failed = !pending && (unavailable || (!hasImage && dream.imageGenerationFailed));
  const loading = !failed && (pending || (hasImage && !loaded));
  const label = unavailable ? t('analysis.reading.image_unavailable')
    : failed ? t('journal.detail.image.generation_failed')
      : pending ? t(dream.imageJobStatus === 'running' ? 'analysis.reading.image_generating' : 'analysis.reading.image_queued')
        : hasImage ? t('analysis.reading.image_loading') : t('journal.detail.image.no_image_title');

  return (
    <View style={[styles.illustration, hasImage || pending ? styles.imageFrame : styles.emptyFrame, { backgroundColor: tokens.surface.soft }]} testID="analysis.reading.illustration">
      {hasImage && imageUri && !loadFailed ? (
        <Image source={{ uri: imageUri, cacheKey: imageCacheKey }} cachePolicy="memory-disk" contentFit="cover" style={StyleSheet.absoluteFill}
          accessibilityLabel={t('analysis.reading.image_alt', { title: dream.title })}
          onLoad={() => setLoaded(true)} onError={() => setLoadFailed(true)} testID="analysis.reading.image" />
      ) : null}
      {!loaded || pending || failed ? (
        <View style={[styles.imageStatus, { backgroundColor: tokens.surface.soft }]} accessibilityLiveRegion="polite">
          {loading ? <ActivityIndicator color={tokens.accent.text} /> : <IconSymbol name="photo" size={28} color={tokens.text.secondary} />}
          <Text style={[styles.imageLabel, { color: tokens.text.secondary }]}>{label}</Text>
          {failed && (unavailable ? onReloadImage : onRetryImage) ? (
            <PressableScale onPress={unavailable ? () => { setLoadFailed(false); onReloadImage?.(); } : onRetryImage} accessibilityRole="button" style={styles.retry} testID="analysis.reading.image_retry">
              <Text style={[styles.imageLabel, { color: tokens.accent.text }]}>{t(unavailable ? 'journal.persistence.retry' : 'image_retry.retry_generation')}</Text>
            </PressableScale>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The same saved analysis remains readable while its illustration finishes. */
export function AnalysisReadingModal({ dream, imageUri, imageCacheKey, imageLoadFailed, onReloadImage, onRetryImage, isRetryingImage, onClose }: AnalysisReadingModalProps) {
  const { colors, mode } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const tokens = getNoctaliaDesignTokens(colors, mode);
  const quote = dream.shareableQuote?.trim();
  const backgroundColor = tokens.surface.raised;
  const bodyStyle = useMemo(() => [styles.body, { color: tokens.text.primary }], [tokens.text.primary]);
  const insights = [
    { key: 'symbols', heading: t('journal.detail.symbols_header'), items: dream.symbols?.map(item => ({ name: item.name, text: item.meaning })) },
    { key: 'emotions', heading: t('journal.detail.emotions_header'), items: dream.emotions?.map(item => ({ name: item.name, text: item.insight })) },
  ];

  return (
    <Modal visible animationType="none" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor }]} accessibilityViewIsModal testID="analysis.reading.modal">
        {mode === 'dark' ? <LinearGradient colors={[tokens.screen.gradient[1], backgroundColor]} style={styles.glow} pointerEvents="none" /> : null}
        <View style={[styles.toolbar, { paddingTop: insets.top + 8, paddingRight: Math.max(insets.right, 24) }]}>
          <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel={t('analysis.reading.close')}
            testID="analysis.reading.close" style={[styles.close, { backgroundColor: tokens.surface.soft }]}>
            <IconSymbol name="xmark" size={23} color={tokens.text.primary} />
          </PressableScale>
        </View>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40, paddingLeft: Math.max(insets.left, 24), paddingRight: Math.max(insets.right, 24) }]}>
          <Text accessibilityRole="header" style={[styles.title, { color: tokens.text.primary }]}>{dream.title}</Text>
          <ReadingIllustration key={`${dream.imageUrl ?? ''}:${imageUri ?? ''}`} dream={dream} imageUri={imageUri} imageCacheKey={imageCacheKey} imageLoadFailed={imageLoadFailed} onReloadImage={onReloadImage}
            onRetryImage={onRetryImage} isRetryingImage={isRetryingImage} />
          <View testID="analysis.reading.body">
            <MarkdownText variant="reading" style={bodyStyle}>{dream.interpretation?.trim() ?? ''}</MarkdownText>
          </View>
          {insights.map(section => section.items?.length ? (
            <View key={section.key} style={styles.section} testID={`analysis.reading.${section.key}`}>
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.text.primary }]}>{section.heading}</Text>
              {section.items.map((item, index) => (
                <View key={`${item.name}-${index}`} style={styles.insight}>
                  <Text style={[styles.insightTitle, { color: tokens.text.primary }]}>{item.name}</Text>
                  <MarkdownText variant="reading" style={bodyStyle}>{item.text}</MarkdownText>
                </View>
              ))}
            </View>
          ) : null)}
          {dream.reflectionQuestions?.length ? (
            <View style={styles.section} testID="analysis.reading.questions">
              <Text accessibilityRole="header" style={[styles.sectionTitle, { color: tokens.text.primary }]}>{t('journal.detail.reflection_header')}</Text>
              {dream.reflectionQuestions.map((question, index) => (
                <Text key={`${index}-${question}`} style={[styles.question, { color: tokens.text.primary }]}>{`${index + 1}. ${question}`}</Text>
              ))}
            </View>
          ) : null}
          {quote ? (
            <View style={[styles.quoteBlock, { borderTopColor: tokens.accent.base }]}>
              <Text style={[styles.quote, { color: tokens.text.secondary }]}>{`« ${quote} »`}</Text>
              {isPoeticDreamQuote(dream) ? <Text style={[styles.attribution, { color: tokens.text.secondary }]}>{t('journal.detail.quote_attribution')}</Text> : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  toolbar: { alignItems: 'flex-end', paddingBottom: 12 },
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  content: { paddingTop: 10, width: '100%', maxWidth: 620, alignSelf: 'center' },
  title: { fontFamily: Fonts.lora.regular, fontSize: 26, lineHeight: 35, marginBottom: 20 },
  illustration: { width: '100%', borderRadius: 20, overflow: 'hidden', marginBottom: 28 },
  imageFrame: { minHeight: 190, aspectRatio: 4 / 3 },
  emptyFrame: { minHeight: 140 },
  imageStatus: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
  imageLabel: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retry: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 12 },
  body: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 17, lineHeight: 28 },
  section: { marginTop: 30 },
  sectionTitle: { fontFamily: Fonts.lora.regular, fontSize: 23, lineHeight: 31, marginBottom: 16 },
  insight: { marginBottom: 16 },
  insightTitle: { fontFamily: Fonts.spaceGrotesk.bold, fontSize: 17, lineHeight: 25, marginBottom: 6 },
  question: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 17, lineHeight: 28, marginBottom: 14 },
  quoteBlock: { marginTop: 32, paddingTop: 24, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  quote: { fontFamily: Fonts.lora.regularItalic, fontSize: 19, lineHeight: 29 },
  attribution: { fontFamily: Fonts.spaceGrotesk.regular, fontSize: 12, lineHeight: 18 },
});
