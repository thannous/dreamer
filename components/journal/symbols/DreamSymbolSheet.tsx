import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';
import Animated, { useReducedMotion, type CSSStyle } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { BookStar, BookSubheading } from '@/components/journal/JournalBook';
import { entrance, reducedDelay } from '@/components/journal/story/dreamStoryMotion';
import { sparklePath } from '@/components/journal/story/sparkle';
import { PressableScale } from '@/components/motion';
import { EASE } from '@/components/motion/motion';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { StandardBottomSheet } from '@/components/ui/StandardBottomSheet';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { useDreamsActions } from '@/context/DreamsContext';
import { useTheme } from '@/context/ThemeContext';
import { useLocaleFormatting } from '@/hooks/useLocaleFormatting';
import { useSymbolContent } from '@/hooks/useSymbolContent';
import { useTranslation } from '@/hooks/useTranslation';
import { getDreamIdentityKey } from '@/lib/dreamIdentity';
import { getDreamRouteParams } from '@/lib/dreamRoute';
import { toJournalFilterParams } from '@/lib/journalFilterLink';
import { logger } from '@/lib/logger';
import {
  confirmPersonalSymbol, isNewPersonalSymbol, type LinkedSymbol, type SymbolAppearance, type SymbolIndex,
} from '@/lib/symbolLinks';
import type { SymbolLanguage } from '@/lib/symbolTypes';
import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';
import { getSymbolById } from '@/services/symbolDictionaryService';

import { SymbolMedallion } from './SymbolMedallion';
import { symbolStatusLabel } from './symbolStatusLabel';

const MEDALLION = 96;
/** Past this, the thread keeps the symbol's first dream and its latest ones. */
const MAX_TRACES = 6;
const MAX_COMPANIONS = 4;
const MAX_RELATED = 4;
const MAX_QUESTIONS = 3;

/**
 * The beats of a symbol's page, in milliseconds. A symbol already known arrives at once;
 * a symbol born in this dream is told: a spark, its light spreading in two rings, then
 * its face, its name, and what it is.
 */
const BEAT = {
  known: { name: 120, status: 180, about: 240, sections: 320 },
  born: { name: 900, status: 960, about: 1150, sections: 1400 },
  sectionStep: 90,
  traceStep: 90,
  spark: 1100,
  ripple: 1400,
  rippleSteps: [300, 650],
  medallionLead: 480,
  medallionGrow: 900,
  /** "Followed in your journal" follows the confirmation by this much, once the birth has been seen. */
  added: 1400,
} as const;

type Ink = ReturnType<typeof getNoctaliaDesignTokens>;

const plain = (text: string): string => text.replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim();
const sameDream = (a: DreamAnalysis, b: DreamAnalysis | null) => b !== null && getDreamIdentityKey(a) === getDreamIdentityKey(b);

/**
 * A symbol's page, opened from the dream's reading: its face, what it has done across
 * the journal, the dreams it went through (each one opens), the symbols it keeps company
 * with, and for a dictionary symbol the dictionary's landmarks.
 *
 * The dreamer's own symbol is born with its first dream and becomes theirs the first time
 * they open it: that opening is its birth, told once, and the confirmation is saved with
 * the dream, so every device of the account sees it.
 */
