import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Linking, Platform } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { MarkdownText } from '../MarkdownText';

jest.mock('react-native-enriched-markdown', () => {
  const mock = require('react-native-enriched-markdown/jest');
  return { ...mock, EnrichedMarkdownText: jest.fn(mock.EnrichedMarkdownText) };
});
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {
  accent: '#d4a574', accentLight: '#f0dbbf', accentDark: '#805026', textOnAccentSurface: '#24160b', accentText: '#9a6332', backgroundSecondary: '#222222', backgroundCard: '#111111',
  divider: '#444444', textPrimary: '#ffffff', textSecondary: '#cccccc',
} }) }));

const latestProps = () => jest.mocked(EnrichedMarkdownText).mock.calls.at(-1)![0];
const originalPlatform = Platform.OS;
beforeEach(() => jest.mocked(EnrichedMarkdownText).mockClear());
afterEach(() => { Platform.OS = originalPlatform; });

it.each(['ios', 'android'] as const)('passes Markdown to the %s GFM renderer and preserves the caller typography', (platform) => {
  Platform.OS = platform;
  const source = '# Titre\n\n**Gras** et *italique*\n\n- Premier\n- Second\n\n| A | B |\n|---|---|\n| 1 | 2 |';
  render(<MarkdownText variant="reading" style={{ fontSize: 17, lineHeight: 28, color: '#fff9ef' }}>{source}</MarkdownText>);
  expect(latestProps().markdown).toBe(source);
  expect(latestProps().flavor).toBe('github');
  expect(latestProps().markdownStyle?.paragraph).toMatchObject({ fontSize: 17, lineHeight: 28, color: '#fff9ef' });
  expect(latestProps().allowFontScaling).toBe(true);
  expect(latestProps().selectable).toBe(true);
  expect(latestProps().enableLinkPreview).toBe(false);
  expect(latestProps().enableTaskListItemToggle).toBe(false);
  expect(latestProps().spoilerOverlay).toBe('solid');
  expect(latestProps().selectionMenuConfig).toEqual({
    copy: { label: 'common.copy' },
    copyAsMarkdown: { enabled: false },
    copyImageUrl: { enabled: false },
  });
});

it('keeps native-only options out of the web renderer DOM passthrough', () => {
  Platform.OS = 'web';
  const source = '**Gras** et [lien](https://example.com)';
  render(<MarkdownText selectable={false}>{source}</MarkdownText>);
  expect(latestProps()).toMatchObject({
    markdown: source,
    selectable: false,
    enableTaskListItemToggle: false,
    md4cFlags: { latexMath: false },
    onLinkPress: expect.any(Function),
  });
  for (const prop of ['flavor', 'allowFontScaling', 'enableLinkPreview', 'spoilerOverlay', 'selectionMenuConfig']) {
    expect(latestProps()).not.toHaveProperty(prop);
  }
});

it('repairs unfinished formatting only during streaming without replacing the source', () => {
  const source = '**Une porte';
  const view = render(<MarkdownText isStreaming>{source}</MarkdownText>);
  expect(latestProps().markdown).toBe('**Une porte**');
  view.rerender(<MarkdownText>{source}</MarkdownText>);
  expect(latestProps().markdown).toBe(source);
});

it('keeps unsafe URLs out of navigation and follows safe links', async () => {
  const canOpen = jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true);
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  render(<MarkdownText>{'[Site](https://example.com)'}</MarkdownText>);
  await act(async () => { latestProps().onLinkPress?.({ url: 'javascript:alert(1)' }); });
  expect(canOpen).not.toHaveBeenCalled();
  await act(async () => { latestProps().onLinkPress?.({ url: 'https://example.com' }); });
  expect(open).toHaveBeenCalledWith('https://example.com');
  canOpen.mockRestore(); open.mockRestore();
});

it('keeps oversized messages readable without invoking the native parser', () => {
  const source = 'a'.repeat(50_001);
  const view = render(<MarkdownText>{source}</MarkdownText>);
  expect(view.getByText(source)).toBeTruthy();
  expect(EnrichedMarkdownText).not.toHaveBeenCalled();
});

it('keeps links and formatted blocks readable on a user message accent surface', () => {
  render(<MarkdownText tone="onAccent" style={{ color: '#24160b' }}>{'[Lien](https://example.com)'}</MarkdownText>);
  expect(latestProps().markdownStyle?.link?.color).toBe('#24160b');
  expect(latestProps().markdownStyle?.codeBlock).toMatchObject({ color: '#24160b', backgroundColor: '#f0dbbf' });
});
