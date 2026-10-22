import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { IconSymbol } from '@/components/ui/icon-symbol';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useTranslation } from '@/hooks/useTranslation';
import { requestAiConsent } from '@/lib/aiConsent';
import { formatQuotaResetDate, withFirstDayOrdinal } from '@/lib/quotaReset';
import { TID } from '@/lib/testIDs';
import {
  analysisPreviewRefusal,
  fetchAnalysisPreview,
  type AnalysisPreview,
  type AnalysisPreviewResult,
} from '@/services/analysisPreviewService';
import { BookSectionMark, BookSubheading, useBookBody } from './JournalBook';

/** The band is the middle third of a 9:16 painting. */
const BAND_ASPECT = 27 / 16;
/** A painting or a writing under way is read again this often, a little over its three minutes at most. */
const POLL_MS = 4000;
const MAX_POLLS = 50;
/** Lines standing for the reading's hidden rest: shapes, never its words. */
const HIDDEN_LINES = [0.96, 0.9, 0.58];

type State =
  | { kind: 'loading' }
  /** Nothing to show: the dream page's own action stands. */
  | { kind: 'hidden' }
  | { kind: 'preparing' }
  | { kind: 'failed' }
  /** The result of one dream, language and text: another subject reads as loading. */
  | { kind: 'loaded'; result: AnalysisPreviewResult; subject: string };

/**
 * A free account past its monthly analyses: once a week, the analysis of a dream is
 * prepared anyway. It reads the reading's title, first sentence and symbols' names and
 * sees a band of its painting; the rest opens with Plus or with next month's analysis.
 */
