/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getDreamImageVersion, withCacheBuster } from '@/lib/imageUtils';
import type { DreamAnalysis } from '@/lib/types';

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
});