export function DreamSymbolSheet({ index, dream, linkKey, onSelect, onClose }: {
  index: SymbolIndex;
  /**
   * The dream whose reading is open: its trace reads "This dream" and does not open. Null
   * when the sheet opens outside a reading (Tendances): every dream of the thread opens.
   */
  dream: DreamAnalysis | null;
  /** The symbol to show, or null when the sheet is closed. */
  linkKey: string | null;
  onSelect: (linkKey: string) => void;
  onClose: () => void;
}) {
  const { t, currentLang } = useTranslation();
  const { updateDream } = useDreamsActions();
  const visible = linkKey !== null;
  // The page stays on its symbol while the sheet closes; it changes only for another symbol.
  const [shown, setShown] = useState<{ open: boolean; key: string | null; born: string | null }>(
    { open: false, key: null, born: null },
  );
  // The symbols left for a companion, newest last: back returns to them. Each opening starts afresh.
  const [trail, setTrail] = useState<readonly string[]>([]);
  if (shown.open !== visible || (linkKey !== null && shown.key !== linkKey)) {
    if (visible && !shown.open && trail.length) setTrail([]);
    const next = linkKey ? index.symbols.get(linkKey) : undefined;
    setShown({
      open: visible,
      key: linkKey ?? shown.key,
      // Captured on opening: the birth keeps being told once the confirmation lands. Only the
      // reading of its first dream tells it; anywhere else, the symbol has already come back.
      born: dream && next && isNewPersonalSymbol(next) && sameDream(next.appearances[0].dream, dream)
        ? next.linkKey
        : visible && !shown.open ? null : shown.born,
    });
  }
  const symbol = shown.key ? index.symbols.get(shown.key) : undefined;
  const born = symbol !== undefined && shown.born === symbol.linkKey;

  // Opening the dreamer's own symbol makes it theirs.
  const confirming = useRef(new Set<string>());
  useEffect(() => {
    const key = symbol?.personalKey;
    if (!visible || !key || !isNewPersonalSymbol(symbol) || confirming.current.has(key)) return;
    // An older reading that joined the symbol by its name holds no key to confirm.
    const keyed = symbol.appearances.filter((entry) => entry.insight.key === key);
    const appearance = keyed.find((entry) => sameDream(entry.dream, dream)) ?? keyed[keyed.length - 1];
    const symbols = appearance ? confirmPersonalSymbol(appearance.dream, key) : null;
    if (!appearance || !symbols) return;
    confirming.current.add(key);
    updateDream({ ...appearance.dream, symbols, clientUpdatedAt: Date.now() })
      .catch((error: unknown) => logger.warn('[DreamSymbolSheet] personal symbol not confirmed', error))
      .finally(() => confirming.current.delete(key));
  }, [dream, symbol, updateDream, visible]);

  if (!symbol) return null;
  const dictionaryId = symbol.symbolId;
  const previous = trail[trail.length - 1];
  const toCompanion = (next: string) => {
    setTrail([...trail, symbol.linkKey]);
    onSelect(next);
  };
  const eyebrow = born
    ? t('journal.symbols.born.eyebrow')
    : t(dictionaryId ? 'journal.symbols.kind.dictionary' : 'journal.symbols.kind.personal');

  return (
    <StandardBottomSheet
      visible={visible}
      onClose={onClose}
      title={symbol.name}
      focusKey={symbol.linkKey}
      testID={TID.Sheet.DreamSymbol}
      titleTestID={TID.Text.DreamSymbolTitle}
      headerContent={(
        <Text allowFontScaling={false} className="text-center font-sans-medium text-[12px] uppercase tracking-[2.4px] text-champagne-on">
          {eyebrow}
        </Text>
      )}
      closeButton={{ label: t('journal.symbols.close'), testID: TID.Button.DreamSymbolClose }}
      backButton={previous ? {
        label: t('journal.symbols.back', { name: index.symbols.get(previous)?.name ?? '' }),
        testID: TID.Button.DreamSymbolBack,
        onPress: () => {
          setTrail(trail.slice(0, -1));
          onSelect(previous);
        },
      } : undefined}
      actions={dictionaryId ? {
        primaryLabel: t('journal.symbols.guide.read_more'),
        primaryTrailingIcon: 'arrow.right',
        primaryTestID: TID.Button.DreamSymbolReadMore,
        onPrimary: () => {
          onClose();
          router.push({ pathname: '/symbol-detail/[id]', params: { id: dictionaryId } });
        },
      } : undefined}
    >
      {/* Keyed: another symbol is another page, told from its start. */}
      <SymbolPage key={`${symbol.linkKey}:${born ? 'born' : 'known'}`} symbol={symbol} index={index} dream={dream}
        born={born} language={currentLang} onSelect={toCompanion} onClose={onClose} />
    </StandardBottomSheet>
  );
}

