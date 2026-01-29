/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';

vi.mock('react-native-reanimated', async () => {
  const React = await import('react');
  const Animated = {
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    createAnimatedComponent: (Component: any) => Component,
  };

  return {
    __esModule: true,
    default: Animated,
  };
});

vi.mock('expo-image', () => ({
  Image: ({ source, onError }: { source?: { uri?: string } | string; onError?: () => void }) => {
    const uri = typeof source === 'string' ? source : source?.uri;
    return <img data-testid="dream-image" data-src={uri} onError={onError} />;
  },
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundCard: '#111',
      backgroundSecondary: '#222',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      textTertiary: '#666',
      accent: '#6b5a8e',
      textOnAccentSurface: '#fff',
      tags: {
        surreal: '#6b5a8e',
        mystical: '#5d4b7a',
        calm: '#4a6fa5',
        noir: '#3d3d5c',
      },
    },
    shadows: { sm: {}, md: {}, lg: {}, xl: {} },
  }),
}));

vi.mock('@/hooks/useJournalAnimations', () => ({
  useScalePress: () => ({
    animatedStyle: {},
    onPressIn: () => {},
    onPressOut: () => {},
  }),
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DreamCard image fallback', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps using the full image after a thumbnail error and remount', async () => {
    const { DreamCard } = await import('../DreamCard');
    const dream: DreamAnalysis = {
      id: 1456,
      transcript: 'dream transcript',
      title: 'Dream title',
      interpretation: 'Dream interpretation',
      shareableQuote: 'Dream quote',
      imageUrl: 'https://example.com/full.jpg',
      thumbnailUrl: 'https://example.com/thumb.jpg',
      chatHistory: [],
      dreamType: 'Symbolic Dream',
    };
    const version = getDreamImageVersion(dream);
    const expectedThumbnail = withCacheBuster(dream.thumbnailUrl!, version);
    const expectedFull = withCacheBuster(dream.imageUrl, version);

    const { unmount } = render(<DreamCard dream={dream} onPress={vi.fn()} />);

    expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBe(expectedThumbnail);

    fireEvent.error(screen.getByTestId('dream-image'));

    expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBe(expectedFull);

    unmount();
    render(<DreamCard dream={dream} onPress={vi.fn()} />);

    expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBe(expectedFull);
  });
});