export function AnalysisPreviewCard({ remoteDreamId, transcript, onOpenPlus, onOfferChange, onReadingChange, className = '' }: {
  remoteDreamId: number;
  /** The dream's text: an edited dream is read again. */
  transcript: string;
  /** Plus, for a prepared analysis to read or for a dream to analyze. */
  onOpenPlus: (prepared: boolean) => void;
  /** True while the card holds the dream's next step, so the page shows no second offer. */
  onOfferChange?: (holdsOffer: boolean) => void;
  /** True while the card shows model-written text or its band, which can then be reported. */
  onReadingChange?: (shown: boolean) => void;
  className?: string;
}) {
  const { t, currentLang } = useTranslation();
  const { colors, mode } = useTheme();
  const noctalia = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { locale, formatDate } = useLocaleFormatting();
  const body = useBookBody();
  const [state, setState] = useState<State>({ kind: 'loading' });
  // The dream, language and text a preparation was asked for: once they change, the next read only reads.
  const subject = `${remoteDreamId}|${currentLang}|${transcript}`;
  const [request, setRequest] = useState({ count: 0, prepare: false, polls: 0, subject: '' });
  // Each tap sends its preparation once, even when the language goes and comes back.
  const sentPreparation = useRef(-1);

  useEffect(() => {
    const prepareNow = request.prepare && request.subject === subject && sentPreparation.current !== request.count;
    if (prepareNow) sentPreparation.current = request.count;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const readAgain = (writing: boolean) => {
      // A writing that never ends can be asked again; a painting that never ends leaves the reading.
      if (request.polls >= MAX_POLLS) {
        if (writing) setState({ kind: 'failed' });
        return;
      }
      timer = setTimeout(() => setRequest((value) => ({ ...value, count: value.count + 1, prepare: false, polls: value.polls + 1 })), POLL_MS);
    };
    void (async () => {
      try {
        const result = await fetchAnalysisPreview({
          remoteDreamId, lang: currentLang, prepare: prepareNow, signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setState({ kind: 'loaded', result, subject });
        if (result.state === 'writing' || result.preview?.image.state === 'painting') readAgain(result.state === 'writing');
      } catch (error) {
        if (controller.signal.aborted) return;
        const refusal = analysisPreviewRefusal(error);
        // A failed read while waiting keeps what shows and reads again.
        if (request.polls > 0 && !prepareNow && !refusal) {
          readAgain(false);
          return;
        }
        // A refused dream keeps the page's own action; a failed preparation can be tried again.
        setState(prepareNow && !refusal ? { kind: 'failed' } : { kind: 'hidden' });
      }
    })();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [currentLang, remoteDreamId, request, subject]);

  const prepare = useCallback(async () => {
    // The dream's text goes to the AI only with consent.
    if (!(await requestAiConsent(t))) return;
    setState({ kind: 'preparing' });
    setRequest((value) => ({ count: value.count + 1, prepare: true, polls: 0, subject }));
  }, [subject, t]);

  // Another dream, language or text shows nothing of the former one while it loads.
  const shown: State = state.kind === 'loaded' && state.subject !== subject ? { kind: 'loading' } : state;
  const result = shown.kind === 'loaded' ? shown.result : null;
  // A note on the week's limit leaves the page's own offer in place. While the card loads it
  // holds the step too, so the page's offer does not show and then vanish.
  const holdsOffer = shown.kind === 'loading' || shown.kind === 'preparing' || shown.kind === 'failed'
    || (result !== null && result.state !== 'weekly_limit');
  const showsReading = result?.state === 'ready' && result.preview !== null;
  useEffect(() => { onOfferChange?.(holdsOffer); }, [holdsOffer, onOfferChange]);
  useEffect(() => () => onOfferChange?.(false), [onOfferChange]);
  useEffect(() => { onReadingChange?.(showsReading); }, [showsReading, onReadingChange]);
  useEffect(() => () => onReadingChange?.(false), [onReadingChange]);
  const day = (iso: string) => withFirstDayOrdinal(formatDate(Date.parse(iso), { day: 'numeric', month: 'long' }), locale);
  let content: React.ReactNode = null;
  if (result?.state === 'ready' && result.preview) {
    content = <PreviewReading preview={result.preview} body={body} noctalia={noctalia} onOpenPlus={() => onOpenPlus(true)}
      freeDate={formatQuotaResetDate(locale)} />;
  } else if (shown.kind === 'preparing' || result?.state === 'writing') {
    content = (
      <View className="flex-row items-center gap-3 py-4" testID={TID.Text.AnalysisPreviewWaiting}>
        <ActivityIndicator color={noctalia.accent.text} />
        <Text className="flex-1 font-serif-italic text-body leading-[24px] text-ivory-muted">{t('journal.detail.preview.preparing')}</Text>
      </View>
    );
  } else if (shown.kind === 'failed' || result?.state === 'available') {
    const failed = shown.kind === 'failed';
    content = (
      <View className="gap-4 rounded-[20px] border border-line bg-ink-card p-5">
        <Text className="font-sans text-body leading-[24px] text-ivory">
          {t(failed ? 'journal.detail.preview.failed' : 'journal.detail.preview.invite')}
        </Text>
        <Pressable onPress={() => void prepare()} accessibilityRole="button"
          testID={failed ? TID.Button.AnalysisPreviewRetry : TID.Button.AnalysisPreviewPrepare}
          className="min-h-[48px] items-center justify-center rounded-full border border-champagne-soft px-5 active:opacity-80">
          <Text className="font-sans-bold text-body text-champagne-on">
            {t(failed ? 'journal.detail.preview.retry' : 'journal.detail.preview.invite_cta')}
          </Text>
        </Pressable>
        <Pressable onPress={() => onOpenPlus(false)} accessibilityRole="button" testID={TID.Button.AnalysisPreviewPlusNow}
          className="min-h-[44px] items-center justify-center active:opacity-80">
          <Text className="font-sans text-body-sm text-ivory-muted underline">{t('journal.detail.preview.plus_now')}</Text>
        </Pressable>
      </View>
    );
  } else if (result?.state === 'weekly_limit' && result.retryAt) {
    content = (
      <Text className="text-center font-serif-italic text-body-sm leading-[20px] text-ivory-muted">
        {t('journal.detail.preview.weekly_limit', { date: day(result.retryAt) })}
      </Text>
    );
  }
  if (!content) return null;

  return (
    <View testID={TID.Component.AnalysisPreview} className={`mx-2 mb-8 gap-5 ${className}`}>
      <BookSectionMark label={t('journal.detail.zone.reading')} />
      {content}
    </View>
  );
}

function PreviewReading({ preview, body, noctalia, onOpenPlus, freeDate }: {
  preview: AnalysisPreview;
  body: ReturnType<typeof useBookBody>;
  noctalia: ReturnType<typeof getNoctaliaDesignTokens>;
  onOpenPlus: () => void;
  freeDate: string;
}) {
  const { t } = useTranslation();
  const veil = noctalia.surface.base;
  // The band's edges fade into the veil, so it reads as the part of the painting that shows.
  const clear = /^#[0-9a-f]{6}$/i.test(veil) ? `${veil}00` : 'transparent';
  const { image } = preview;

  return (
    <>
      {image.state === 'ready' && image.bandUrl ? (
        <View testID={TID.Component.AnalysisPreviewBand} accessible accessibilityRole="image"
          accessibilityLabel={t('journal.detail.preview.band_label')}
          className="overflow-hidden rounded-[20px] bg-ink-card pt-7">
          <View style={{ aspectRatio: BAND_ASPECT }}>
            <Image source={{ uri: image.bandUrl }} contentFit="cover" transition={400} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={[veil, clear]} style={[styles.edge, { top: 0 }]} />
            <LinearGradient colors={[clear, veil]} style={[styles.edge, { bottom: 0 }]} />
          </View>
          <View className="flex-row items-center justify-center gap-1.5 py-3">
            <IconSymbol name="lock.fill" size={12} color={noctalia.text.tertiary} />
            <Text className="font-sans text-caption text-ivory-muted">{t('journal.detail.preview.band_caption')}</Text>
          </View>
        </View>
      ) : image.state === 'painting' ? (
        <View className="items-center justify-center gap-3 rounded-[20px] bg-ink-card" style={{ aspectRatio: BAND_ASPECT }}>
          <ActivityIndicator color={noctalia.accent.text} />
          <Text className="font-serif-italic text-body-sm text-ivory-muted">{t('journal.detail.preview.painting')}</Text>
        </View>
      ) : null}
      <Text accessibilityRole="header" className="text-center font-serif-italic text-[20px] leading-7 text-ivory">{preview.title}</Text>
      <Text testID={TID.Text.AnalysisPreviewOpening} style={body}>{preview.opening}</Text>
      <View accessible accessibilityLabel={t('journal.detail.preview.locked')} className="gap-3">
        <View className="gap-2.5" importantForAccessibility="no-hide-descendants">
          {HIDDEN_LINES.map((width) => (
            <View key={width} className="h-2.5 rounded-full bg-line" style={{ width: `${width * 100}%` }} />
          ))}
        </View>
        <View className="flex-row items-center gap-2">
          <IconSymbol name="lock.fill" size={14} color={noctalia.text.tertiary} />
          <Text className="flex-1 font-serif-italic text-body-sm leading-[20px] text-ivory-muted">{t('journal.detail.preview.locked')}</Text>
        </View>
      </View>
      {preview.symbols.length ? (
        <View className="mt-2 gap-3">
          <BookSubheading>{t('journal.detail.symbols_header')}</BookSubheading>
          <View className="flex-row flex-wrap justify-center gap-2">
            {preview.symbols.map((name, index) => (
              <View key={`${name}-${index}`} className="flex-row items-center gap-1.5 rounded-full border border-line px-3 py-1.5">
                <Text className="font-serif text-body-sm text-ivory">{name}</Text>
                <IconSymbol name="lock.fill" size={11} color={noctalia.text.tertiary} />
              </View>
            ))}
          </View>
          <Text className="text-center font-sans text-caption text-ivory-muted">{t('journal.detail.preview.symbols_locked')}</Text>
        </View>
      ) : null}
      <View className="mt-2 gap-3">
        <Pressable onPress={onOpenPlus} accessibilityRole="button" testID={TID.Button.AnalysisPreviewPlus}
          className="min-h-[52px] flex-row items-center justify-center gap-2 rounded-full bg-champagne px-5 active:opacity-80">
          <IconSymbol name="sparkles" size={18} color={noctalia.action.primaryText} />
          <Text className="font-sans-bold text-body text-on-champagne">{t('journal.detail.preview.cta_plus')}</Text>
        </Pressable>
        <Text className="text-center font-sans text-body-sm text-ivory-muted">{t('journal.detail.preview.or_free', { date: freeDate })}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  edge: { position: 'absolute', left: 0, right: 0, height: '32%' },
});