function SymbolPage({ symbol, index, dream, born, language, onSelect, onClose }: {
  symbol: LinkedSymbol;
  index: SymbolIndex;
  dream: DreamAnalysis | null;
  born: boolean;
  language: SymbolLanguage;
  onSelect: (linkKey: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormatting();
  const reduced = useReducedMotion();
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const beats = born ? BEAT.born : BEAT.known;

  const entry = symbol.symbolId ? getSymbolById(symbol.symbolId) : undefined;
  // The guide appears once the language's bundled content is read (once per launch).
  const content = useSymbolContent(language);
  const guide = entry ? content?.[entry.id] : undefined;
  const birthplace = symbol.appearances[0]?.dream;
  const longDate = (timestamp: number) => formatDate(timestamp, new Date(timestamp).getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' });
  const onlyHere = symbol.appearances.length === 1 && sameDream(symbol.appearances[0].dream, dream);
  const companions = symbol.companions
    .map((companion) => ({ ...companion, symbol: index.symbols.get(companion.linkKey) }))
    .filter((companion): companion is typeof companion & { symbol: LinkedSymbol } => Boolean(companion.symbol))
    .slice(0, MAX_COMPANIONS);
  // The dictionary's neighbours the dreamer has dreamed too, even in other dreams: a family of images.
  const related = (entry?.relatedSymbols ?? [])
    .map((id) => index.symbols.get(`d:${id}`))
    .filter((neighbour): neighbour is LinkedSymbol => neighbour !== undefined && neighbour !== symbol
      && !companions.some((companion) => companion.linkKey === neighbour.linkKey))
    .slice(0, MAX_RELATED);

  const sections: React.ReactNode[] = [];
  if (!onlyHere) {
    sections.push(
      <DreamTraces key="traces" symbol={symbol} dream={dream} reduced={reduced}
        onOpen={(target) => {
          onClose();
          router.push({ pathname: '/journal/[id]', params: getDreamRouteParams(target) });
        }}
        onOpenAll={() => {
          onClose();
          const target = {
            pathname: '/(tabs)/journal' as const,
            params: toJournalFilterParams({ symbol: symbol.linkKey }, String(Date.now())),
          };
          // A reading is a screen over the tabs: return to them rather than stack another set.
          if (dream) router.dismissTo(target);
          else router.navigate(target);
        }} />,
    );
  }
  if (companions.length) {
    sections.push(
      <View key="companions" className="gap-4">
        {/* "Often" only once they have met in more than one dream. */}
        <BookSubheading>
          {t(companions.some(({ count }) => count >= 2) ? 'journal.symbols.companions.header' : 'journal.symbols.companions.header_once')}
        </BookSubheading>
        <View className="flex-row flex-wrap justify-center gap-2">
          {companions.map((companion) => {
            const often = companion.count >= 2 ? t('journal.symbols.companions.count', { count: companion.count }) : null;
            return (
              <SymbolChip key={companion.linkKey} symbol={companion.symbol} note={often}
                testID={TID.List.DreamSymbolCompanion(companion.linkKey)} onPress={() => onSelect(companion.linkKey)} />
            );
          })}
        </View>
      </View>,
    );
  }
  if (related.length) {
    sections.push(
      <View key="related" className="gap-4">
        <BookSubheading>{t('journal.symbols.related.header')}</BookSubheading>
        <View className="flex-row flex-wrap justify-center gap-2">
          {related.map((neighbour) => (
            <SymbolChip key={neighbour.linkKey} symbol={neighbour} note={null}
              testID={TID.List.DreamSymbolRelated(neighbour.linkKey)} onPress={() => onSelect(neighbour.linkKey)} />
          ))}
        </View>
      </View>,
    );
  }
  if (guide) {
    sections.push(
      <View key="guide" className="gap-3">
        <BookSubheading>{t('journal.symbols.guide.header')}</BookSubheading>
        <Text className="font-serif text-[16px] leading-[26px] text-ivory">{guide.shortDescription}</Text>
        {guide.askYourself.length ? (
          <View className="mt-1 gap-2.5">
            <Text className="font-sans-medium text-[12px] uppercase tracking-[1.6px] text-champagne-on">{t('symbols.ask_yourself')}</Text>
            {guide.askYourself.slice(0, MAX_QUESTIONS).map((question) => (
              <View key={question} className="flex-row gap-2.5">
                <View className="pt-2"><BookStar size={3.5} /></View>
                <Text className="flex-1 font-serif-italic text-[16px] leading-6 text-ivory">{question}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>,
    );
  }

  return (
    <View className="gap-8 pb-4">
      <View className="items-center gap-2">
        <SymbolHero symbol={symbol} born={born} reduced={reduced} ink={ink} />
        {/* The sheet's heading already names the symbol for assistive technology. */}
        <Rise delay={beats.name} reduced={reduced} aria-hidden
          accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text className="text-center font-serif-italic text-[28px] leading-9 text-ivory">{symbol.name}</Text>
        </Rise>
        <Rise delay={beats.status} reduced={reduced}>
          <Text testID={TID.Text.DreamSymbolStatus}
            className="text-center font-sans text-[14px] leading-5 text-ivory-muted">
            {symbolStatusLabel(t, symbol, index)}
          </Text>
        </Rise>
        <Rise delay={beats.about} reduced={reduced} className="mt-2 items-center gap-2 px-2">
          {born ? (
            <Text testID={TID.Text.DreamSymbolBorn} className="text-center font-serif text-[16px] leading-[26px] text-ivory">
              {t('journal.symbols.born.body')}
            </Text>
          ) : symbol.kind === 'personal' ? (
            <>
              {birthplace ? (
                <Text className="text-center font-serif-italic text-[15px] leading-6 text-ivory-muted">
                  {t('journal.symbols.personal.origin', { date: longDate(birthplace.id), title: plain(birthplace.title) })}
                </Text>
              ) : null}
              <Text className="text-center font-serif text-[16px] leading-[26px] text-ivory">{t('journal.symbols.personal.body')}</Text>
            </>
          ) : null}
        </Rise>
        {born && symbol.confirmed ? <AddedLine reduced={reduced} /> : null}
      </View>
      {sections.map((section, sectionIndex) => (
        <Rise key={sectionIndex} delay={beats.sections + sectionIndex * BEAT.sectionStep} reduced={reduced}>
          {section}
        </Rise>
      ))}
    </View>
  );
}

/** A part of the page arriving once: it rises a little into place. */
function Rise({ delay, reduced, style, children, ...rest }: ViewProps & { delay: number; reduced: boolean; className?: string }) {
  const rise = useMemo(() => entrance({ from: [{ translateY: 8 }], to: [{ translateY: 0 }] }, 420, delay, reduced), [delay, reduced]);
  return <Animated.View {...rest} style={[style, rise] as StyleProp<ViewStyle>}>{children}</Animated.View>;
}

/** The symbol's face arriving: lit at once when known, born from a spark the first time. */
function SymbolHero({ symbol, born, reduced, ink }: { symbol: LinkedSymbol; born: boolean; reduced: boolean; ink: Ink }) {
  const face = useMemo<CSSStyle>(() => (born && !reduced ? {
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: 0.55 }] },
      '65%': { opacity: 1, transform: [{ scale: 1.06 }] },
      '100%': { opacity: 1, transform: [{ scale: 1 }] },
    },
    animationDuration: BEAT.medallionGrow,
    animationDelay: BEAT.medallionLead,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  } : entrance({ from: [{ scale: 0.94 }], to: [{ scale: 1 }] }, 420, born ? BEAT.medallionLead : 0, reduced)),
  [born, reduced]);

  return (
    <View className="items-center justify-center" style={{ width: MEDALLION * 2, height: MEDALLION + 40 }}>
      {born && !reduced ? (
        <>
          {BEAT.rippleSteps.map((delay) => <Ripple key={delay} delay={delay} />)}
          <Spark ink={ink} />
        </>
      ) : !reduced ? <Glow /> : null}
      <Animated.View style={face as StyleProp<ViewStyle>}>
        <SymbolMedallion symbol={symbol} size={MEDALLION} />
      </Animated.View>
    </View>
  );
}

const ringStyle = { position: 'absolute', width: MEDALLION, height: MEDALLION, borderRadius: MEDALLION / 2 } as const;

/** The light of a birth, spreading once as a ring. */
function Ripple({ delay }: { delay: number }) {
  const spread = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      from: { opacity: 0.8, transform: [{ scale: 0.35 }] },
      to: { opacity: 0, transform: [{ scale: 1.9 }] },
    },
    animationDuration: BEAT.ripple,
    animationDelay: delay,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), [delay]);
  return <Animated.View pointerEvents="none" className="border border-champagne"
    style={[ringStyle, spread] as StyleProp<ViewStyle>} />;
}

/** The star the symbol is born from: it flares, turns, and gives way to the face. */
function Spark({ ink }: { ink: Ink }) {
  const size = 44;
  const flare = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      '0%': { opacity: 0, transform: [{ scale: 0.2 }, { rotate: '0deg' }] },
      '40%': { opacity: 1, transform: [{ scale: 1.3 }, { rotate: '45deg' }] },
      '100%': { opacity: 0, transform: [{ scale: 0.5 }, { rotate: '90deg' }] },
    },
    animationDuration: BEAT.spark,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), []);
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, flare] as StyleProp<ViewStyle>}>
      <Svg width={size} height={size}>
        <Path d={sparklePath(size / 2, size / 2, size / 2)} fill={ink.accent.text} />
      </Svg>
    </Animated.View>
  );
}

