/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getDreamThumbnailUri } from '@/lib/imageUtils';
import { thumbnailFailures } from '@/lib/thumbnailFailureCache';
import type { DreamAnalysis } from '@/lib/types';

// Like the real hook in thumbnail mode: the original resolves only once a row asks for it.
const mockLoadOriginal = jest.fn();
let mockOriginalUrl = '';
let mockThumbnailUrl = '';
jest.mock('@/hooks/useDreamMedia', () => ({
  useDreamMedia: () => ({
    accessScope: null,
    imageUrl: mockOriginalUrl,
    thumbnailUrl: mockThumbnailUrl,
    loadOriginal: mockLoadOriginal,
    loading: false,
    error: false,
  }),
}));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => true }));
jest.mock('react-native', () => ({
  Pressable: ({ children, onPress, testID }: any) => <button data-testid={testID} onClick={onPress}>{children}</button>,
  Text: ({ children, testID }: any) => <span data-testid={testID}>{children}</span>,
  View: ({ children, testID }: any) => <div data-testid={testID}>{children}</div>,
}));
jest.mock('expo-image', () => ({
  Image: ({ source, onError }: any) => <img data-testid="compact-image" data-src={source?.uri} onError={onError} />,
}));
jest.mock('@/components/motion', () => ({
  PressableScale: ({ children, onPress, testID }: any) => <button data-testid={testID} onClick={onPress}>{children}</button>,
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: ({ name }: any) => <i data-testid={`icon-${name}`} /> }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ mode: 'dark', colors: {} }) }));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { soft: '#fff', text: '#fff' },
    text: { secondary: '#aaa' },
    status: { warning: { text: '#f80' }, danger: { text: '#f00' } },
  }),
}));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/lib/journalCardPictures', () => ({ getCardPictureKey: () => 'key', rememberCardPicture: () => {} }));

const { JournalCompactRow } = require('../JournalCompactRow') as typeof import('../JournalCompactRow');

const THUMB = 'https://cdn.example/dream-thumb.webp';
const ORIGINAL = 'https://cdn.example/dream.webp';
const dream = {
  id: 1_700_000_000_000,
  title: 'Blue room',
  transcript: 'A blue room',
  interpretation: '',
  shareableQuote: '',
  imageUrl: ORIGINAL,
  thumbnailUrl: THUMB,
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: true,
  analyzedAt: 1,
} as unknown as DreamAnalysis;

function row() {
  return <JournalCompactRow dream={dream} dateLabel="14 nov." onPress={() => {}} testID="row" />;
}
const shownSource = () => screen.queryByTestId('compact-image')?.getAttribute('data-src') ?? null;

describe('JournalCompactRow painting fallback', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    thumbnailFailures.clear();
    thumbnailFailures.setScope(null);
    mockLoadOriginal.mockClear();
    mockOriginalUrl = '';
    mockThumbnailUrl = THUMB;
  });
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  // A thumbnail that failed in another row (or before the list remounted) must not leave this
  // one on the moon: the row asks for the original it has not resolved.
  it('asks for the original when it mounts after the thumbnail failed elsewhere', () => {
    // The row keys failures by the thumbnail it shows, cache version included.
    thumbnailFailures.record(null, getDreamThumbnailUri({ ...dream, thumbnailUrl: THUMB, imageUrl: '' })!.trim());
    const { rerender } = render(row());
    expect(mockLoadOriginal).toHaveBeenCalled();

    mockOriginalUrl = ORIGINAL;
    rerender(row());
    expect(shownSource()).toContain(ORIGINAL);
  });

  it('falls back to the original, then retries a link that failed once it is refreshed', () => {
    const { rerender } = render(row());
    expect(shownSource()).toContain(THUMB);
    fireEvent.error(screen.getByTestId('compact-image'));
    expect(mockLoadOriginal).toHaveBeenCalled();

    mockOriginalUrl = ORIGINAL;
    rerender(row());
    fireEvent.error(screen.getByTestId('compact-image'));
    expect(shownSource()).toBeNull();
    expect(screen.getByTestId('icon-moon.stars.fill')).toBeTruthy();

    // A refreshed signed link is a new source: it loads instead of keeping the moon.
    mockOriginalUrl = `${ORIGINAL}?token=2`;
    rerender(row());
    expect(shownSource()).toContain('token=2');
  });

  it('tries the thumbnail again once the failure cache forgets it', () => {
    render(row());
    fireEvent.error(screen.getByTestId('compact-image'));
    expect(shownSource() ?? '').not.toContain(THUMB);

    act(() => { jest.advanceTimersByTime(thumbnailFailures.ttlMs); });
    expect(shownSource()).toContain(THUMB);
  });
});
