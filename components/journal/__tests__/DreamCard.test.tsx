// @vitest-environment happy-dom
/* eslint-disable @typescript-eslint/no-require-imports */
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { DreamCard } from '../DreamCard';

// Mock dependencies
// Using relative paths to ensure mocks are applied despite tsconfig-paths issues
vi.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
  LanguageProvider: ({ children }: any) => children,
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundCard: '#fff',
      textPrimary: '#000',
      textSecondary: '#666',
      accent: 'blue',
      accentDark: 'darkblue',
      backgroundSecondary: '#eee',
      textOnAccentSurface: '#fff',
      tags: { surreal: 'purple', mystical: 'gold', calm: 'blue', noir: 'black' },
    },
    shadows: { xl: {}, md: {} },
    mode: 'light',
  }),
}));

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: any) => {
        if (key === 'journal.badge.explored') return 'Explored';
        if (key === 'journal.badge.analyzed') return 'Analyzed';
        if (key === 'journal.badge.favorite') return 'Favorite';
        if (key === 'journal.card.accessibility.open') return 'Open dream';
        if (key === 'journal.card.accessibility.hint') return 'Double tap to open dream details';
        if (key === 'journal.card.accessibility.theme') return `Theme: ${params?.theme || '{theme}'}`;
        if (key === 'journal.card.accessibility.snippet') return `Snippet: ${params?.text || '{text}'}`;
        return key;
    },
  }),
}));

vi.mock('../../../hooks/useJournalAnimations', () => ({
  useScalePress: () => ({
    animatedStyle: {},
    onPressIn: vi.fn(),
    onPressOut: vi.fn(),
  }),
}));

vi.mock('../../../lib/imageUtils', () => ({
  getDreamThumbnailUri: () => 'http://example.com/thumb.jpg',
  getImageConfig: () => ({ contentFit: 'cover' }),
}));

vi.mock('../../../lib/dreamLabels', () => ({
  getDreamThemeLabel: (theme: string) => theme,
}));

vi.mock('../../../lib/dreamUsage', () => ({
  isDreamAnalyzed: (d: any) => d.isAnalyzed,
  isDreamExplored: (d: any) => d.explorationStartedAt > 0,
}));

// Mock Image
vi.mock('expo-image', () => {
  const React = require('react');
  return {
    Image: ({ style, ...props }: any) => React.createElement('img', { ...props, style: Array.isArray(style) ? Object.assign({}, ...style) : style, 'data-testid': 'image' }),
  };
});

// Mock Ionicons
vi.mock('@expo/vector-icons', () => {
  const React = require('react');
  return {
    Ionicons: (props: any) => React.createElement('span', { 'data-testid': `icon-${props.name}` }),
  };
});

// Mock React Native Reanimated
vi.mock('react-native-reanimated', () => {
  const React = require('react');
  return {
    default: {
      createAnimatedComponent: (component: any) => component,
      View: ({ style, ...props }: any) => React.createElement('div', { ...props, style: Array.isArray(style) ? Object.assign({}, ...style) : style }),
    },
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    withSpring: () => 0,
    withTiming: () => 0,
    Easing: {
      linear: (t: number) => t,
      inOut: (t: number) => t,
      bezier: () => (t: number) => t,
    },
  };
});

// Mock React Native
vi.mock('react-native', () => {
  const React = require('react');

  const flattenStyle = (style: any) => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style);
    }
    return style;
  };

  const View = ({ style, ...props }: any) => React.createElement('div', { ...props, style: flattenStyle(style) });
  const Text = ({ style, ...props }: any) => React.createElement('span', { ...props, style: flattenStyle(style) });
  const Pressable = ({ style, accessibilityLabel, accessibilityHint, children, ...rest }: any) => {
    return React.createElement('button', {
      ...rest,
      style: flattenStyle(style),
      'aria-label': accessibilityLabel,
      'aria-roledescription': accessibilityHint,
    }, children);
  };
  const StyleSheet = { create: (obj: any) => obj, absoluteFillObject: {} };
  return {
    View,
    Text,
    Pressable,
    StyleSheet,
    Platform: { OS: 'web', select: (obj: any) => obj.web || obj.default },
    Animated: {
      View: ({ style, ...props }: any) => React.createElement('div', { ...props, style: flattenStyle(style) }),
      createAnimatedComponent: (c: any) => c,
    },
  };
});

describe('DreamCard', () => {
  const mockDream = {
    id: 1234567890,
    title: 'Test Dream',
    interpretation: 'This is a test interpretation.',
    transcript: 'I flew over the mountains.',
    theme: 'surreal',
    dreamType: 'Lucid Dream',
    isFavorite: true,
    isAnalyzed: true,
    explorationStartedAt: 12345,
    thumbnailUrl: 'http://example.com/img.jpg',
    imageUrl: 'http://example.com/full.jpg',
    chatHistory: [],
  };

  it('renders with comprehensive accessibility label', () => {
    render(<DreamCard dream={mockDream as any} onPress={vi.fn()} />);

    const button = screen.getByRole('button');
    const label = button.getAttribute('aria-label');
    const hint = button.getAttribute('aria-roledescription');

    // Assertions for the enhanced label
    expect(label).toContain('Test Dream');
    expect(label).toContain('surreal'); // Theme
    expect(label).toContain('Explored'); // Badge
    // Analyzed is not shown if Explored is true
    expect(label).not.toContain('Analyzed');
    expect(label).toContain('Favorite'); // Badge
    expect(label).toContain('This is a test interpretation'); // Snippet

    expect(hint).toBeDefined();
    expect(hint).toContain('Double tap to open');
  });
});