/** A known symbol's face lighting up once as the page opens. */
function Glow() {
  const pulse = useMemo<CSSStyle<ViewStyle>>(() => ({
    animationName: {
      from: { opacity: 0.3, transform: [{ scale: 0.9 }] },
      to: { opacity: 0, transform: [{ scale: 1.45 }] },
    },
    animationDuration: 1100,
    animationDelay: 200,
    animationTimingFunction: EASE.out,
    animationFillMode: 'both',
  }), []);
  return <Animated.View pointerEvents="none" className="bg-champagne" style={[ringStyle, pulse] as StyleProp<ViewStyle>} />;
}

/** Said once the confirmation is saved, never before. */
function AddedLine({ reduced }: { reduced: boolean }) {
  const { t } = useTranslation();
  const style = useMemo(() => entrance({ from: [{ translateY: 4 }], to: [{ translateY: 0 }] }, 420, BEAT.added, reduced), [reduced]);
  return (
    <Animated.View style={style as StyleProp<ViewStyle>} accessibilityLiveRegion="polite"
      className="mt-1 flex-row items-center gap-2 rounded-full border border-champagne-soft px-3.5 py-1.5">
      <BookStar size={4} />
      <Text className="font-sans-medium text-[13px] text-champagne-on">{t('journal.symbols.born.confirmed')}</Text>
    </Animated.View>
  );
}

