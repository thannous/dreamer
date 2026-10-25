import React, { useMemo, useState } from 'react';
import { Text, View, type TextStyle } from 'react-native';

import { PressableScale, Reveal } from '@/components/motion';
import { TrendsSectionHead } from '@/components/trends/TrendsSectionHead';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { MarkdownText } from '@/components/ui/MarkdownText';
import type { NoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { TypeScale } from '@/constants/typeScale';
import { useTranslation } from '@/hooks/useTranslation';
import type { SymbolVariation } from '@/lib/symbolTypes';
import { TID } from '@/lib/testIDs';
import { parseHtmlParagraphs } from '@/services/symbolDictionaryService';

export interface InterpretationChapter {
  /** The paragraph's own lead-in, when it names what follows ("Eau, pas inondation :", a question). */
  heading?: string;
  /** A lead-in that is a sentence of the text (the opening scene): set apart above it. */
  kicker?: string;
  /** Markdown: the lead-in's bold and emphasis kept, site links read as plain words. */
  body: string;
}

const LEAD_IN = /^<strong>([\s\S]+?)<\/strong>\s*([\s\S]*)$/;
// A lead-in longer than this is a sentence of the text, not a heading over it.
const HEADING_MAX = 90;
// The closed interpretation shows whole sentences of its opening, about this many characters.
const PREVIEW_MIN = 110;
const PREVIEW_MAX = 260;
const WORDS_PER_MINUTE = 200;

const plain = (html: string) => html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Paragraphs the site keeps and the app leaves out: the invented journal entry and the
// editorial method note, in the six languages, whatever copy of the content is on the phone.
const LEFT_OUT = /^(exemple fictif|fictional (journal )?example|ejemplo ficticio|erfundenes (tagebuch)?beispiel|esempio inventato|exemplo fictício|méthode|method|método|methode|metodo)\b/iu;

function toMarkdown(html: string): string {
  return html
    .replace(/<strong>\s*([\s\S]+?)\s*<\/strong>/g, '**$1**')
    .replace(/<em>\s*([\s\S]+?)\s*<\/em>/g, '*$1*')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The full interpretation as chapters. The entries open most paragraphs with a bold
 * lead-in ending in a colon or a question: shown as the chapter's intertitle, the column
 * reads in steps instead of as one block. Every word of the entry is kept but the
 * journal example and the method note.
 */
export function readInterpretation(html: string): InterpretationChapter[] {
  const kept = parseHtmlParagraphs(html).filter((paragraph) => !LEFT_OUT.test(plain(paragraph)));
  return kept.map((paragraph) => {
    const match = LEAD_IN.exec(paragraph);
    if (match) {
      const leadIn = plain(match[1]);
      // "<strong>Eau</strong> : …" puts its colon after the bold.
      const colonAfter = /^:\s*/.exec(match[2]);
      const rest = colonAfter ? match[2].slice(colonAfter[0].length) : match[2];
      const names = colonAfter !== null || /[:?]$/.test(leadIn);
      if (names && leadIn.length <= HEADING_MAX && plain(rest)) {
        // Once its lead-in stands as a heading, the text under it opens a sentence.
        const body = toMarkdown(rest).replace(/^(\P{L}*)(\p{Ll})/u, (_, lead: string, letter: string) => lead + letter.toUpperCase());
        return { heading: leadIn.replace(/\s*:$/, ''), body };
      }
      // The bold of markdown is the sans face: a serif sentence carries it better on its own line.
      if (!names && plain(rest)) return { kicker: leadIn, body: toMarkdown(rest) };
    }
    return { body: toMarkdown(paragraph) };
  });
}

/** The opening's first whole sentences, or null when the opening is short enough to show whole. */
function openingPreview(body: string): string | null {
  if (body.length <= PREVIEW_MAX + 60) return null;
  let cut = -1;
  for (const end of body.matchAll(/[.?!…]\**(?=\s|$)/g)) {
    const at = end.index + end[0].length;
    if (at > PREVIEW_MAX) {
      if (cut === -1) cut = at;
      break;
    }
    if (at >= PREVIEW_MIN || cut === -1) cut = at;
  }
  if (cut === -1 || cut >= body.length) return null;
  const preview = body.slice(0, cut);
  // A cut inside a bold sentence closes it, so no stray asterisks show.
  return (preview.match(/\*\*/g)?.length ?? 0) % 2 ? `${preview}**` : preview;
}

function readingMinutes(chapters: InterpretationChapter[]): number {
  const words = chapters
    .map((chapter) => `${chapter.heading ?? ''} ${chapter.kicker ?? ''} ${chapter.body}`)
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function useReadingStyles(ink: NoctaliaDesignTokens) {
  return useMemo(() => {
    const lead: TextStyle = { fontFamily: Fonts.fraunces.regular, fontSize: TypeScale.h3.fontSize, lineHeight: 28, color: ink.text.primary };
    const body: TextStyle = { fontFamily: Fonts.outfit.regular, fontSize: TypeScale.body.fontSize, lineHeight: 26, color: ink.text.secondary };
    const question: TextStyle = { ...lead, lineHeight: 26 };
    return { lead, body, question };
  }, [ink]);
}

/** A section of the symbol's page: the dictionary's champagne mark and serif title over a rule. */
export function SymbolSection({ label, aside, testID, children }: {
  label: string;
  /** A quiet line under the title, such as the reading time. */
  aside?: string;
  testID?: string;
  children: React.ReactNode;
}) {
  return (
    <View testID={testID} className="mt-9 border-t border-line pt-7">
      <TrendsSectionHead title={label} subtitle={aside} />
      <View className="mt-5">{children}</View>
    </View>
  );
}

/**
 * The entry's situations as a compact list: each names its situation and opens on what it
 * may mean, so the reader finds their dream's case at a glance and reads only that one.
 */
export function SymbolVariations({ variations, ink }: { variations: SymbolVariation[]; ink: NoctaliaDesignTokens }) {
  const { t } = useTranslation();
  const { body } = useReadingStyles(ink);
  return (
    <SymbolSection label={t('symbols.variations')} testID={TID.Component.SymbolVariations}>
      <View className="gap-2.5">
        {variations.map((variation, index) => (
          <VariationCard
            key={`${variation.context}-${index}`}
            variation={variation}
            index={index}
            meaningStyle={body}
            ink={ink}
          />
        ))}
      </View>
    </SymbolSection>
  );
}

function VariationCard({ variation, index, meaningStyle, ink }: {
  variation: SymbolVariation;
  index: number;
  meaningStyle: TextStyle;
  ink: NoctaliaDesignTokens;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View className="overflow-hidden rounded-lg border border-line bg-ink-soft">
      <PressableScale
        scale={0.99}
        onPress={() => setOpen((value) => !value)}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        accessibilityLabel={variation.context}
        testID={TID.Component.SymbolVariation(index)}
        className="min-h-12 flex-row items-center gap-3 px-4 py-3.5"
      >
        <Text className="flex-1 font-display-semibold text-h3 text-ivory">{variation.context}</Text>
        <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={20} color={ink.text.secondary} />
      </PressableScale>
      {open ? (
        <Reveal distance={6} className="px-4 pb-4">
          <MarkdownText selectable style={meaningStyle}>{variation.meaning}</MarkdownText>
        </Reveal>
      ) : null}
    </View>
  );
}

/** The entry's few questions, kept open: they are short and they are the way in. */
export function SymbolQuestions({ questions, ink }: { questions: string[]; ink: NoctaliaDesignTokens }) {
  const { t } = useTranslation();
  const { question: questionStyle } = useReadingStyles(ink);
  return (
    <SymbolSection label={t('symbols.ask_yourself')} testID={TID.Component.SymbolQuestions}>
      <View className="gap-4">
        {questions.map((question, index) => (
          <View key={`${question}-${index}`} className="flex-row gap-3.5">
            <View className="mt-[11px] h-1.5 w-1.5 rounded-full bg-champagne" />
            <MarkdownText selectable containerStyle={{ flex: 1 }} style={questionStyle}>{question}</MarkdownText>
          </View>
        ))}
      </View>
    </SymbolSection>
  );
}

/**
 * The full interpretation, opened on demand: closed, its opening sentences and the reading
 * time; open, every paragraph under its own intertitle.
 */
export function SymbolInterpretation({ html, ink }: { html: string; ink: NoctaliaDesignTokens }) {
  const { t } = useTranslation();
  const styles = useReadingStyles(ink);
  const chapters = useMemo(() => readInterpretation(html), [html]);
  const preview = useMemo(() => (chapters[0] ? openingPreview(chapters[0].body) : null), [chapters]);
  const minutes = useMemo(() => readingMinutes(chapters), [chapters]);
  const [open, setOpen] = useState(false);
  const closable = chapters.length > 1 || preview !== null;
  const shown = open || !closable ? chapters : chapters.slice(0, 1);

  return (
    <SymbolSection
      label={t('symbols.interpretation')}
      aside={t('symbols.reading_time', { minutes })}
      testID={TID.Component.SymbolInterpretation}
    >
      {shown.map((chapter, index) => (
        <View key={index} className={index > 0 ? 'mt-7 gap-2' : 'gap-2'}>
          {chapter.heading ? (
            <Text accessibilityRole="header" className="font-display-semibold text-h3 text-ivory">
              {chapter.heading}
            </Text>
          ) : null}
          {chapter.kicker ? (
            <Text selectable className="font-display-semibold text-h3 leading-7 text-ivory">{chapter.kicker}</Text>
          ) : null}
          <MarkdownText style={index === 0 ? styles.lead : styles.body}>
            {index === 0 && !open && preview ? preview : chapter.body}
          </MarkdownText>
        </View>
      ))}
      {closable ? (
        <PressableScale
          onPress={() => setOpen((value) => !value)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          aria-expanded={open}
          testID={TID.Component.SymbolInterpretationToggle}
          className="mt-5 min-h-11 flex-row items-center gap-1.5 self-start rounded-full border border-line px-4 py-2"
        >
          <Text className="font-sans-medium text-body text-champagne-on">
            {t(open ? 'symbols.read_less' : 'symbols.read_more')}
          </Text>
          <IconSymbol name={open ? 'chevron.up' : 'chevron.down'} size={18} color={ink.accent.text} />
        </PressableScale>
      ) : null}
    </SymbolSection>
  );
}

/** Offline before the entry's first download: where the interpretation will be. */
export function SymbolInterpretationUnavailable() {
  const { t } = useTranslation();
  return (
    <SymbolSection label={t('symbols.interpretation')} testID={TID.Component.SymbolInterpretation}>
      <Text className="font-sans text-body text-ivory-muted">{t('symbols.interpretation_offline')}</Text>
    </SymbolSection>
  );
}
