import React from 'react';
import { View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native-legacy';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { JournalCompactRow } from '@/components/journal/JournalCompactRow';
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
// The painting is a native view: a host view keeps its source and error callback inspectable.
jest.mock('expo-image', () => {
  const { View: MockView } = require('react-native');
  return { Image: (props: any) => <MockView testID="compact-image" {...props} /> };
});
jest.mock('@/components/ui/icon-symbol', () => {
  const { View: MockView } = require('react-native');
  return { IconSymbol: ({ name }: { name: string }) => <MockView testID={`icon-${name}`} /> };
});
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
  isFavorite: false,
} as unknown as DreamAnalysis;

const shownSource = () => {
  const image = screen.queryByTestId('compact-image');
  return image ? (image.props.source?.uri as string) : null;
};

describe('JournalCompactRow', () => {
  const onPress = jest.fn();
  const onToggleFavorite = jest.fn();
  // The mocked media hook holds no state: a fresh copy of the dream re-renders the memoised row,
  // as the real hook does when its links resolve.
  const row = (sectionLabel?: string) => (
    <View>
      <JournalCompactRow dream={{ ...dream }} dateLabel="14 nov." sectionLabel={sectionLabel} onPress={onPress}
        onToggleFavorite={onToggleFavorite} testID="row" />
    </View>
  );

  beforeEach(() => {
    jest.useFakeTimers();
    thumbnailFailures.clear();
    thumbnailFailures.setScope(null);
    mockLoadOriginal.mockClear();
    onPress.mockClear();
    onToggleFavorite.mockClear();
    mockOriginalUrl = '';
    mockThumbnailUrl = THUMB;
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens the dream and toggles the favourite from two separate buttons, each named', () => {
    render(row('November 2023'));

    expect(screen.getByRole('header', { name: 'November 2023' })).toBeTruthy();
    const open = screen.getByRole('button', { name: /^Blue room, 14 nov\./ });
    const favorite = screen.getByRole('button', { name: 'journal.badge.favorite' });
    expect(favorite.props.accessibilityState).toEqual({ selected: false });

    fireEvent.press(favorite);
    expect(onToggleFavorite).toHaveBeenCalledWith(dream);
    expect(onPress).not.toHaveBeenCalled();

    fireEvent.press(open);
    expect(onPress).toHaveBeenCalledWith(dream);
  });

  // A thumbnail that failed in another row (or before the list remounted) must not leave this
  // one on the moon: the row asks for the original it has not resolved.
  it('asks for the original when it mounts after the thumbnail failed elsewhere', () => {
    // The row keys failures by the thumbnail it shows, cache version included.
    thumbnailFailures.record(null, getDreamThumbnailUri({ ...dream, thumbnailUrl: THUMB, imageUrl: '' })!.trim());
    const view = render(row());
    expect(mockLoadOriginal).toHaveBeenCalled();

    mockOriginalUrl = ORIGINAL;
    view.rerender(row());
    expect(shownSource()).toContain(ORIGINAL);
  });

  it('falls back to the original, then retries a link that failed once it is refreshed', () => {
    const view = render(row());
    expect(shownSource()).toContain(THUMB);
    fireEvent(screen.getByTestId('compact-image'), 'error');
    expect(mockLoadOriginal).toHaveBeenCalled();

    mockOriginalUrl = ORIGINAL;
    view.rerender(row());
    fireEvent(screen.getByTestId('compact-image'), 'error');
    expect(shownSource()).toBeNull();
    expect(screen.getByTestId('icon-moon.stars.fill')).toBeTruthy();

    // A refreshed signed link is a new source: it loads instead of keeping the moon.
    mockOriginalUrl = `${ORIGINAL}?token=2`;
    view.rerender(row());
    expect(shownSource()).toContain('token=2');
  });

  it('tries the thumbnail again once the failure cache forgets it', () => {
    render(row());
    fireEvent(screen.getByTestId('compact-image'), 'error');
    expect(shownSource() ?? '').not.toContain(THUMB);

    act(() => { jest.advanceTimersByTime(thumbnailFailures.ttlMs); });
    expect(shownSource()).toContain(THUMB);
  });
});
