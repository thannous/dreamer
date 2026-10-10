/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';

let mockMediaPending = false;
let mockTranscriptHeight = 0;
const mockIsMockModeEnabled = jest.fn(() => false);

jest.mock('@/hooks/useDreamMedia', () => ({ useDreamMedia: (dream: any) => ({ imageUrl: mockMediaPending ? undefined : dream.imageUrl, thumbnailUrl: mockMediaPending ? undefined : dream.thumbnailUrl, loading: mockMediaPending, error: false }) }));

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockIsMockModeEnabled(),
}));

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    Pressable: ({
      children,
      onPress,
      testID,
      accessibilityLabel,
      accessibilityState,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      testID?: string;
      accessibilityLabel?: string;
      accessibilityState?: { expanded?: boolean };
    }) => (
      <button data-testid={testID} onClick={onPress} aria-label={accessibilityLabel} aria-expanded={accessibilityState?.expanded}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
    Text: ({ children, testID, onLayout, numberOfLines }: { children?: React.ReactNode; testID?: string; onLayout?: (event: unknown) => void; numberOfLines?: number }) => {
      React.useLayoutEffect(() => {
        if (testID?.startsWith('journal.measure.')) onLayout?.({ nativeEvent: { layout: { height: mockTranscriptHeight } } });
      }, [onLayout, testID]);
      return <span data-testid={testID} data-visible-lines={numberOfLines}>{children}</span>;
    },
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

jest.mock('react-native-reanimated', () => {
  const Animated = {
    View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    createAnimatedComponent: (Component: any) => Component,
  };

  return {
    __esModule: true,
    default: Animated,
    // `PressableScale` (via `components/motion`) reads these at module scope.
    createAnimatedComponent: (Component: any) => Component,
    cubicBezier: (...points: number[]) => `cubic-bezier(${points.join(', ')})`,
    Easing: { bezier: () => (value: unknown) => value },
    useReducedMotion: () => false,
  };
});

jest.mock('expo-image', () => ({
  Image: ({ source, onError }: { source?: { uri?: string } | string; onError?: () => void }) => {
    const uri = typeof source === 'string' ? source : source?.uri;
    return <img data-testid="dream-image" data-src={uri} onError={onError} />;
  },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundCard: '#111',
      backgroundSecondary: '#222',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      textTertiary: '#666',
      accent: '#6b5a8e',
      accentText: '#c4b5fd',
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

jest.mock('@/hooks/useJournalAnimations', () => ({
  useScalePress: () => ({
    animatedStyle: {},
    onPressIn: () => {},
    onPressOut: () => {},
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      regular: 'SpaceGrotesk-Regular',
      medium: 'SpaceGrotesk-Medium',
    },
    lora: {
      bold: 'Lora-Bold',
    },
  },
  GlassCardTokens: {
    borderWidth: 1,
    getBackground: (backgroundCard: string) => backgroundCard,
  },
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <div data-testid="icon-symbol" />,
}));

describe('DreamCard image fallback', () => {
  afterEach(() => {
    cleanup();
    mockIsMockModeEnabled.mockReturnValue(false);
    mockTranscriptHeight = 0;
  });

  it('keeps using the full image after a thumbnail error and remount', async () => {
    const { DreamCard } = require('../DreamCard');
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

    const { unmount } = render(<DreamCard dream={dream} onPress={jest.fn()} />);

    expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBe(expectedThumbnail);

    fireEvent.error(screen.getByTestId('dream-image'));

    expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBe(expectedFull);

    unmount();
    render(<DreamCard dream={dream} onPress={jest.fn()} />);

    expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBe(expectedFull);
  });

  it('hides sync badges in mock mode because mock dreams are local only', () => {
    mockIsMockModeEnabled.mockReturnValue(true);
    const { DreamCard } = require('../DreamCard');
    const dream: DreamAnalysis = {
      id: 1458,
      transcript: 'dream transcript',
      title: 'Dream title',
      interpretation: 'Dream interpretation',
      shareableQuote: 'Dream quote',
      imageUrl: '',
      chatHistory: [],
      dreamType: 'Symbolic Dream',
      syncState: 'pending',
    };

    render(<DreamCard dream={dream} onPress={jest.fn()} />);

    expect(screen.queryByText('journal.badge.sync_pending')).toBeNull();
  });
});

it('unfolds short text that wraps past three lines and collapses a recycled dream', () => {
  const { DreamCard } = require('../DreamCard');
  // Native text layout/recycling are not exercised by the browser image-fallback journey.
  mockTranscriptHeight = 88;
  const dream: DreamAnalysis = { id: 1456, transcript: 'A blue door.\nA stair.\nA cloud.\nI wake.',
    title: 'First dream', dreamType: 'Symbolic Dream', interpretation: '', shareableQuote: '', imageUrl: '', chatHistory: [] };
  const props = { onPress: jest.fn(), testID: 'reading' };
  const { rerender } = render(<DreamCard {...props} dream={dream} />);
  const expand = screen.getByRole('button', { name: 'journal.card.expand' });
  fireEvent.click(expand);
  expect(screen.getByRole('button', { name: 'journal.card.collapse' }).getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByTestId('journal.preview.reading').getAttribute('data-visible-lines')).toBeNull();
  rerender(<DreamCard {...props} dream={{ ...dream, id: 1457, title: 'Second dream' }} />);
  expect(screen.getByRole('button', { name: 'journal.card.expand' }).getAttribute('aria-expanded')).toBe('false');
  expect(screen.getByTestId('journal.preview.reading').getAttribute('data-visible-lines')).toBe('3');
  mockTranscriptHeight = 0;
  cleanup();
});


it('keeps its image frame, title and navigation available while signing is pending', () => {
  const { DreamCard } = require('../DreamCard');
  mockMediaPending = true;
  const onPress = jest.fn();
  const dream = { id: 73, title: 'Readable immediately', transcript: 'Saved text', imageUrl: 'supabase-storage://dream-images/A/image', chatHistory: [] } as unknown as DreamAnalysis;
  const { rerender } = render(<DreamCard dream={dream} onPress={onPress} testID="pending-card" />);
  const frame = screen.getByTestId('dream-image').parentElement;
  expect(screen.getByText('Readable immediately')).toBeTruthy();
  expect(screen.getByTestId('dream-image').getAttribute('data-src')).toBeNull();
  fireEvent.click(screen.getByTestId('pending-card'));
  expect(onPress).toHaveBeenCalledWith(dream);
  mockMediaPending = false;
  rerender(<DreamCard dream={{ ...dream, imageUrl: 'https://signed/image' }} onPress={onPress} testID="pending-card" />);
  expect(screen.getByTestId('dream-image').parentElement).toBe(frame);
});
