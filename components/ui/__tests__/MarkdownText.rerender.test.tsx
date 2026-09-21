import React from 'react';
import { Platform, Text, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { createMarkdownStyles } from '@/constants/markdownStyles';
import { sanitizeMarkdown } from '@/lib/markdownSecurity';
import { MarkdownText } from '@/components/ui/MarkdownText';

jest.mock('react-native-enriched-markdown', () => ({
  EnrichedMarkdownText: jest.fn(() => null),
}));

jest.mock('@/lib/markdownSecurity', () => {
  const actual = jest.requireActual('@/lib/markdownSecurity');
  return {
    ...actual,
    sanitizeMarkdown: jest.fn((value: string) => actual.sanitizeMarkdown(value)),
  };
});

jest.mock('@/constants/markdownStyles', () => {
  const actual = jest.requireActual('@/constants/markdownStyles');
  return {
    ...actual,
    createMarkdownStyles: jest.fn(actual.createMarkdownStyles),
  };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#d4a574',
      accentLight: '#f0dbbf',
      accentDark: '#805026',
      textOnAccentSurface: '#24160b',
      accentText: '#9a6332',
      backgroundSecondary: '#222222',
      backgroundCard: '#111111',
      divider: '#444444',
      textPrimary: '#ffffff',
      textSecondary: '#cccccc',
    },
  }),
}));

const nativeRenderer = jest.mocked(EnrichedMarkdownText);
const sanitize = jest.mocked(sanitizeMarkdown);
const buildStyles = jest.mocked(createMarkdownStyles);

const PRIMARY = '#fff9ef';
const SECONDARY = '#d9d0c5';
const PARAGRAPH = 'The corridor kept the same door, the same light, and the same unfinished sentence. ';
const transcript = PARAGRAPH.repeat(80);
const interpretation = `[the door](https://example.com/door)\n\n${PARAGRAPH.repeat(160)}`;
const symbols = Array.from({ length: 6 }, (_, index) => (
  `[symbol ${index}](https://example.com/symbol-${index}) ${PARAGRAPH.repeat(8)}`
));
const emotions = Array.from({ length: 4 }, (_, index) => (
  `[emotion ${index}](https://example.com/emotion-${index}) ${PARAGRAPH.repeat(8)}`
));
const questions = Array.from({ length: 3 }, (_, index) => `What stayed unresolved in room ${index}?`);
const BLOCK_COUNT = 2 + symbols.length + emotions.length + questions.length;
const WARMUP_RENDERS = 5;
const MEASURED_RENDERS = 40;

