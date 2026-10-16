import React, { useMemo, useState } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { sparklePath } from '@/components/journal/story/sparkle';
import { MarkdownText } from '@/components/ui/MarkdownText';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { Fonts } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';

/**
 * The typography of a dream page set as a book: a measure the eye can follow, sections
 * opened by an ornament and a line of spaced capitals, and the story opening on a raised
 * initial. Shared by the dream page and its drawn likeness, so a page turned to keeps
 * its place.
 */

/**
 * The page's text block on a wide screen, its 16-point margins included, centred as a
 * book's text block is on its page; a phone's page is narrower than this.
 */
export const BOOK_MEASURE = 640;

function useInk() {
  const { colors, mode } = useTheme();
  return useMemo(() => getNoctaliaDesignTokens(colors, mode), [colors, mode]);
}

/** The four-pointed star of the dream story, small, in the page's accent ink. Decorative. */
export function BookStar({ size = 5, opacity = 1 }: { size?: number; opacity?: number }) {
  const ink = useInk();
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width={size * 2} height={size * 2}>
        <Path d={sparklePath(size, size, size)} fill={ink.accent.text} opacity={opacity} />
      </Svg>
    </View>
  );
}

function Hairline({ width = 32 }: { width?: number }) {
  return <View className="h-px bg-champagne opacity-40" style={{ width }} />;
}

/** A break between two parts of the page: two hairlines either side of a star. Decorative. */
export function BookOrnament({ className = '', width = 32 }: { className?: string; width?: number }) {
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      className={`flex-row items-center justify-center gap-2.5 ${className}`}>
      <Hairline width={width} />
      <BookStar />
      <Hairline width={width} />
    </View>
  );
}

/**
 * A section's opening, as a book sets it: its name in spaced capitals between two
 * hairlines, centred. `scale` follows the page's bounded text scale.
 */
export function BookSectionMark({ label, testID, scale = 1, className = '' }: {
  label: string;
  testID?: string;
  scale?: number;
  className?: string;
}) {
  return (
    <View className={`flex-row items-center justify-center gap-3 ${className}`}>
      <Hairline width={24} />
      <Text allowFontScaling={false} accessibilityRole="header" testID={testID}
        style={{ fontFamily: Fonts.lora.regular, fontSize: 12 * scale, lineHeight: 18 * scale, letterSpacing: 2.6 }}
        className="shrink text-center uppercase text-champagne-on">
        {label}
      </Text>
      <Hairline width={24} />
    </View>
  );
}

/** A part within a section, such as the dream's symbols: centred italic under a small star. */
export function BookSubheading({ children }: { children: string }) {
  return (
    <View className="items-center gap-2">
      <BookStar size={4} opacity={0.7} />
      <Text accessibilityRole="header" className="text-center font-serif-italic text-[20px] leading-7 text-ivory">
        {children}
      </Text>
    </View>
  );
}

/**
 * Body text of the page: a serif at a book's reading size, set ragged right, as books
 * with a narrow measure are: without hyphenation, justified lines open wide gaps.
 */
export function useBookBody(italic = false) {
  const ink = useInk();
  return useMemo(() => ({
    fontFamily: italic ? Fonts.lora.regularItalic : Fonts.lora.regular,
    fontSize: 17,
    lineHeight: 28,
    color: ink.text.primary,
  }), [ink.text.primary, italic]);
}

/** Text that needs the Markdown renderer: lists, headings, quotes, emphasis, code or links. */
const MARKDOWN = /(^|\n)\s{0,3}(#{1,6}\s|>|[-*+]\s|\d+[.)]\s|```)|\*\*|__|`|~~|!?\[[^\]]*\]\(|(^|\s)[*_][^*_\s][^*_\n]*[*_]/;
/** The story's initial: any opening quotation mark, then its first letter. */
const INITIAL_LETTER = /^[«"“‘'(\[¿¡]*\s?\p{L}/u;

/** The story's measures; the raised initial is set to them. */
const PROSE = { fontSize: 17, lineHeight: 29 };
const INITIAL = { fontSize: 56, lineHeight: 60 };
/** Half the difference of ascent and descent, per em, of Lora (the story) and Fraunces (the initial). */
const LORA_SHIFT = (1.006 - 0.274) / 2;
const FRAUNCES_SHIFT = (0.978 - 0.255) / 2;
/** Fraunces' capital height, per em: how far the initial stands above the line it opens. */
const FRAUNCES_CAP = 0.7;
const INITIAL_GAP = 3;

/**
 * The dreamer's story set as a book's first page: it opens on a raised initial in the
 * accent ink, standing on the first line. The words are the dreamer's own, unchanged and
 * in one selectable block, read and copied as written. A story written with Markdown
 * keeps the Markdown renderer, without the initial.
 */
export function BookProse({ text }: { text: string }) {
  const ink = useInk();
  const { fontScale } = useWindowDimensions();
  const body = useBookBody();
  const story = text.trimStart();
  const initial = MARKDOWN.test(story) ? null : INITIAL_LETTER.exec(story)?.[0];
  // The story keeps native font scaling; the initial follows it, within bounds.
  const scale = Platform.OS === 'web' ? 1 : Math.max(1, fontScale);
  const initialScale = Math.min(1.6, scale);
  const initialSize = INITIAL.fontSize * initialScale;
  const [initialWidth, setInitialWidth] = useState(initialSize * 0.7);

  if (!initial) {
    return <MarkdownText variant="reading" style={{ ...body, lineHeight: PROSE.lineHeight }}>{text}</MarkdownText>;
  }
  const rest = story.slice(initial.length);
  const prose = { ...body, fontSize: PROSE.fontSize, lineHeight: PROSE.lineHeight };
  const initialInk = { fontFamily: Fonts.fraunces.semiBold, fontSize: initialSize, color: ink.accent.text };
  // A line box sets its text on a baseline half the line down, shifted by the font's metrics.
  const proseBaseline = (PROSE.lineHeight * scale) / 2 + PROSE.fontSize * scale * LORA_SHIFT;
  // The room the initial takes above the first line.
  const rise = Math.max(0, Math.ceil(initialSize * FRAUNCES_CAP - proseBaseline + 2));

  if (Platform.OS === 'web') {
    // The browser sets the initial in the line itself, on its baseline, without
    // heightening the line: the text reads exactly as written.
    return (
      <View style={{ paddingTop: rise }}>
        <Text selectable style={prose}>
          <Text style={{ ...initialInk, lineHeight: 0, marginRight: INITIAL_GAP }}>{initial}</Text>
          {rest}
        </Text>
      </View>
    );
  }

  // A native line takes one height for all its text, so the initial is drawn beside the
  // story on the first line's baseline, and an inline space of its width opens that line.
  const initialLine = INITIAL.lineHeight * initialScale;
  const initialBaseline = initialLine / 2 + initialSize * FRAUNCES_SHIFT;
  return (
    <View style={{ paddingTop: rise }}>
      <Text allowFontScaling={false} accessible={false} importantForAccessibility="no" selectable={false}
        onLayout={({ nativeEvent: { layout } }) => {
          setInitialWidth((previous) => Math.abs(previous - layout.width) < 0.5 ? previous : layout.width);
        }}
        style={{ ...initialInk, lineHeight: initialLine, position: 'absolute', left: 0, top: rise + proseBaseline - initialBaseline }}>
        {initial}
      </Text>
      {/* Read aloud as written: the initial drawn beside the text belongs to its first word. */}
      <Text selectable style={prose} accessibilityLabel={story}>
        <View style={{ width: initialWidth + INITIAL_GAP, height: 1 }} />
        {rest}
      </Text>
    </View>
  );
}