/**
 * The dreams the symbol went through, oldest first, on a thread that draws itself from
 * one to the next as each dream's star lights. Each dream opens, except the one being read.
 */
function DreamTraces({ symbol, dream, reduced, onOpen, onOpenAll }: {
  symbol: LinkedSymbol;
  dream: DreamAnalysis | null;
  reduced: boolean;
  onOpen: (target: DreamAnalysis) => void;
  /** Opens the journal on every dream of the thread. */
  onOpenAll: () => void;
}) {
  const { colors, mode } = useTheme();
  const ink = useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
  const { t } = useTranslation();
  const { formatDate } = useLocaleFormatting();
  const all = symbol.appearances;
  const hidden = all.length > MAX_TRACES ? all.length - (MAX_TRACES - 1) : 0;
  const traces: (SymbolAppearance | 'more')[] = hidden
    ? [all[0], 'more', ...all.slice(-(MAX_TRACES - 2))]
    : all;
  const shortDate = (timestamp: number) => formatDate(timestamp, new Date(timestamp).getFullYear() === new Date().getFullYear()
    ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <View className="gap-4">
      <BookSubheading>{t('journal.symbols.timeline.header')}</BookSubheading>
      <View>
        {traces.map((trace, position) => {
          const last = position === traces.length - 1;
          const step = position * BEAT.traceStep;
          if (trace === 'more') {
            return (
              <TraceRow key="more" step={step} last={last} reduced={reduced} faint>
                <Text className="pb-5 font-serif-italic text-[15px] leading-6 text-ivory-muted">
                  {t('journal.symbols.timeline.more', { count: hidden })}
                </Text>
              </TraceRow>
            );
          }
          const current = sameDream(trace.dream, dream);
          const date = shortDate(trace.dream.id);
          const title = plain(trace.dream.title);
          const body = (
            <View className="gap-0.5 pb-5">
              <Text className="font-sans-medium text-[12px] uppercase tracking-[1.4px] text-champagne-on">
                {current ? `${date} · ${t('journal.symbols.timeline.current')}` : date}
              </Text>
              {title ? <Text numberOfLines={2} className="font-serif-bold-italic text-[17px] leading-6 text-ivory">{title}</Text> : null}
              <Text numberOfLines={3} className="font-serif-italic text-[15px] leading-[22px] text-ivory-muted">{plain(trace.insight.meaning)}</Text>
            </View>
          );
          return (
            <TraceRow key={getDreamIdentityKey(trace.dream)} step={step} last={last} reduced={reduced} current={current}>
              {current ? body : (
                <PressableScale onPress={() => onOpen(trace.dream)} accessibilityRole="button"
                  accessibilityLabel={title ? `${date}, ${title}` : date}
                  accessibilityHint={t('journal.symbols.timeline.open_hint')}
                  testID={TID.List.DreamSymbolAppearance(trace.dream.id)}>
                  {body}
                </PressableScale>
              )}
            </TraceRow>
          );
        })}
      </View>
      {all.length > 1 ? (
        <PressableScale onPress={onOpenAll} accessibilityRole="button" testID={TID.Button.DreamSymbolAllDreams}
          className="min-h-11 flex-row items-center justify-center gap-2 self-center rounded-full border border-champagne-soft px-5">
          <Text className="font-sans-bold text-[15px] text-champagne-on">
            {t('journal.symbols.timeline.all', { count: all.length })}
          </Text>
          <IconSymbol name="arrow.right" size={14} color={ink.accent.text} />
        </PressableScale>
      ) : null}
    </View>
  );
}