function DreamReading({
  tick,
  readingOpen,
  bodyColor = SECONDARY,
}: {
  tick: number;
  readingOpen: boolean;
  bodyColor?: string;
}) {
  return (
    <View>
      <Text>{tick}</Text>
      <MarkdownText style={{ fontSize: 14, lineHeight: 26, color: bodyColor }}>{transcript}</MarkdownText>
      <MarkdownText
        variant="reading"
        style={{ fontSize: 16, lineHeight: 26, color: PRIMARY }}
        containerStyle={{ marginBottom: 16 }}
      >
        {interpretation}
      </MarkdownText>
      {symbols.map((meaning, index) => (
        <MarkdownText key={`symbol-${index}`} style={{ fontSize: 15, lineHeight: 22, color: bodyColor }}>
          {meaning}
        </MarkdownText>
      ))}
      {emotions.map((insight, index) => (
        <MarkdownText key={`emotion-${index}`} style={{ fontSize: 15, lineHeight: 22, color: bodyColor }}>
          {insight}
        </MarkdownText>
      ))}
      {questions.map((question, index) => (
        <MarkdownText key={`question-${index}`} style={{ fontSize: 15, lineHeight: 22, color: bodyColor }}>
          {question}
        </MarkdownText>
      ))}
      {readingOpen ? (
        <View>
          <MarkdownText variant="reading" style={[readingBody, { color: PRIMARY }]}>{interpretation}</MarkdownText>
          {symbols.map((meaning, index) => (
            <MarkdownText key={`reading-symbol-${index}`} variant="reading" style={[readingBody, { color: PRIMARY }]}>
              {meaning}
            </MarkdownText>
          ))}
          {emotions.map((insight, index) => (
            <MarkdownText key={`reading-emotion-${index}`} variant="reading" style={[readingBody, { color: PRIMARY }]}>
              {insight}
            </MarkdownText>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const readingBody = { fontSize: 17, lineHeight: 28 };
const MODAL_BLOCK_COUNT = 1 + symbols.length + emotions.length;

function resetCounters() {
  nativeRenderer.mockClear();
  sanitize.mockClear();
  buildStyles.mockClear();
}

describe('MarkdownText parent rerender cost', () => {
  const originalPlatform = Platform.OS;

  beforeEach(() => {
    Platform.OS = 'ios';
    resetCounters();
  });

  afterEach(() => {
    Platform.OS = originalPlatform;
  });

  it('compares the effective typography of nested style arrays and applies later overrides', () => {
    const view = render(
      <MarkdownText style={[readingBody, [false, { color: PRIMARY }]]}>{transcript}</MarkdownText>
    );
    expect(nativeRenderer.mock.calls.at(-1)?.[0].markdownStyle?.paragraph).toMatchObject({
      fontSize: 17, lineHeight: 28, color: PRIMARY,
    });
    resetCounters();

    view.rerender(
      <MarkdownText style={{ ...readingBody, color: PRIMARY }}>{transcript}</MarkdownText>
    );
    expect(nativeRenderer).not.toHaveBeenCalled();

    view.rerender(
      <MarkdownText style={[readingBody, { color: PRIMARY }, [null, { color: SECONDARY }]]}>{transcript}</MarkdownText>
    );
    expect(nativeRenderer).toHaveBeenCalledTimes(1);
    expect(nativeRenderer.mock.calls.at(-1)?.[0].markdownStyle?.paragraph?.color).toBe(SECONDARY);
    expect(sanitize).not.toHaveBeenCalled();
  });

  it('measures dream-reading work when the screen rerenders without changing the text', () => {
    const view = render(<DreamReading tick={0} readingOpen={false} />);
    const initialNativeCalls = nativeRenderer.mock.calls.length;
    resetCounters();

    for (let index = 0; index < WARMUP_RENDERS; index += 1) {
      view.rerender(<DreamReading tick={index + 1} readingOpen={false} />);
    }
    resetCounters();

    const scrollStarted = performance.now();
    for (let index = 0; index < MEASURED_RENDERS; index += 1) {
      view.rerender(<DreamReading tick={WARMUP_RENDERS + index + 1} readingOpen={false} />);
    }
    const scrollMs = performance.now() - scrollStarted;
    const scrollNativeCalls = nativeRenderer.mock.calls.length;
    const scrollSanitizeCalls = sanitize.mock.calls.length;
    const scrollStyleBuilds = buildStyles.mock.calls.length;
    resetCounters();

    const openStarted = performance.now();
    view.rerender(<DreamReading tick={999} readingOpen />);
    const openMs = performance.now() - openStarted;

    const measurement = {
      blocks: BLOCK_COUNT,
      modalBlocks: MODAL_BLOCK_COUNT,
      measuredRenders: MEASURED_RENDERS,
      initialNativeCalls,
      scrollNativeCalls,
      scrollSanitizeCalls,
      scrollStyleBuilds,
      scrollMs: Number(scrollMs.toFixed(2)),
      scrollNativeCallsPerRender: Number((scrollNativeCalls / MEASURED_RENDERS).toFixed(2)),
      openNativeCalls: nativeRenderer.mock.calls.length,
      openSanitizeCalls: sanitize.mock.calls.length,
      openStyleBuilds: buildStyles.mock.calls.length,
      openMs: Number(openMs.toFixed(2)),
      repeatedDetailBlocksOnOpen: nativeRenderer.mock.calls.length - MODAL_BLOCK_COUNT,
    };

    expect(measurement).toMatchObject({
      initialNativeCalls: BLOCK_COUNT,
      scrollNativeCalls: 0,
      scrollSanitizeCalls: 0,
      scrollStyleBuilds: 0,
      openNativeCalls: MODAL_BLOCK_COUNT,
      openSanitizeCalls: MODAL_BLOCK_COUNT,
      openStyleBuilds: MODAL_BLOCK_COUNT,
      repeatedDetailBlocksOnOpen: 0,
    });

    const bodyBlocks = 1 + symbols.length + emotions.length + questions.length;
    resetCounters();
    view.rerender(<DreamReading tick={1000} readingOpen={false} bodyColor="#886644" />);
    expect(nativeRenderer).toHaveBeenCalledTimes(bodyBlocks);
    expect(buildStyles).toHaveBeenCalledTimes(bodyBlocks);
  });
});
