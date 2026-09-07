/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';

let mockMediaPending = false;
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
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
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

  it('renders state badge labels with their icons for scanability', () => {
    const { DreamCard } = require('../DreamCard');
    const dream: DreamAnalysis = {
      id: 1457,
      transcript: 'dream transcript',
      title: 'Dream title',
      interpretation: 'Dream interpretation',
      shareableQuote: 'Dream quote',
      imageUrl: '',
      chatHistory: [],
      dreamType: 'Symbolic Dream',
      isAnalyzed: true,
      analysisStatus: 'done',
      analyzedAt: Date.now(),
    };

    render(<DreamCard dream={dream} onPress={jest.fn()} />);

    expect(screen.getByText('journal.badge.analyzed')).toBeTruthy();
  });

  it('renders a memory badge for remembered dreams', () => {
    const { DreamCard } = require('../DreamCard');
    const dream: DreamAnalysis = {
      id: 1459,
      transcript: 'dream transcript',
      title: 'Dream title',
      interpretation: 'Dream interpretation',
      shareableQuote: 'Dream quote',
      imageUrl: '',
      chatHistory: [],
      dreamType: 'Symbolic Dream',
      memory: {
        approximatePeriod: 'childhood',
        strongestFragment: 'person',
      },
    };

    render(<DreamCard dream={dream} onPress={jest.fn()} />);

    expect(screen.getByText('recording.activation_insight.signal.memory')).toBeTruthy();
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
  expect(onPress).toHaveBeenCalledWith(73);
  mockMediaPending = false;
  rerender(<DreamCard dream={{ ...dream, imageUrl: 'https://signed/image' }} onPress={onPress} testID="pending-card" />);
  expect(screen.getByTestId('dream-image').parentElement).toBe(frame);
});