/** Another symbol of the journal, met beside this one: tapping it opens its page in place. */
function SymbolChip({ symbol, note, testID, onPress }: {
  symbol: LinkedSymbol;
  note: string | null;
  testID: string;
  onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button"
      accessibilityLabel={note ? `${symbol.name}, ${note}` : symbol.name}
      accessibilityHint={t('journal.symbols.open_hint')}
      testID={testID}
      className="min-h-11 flex-row items-center gap-2 rounded-full border border-champagne-soft bg-ink-soft py-1 pl-1 pr-3.5">
      <SymbolMedallion symbol={symbol} size={36} />
      <Text className="font-sans-medium text-[14px] text-ivory">{symbol.name}</Text>
      {note ? <Text className="font-sans text-[12px] text-ivory-muted">{note}</Text> : null}
    </PressableScale>
  );
}

/** One stop on the thread: its star lights, then the thread runs on to the next stop. */
function TraceRow({ step, last, reduced, current = false, faint = false, children }: {
  step: number;
  last: boolean;
  reduced: boolean;
  current?: boolean;
  faint?: boolean;
  children: React.ReactNode;
}) {
  const ignite = useMemo<CSSStyle>(() => (reduced
    ? entrance(null, 320, step, true)
    : {
        animationName: {
          '0%': { opacity: 0, transform: [{ scale: 0.4 }] },
          '60%': { opacity: 1, transform: [{ scale: 1.25 }] },
          '100%': { opacity: 1, transform: [{ scale: 1 }] },
        },
        animationDuration: 420,
        animationDelay: step,
        animationTimingFunction: EASE.out,
        animationFillMode: 'both',
      }), [reduced, step]);
  const draw = useMemo<CSSStyle<ViewStyle>>(() => (reduced
    ? { animationName: { from: { opacity: 0 }, to: { opacity: 0.45 } }, animationDuration: 320,
        animationDelay: reducedDelay(step), animationFillMode: 'both' }
    : {
        animationName: {
          from: { opacity: 0.45, transform: [{ scaleY: 0 }] },
          to: { opacity: 0.45, transform: [{ scaleY: 1 }] },
        },
        animationDuration: 360,
        animationDelay: step + 180,
        animationTimingFunction: EASE.inOut,
        animationFillMode: 'both',
      }), [reduced, step]);
  const text = useMemo(() => entrance({ from: [{ translateX: -6 }], to: [{ translateX: 0 }] }, 420, step + 80, reduced), [reduced, step]);

  return (
    <View className="flex-row gap-3">
      <View className="w-6 items-center">
        <Animated.View className="h-6 items-center justify-center" style={ignite as StyleProp<ViewStyle>}>
          {current ? <View className="absolute h-6 w-6 rounded-full border border-champagne-soft" /> : null}
          <BookStar size={current ? 6 : faint ? 2.5 : 4.5} opacity={faint ? 0.6 : 1} />
        </Animated.View>
        {!last ? (
          <Animated.View className="w-px flex-1 bg-champagne"
            style={[{ opacity: 0.45, transformOrigin: 'top' }, draw] as StyleProp<ViewStyle>} />
        ) : null}
      </View>
      <Animated.View className="flex-1 pt-0.5" style={text as StyleProp<ViewStyle>}>{children}</Animated.View>
    </View>
  );
}
