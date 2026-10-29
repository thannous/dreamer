/* @jest-environment jsdom */
import React from 'react';
import { Platform } from 'react-native';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { BookProse } from '@/components/journal/JournalBook';

// Native selection and the Markdown renderer are outside the web e2e journey: its stories
// are plain prose, read in a browser. These cases cover a story copied on a phone and a
// story written with Markdown.

jest.mock('react-native', () => {
  const React = require('react');
  const Platform = { OS: 'ios', select: (options: Record<string, unknown>) => options[Platform.OS] ?? options.default };
  const host = (tag: string) => function MockHost({ children, selectable }: { children?: React.ReactNode; selectable?: boolean }) {
    return React.createElement(tag, selectable ? { 'data-selectable': 'true' } : null, children);
  };
  return {
    Platform,
    Text: host('span'),
    View: host('div'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
  };
});
jest.mock('react-native-svg', () => ({ __esModule: true, default: () => null, Path: () => null }));
jest.mock('@/components/ui/MarkdownText', () => ({
  MarkdownText: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'light' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({ text: { primary: '#1c1a24' }, accent: { text: '#7a3f1d' } }),
}));

afterEach(() => {
  cleanup();
  Platform.OS = 'ios';
});

describe('BookProse', () => {
  it.each([
    ['ios', '« I was running through dark corridors.\n\nThen a door opened.'],
    ['android', '« I was running through dark corridors.\n\nThen a door opened.'],
    ['web', '« I was running through dark corridors.\n\nThen a door opened.'],
    ['ios', 'J’étais dans la maison de ma grand-mère.'],
  ])('keeps every letter of a plain story in its selectable text on %s', (os: string, story: string) => {
    Platform.OS = os as typeof Platform.OS;
    const { container } = render(<BookProse text={story} />);

    expect(screen.queryByTestId('markdown')).toBeNull();
    const selectable = container.querySelectorAll('[data-selectable="true"]');
    expect(selectable).toHaveLength(1);
    expect(selectable[0].textContent).toBe(story);
  });

  it.each([
    ['a reference link', 'See [the map][map].\n\n[map]: https://example.com'],
    ['a bare link', 'I read www.example.com in the dream.'],
    ['a table', 'Who | Where\n--- | ---\nme | the sea'],
    ['a thematic break', 'First part.\n\n***\n\nSecond part.'],
    ['an indented code block', 'Before.\n\n    a line of code'],
    ['an escaped character', 'A star \\* fell.'],
    ['a character reference', 'Salt &amp; pepper.'],
    ['a rare named reference', 'A caf&eacute; by the sea.'],
    ['a numeric reference', 'A caf&#233; by the sea.'],
  ])('sets a story with %s through the Markdown renderer', (_: string, story: string) => {
    render(<BookProse text={story} />);

    expect(screen.getByTestId('markdown').textContent).toBe(story);
  });
});
