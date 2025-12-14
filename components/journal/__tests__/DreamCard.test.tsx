/* @vitest-environment happy-dom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { DreamCard } from '../DreamCard';
import { DreamAnalysis } from '@/lib/types';
import { vi, describe, it, expect } from 'vitest';

const flattenStyle = (style: any) => {
  if (Array.isArray(style)) {
    // recursively flatten
    return style.flat(Infinity).reduce((acc, val) => ({ ...acc, ...val }), {});
  }
  return style;
};

// Mocks
vi.mock('react-native', () => {
  return {
    View: ({ children, style, testID, accessibilityLabel }: any) => (
        <div data-testid={testID} style={flattenStyle(style)} aria-label={accessibilityLabel}>{children}</div>
    ),
    Text: ({ children, style, testID, numberOfLines }: any) => (
      <span data-testid={testID} style={flattenStyle(style)} data-lines={numberOfLines}>{children}</span>
    ),
    Pressable: ({ children, onPress, testID, style, accessibilityLabel }: any) => (
      <button data-testid={testID} onClick={onPress} style={flattenStyle(style)} aria-label={accessibilityLabel}>{children}</button>
    ),
    StyleSheet: { create: (styles: any) => styles },
    Platform: { OS: 'web' },
  };
});

vi.mock('react-native-reanimated', () => {
  const Animated = {
    View: ({ children, style, testID, accessibilityLabel }: any) => (
        <div data-testid={testID} style={flattenStyle(style)} aria-label={accessibilityLabel}>{children}</div>
    ),
    createAnimatedComponent: (component: any) => component,
  };
  return {
    default: Animated,
    useSharedValue: () => ({ value: 0 }),
    useAnimatedStyle: () => ({}),
    Easing: {
        linear: (t: number) => t,
        out: (t: number) => t,
        bezier: () => (t: number) => t,
    }
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: any) => <div data-testid={`icon-${name}`} />,
}));

vi.mock('@/hooks/useJournalAnimations', () => ({
  useScalePress: () => ({
    animatedStyle: {},
    onPressIn: vi.fn(),
    onPressOut: vi.fn(),
  }),
}));

// Mock both alias and relative path just to be sure
vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));
vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundCard: 'white',
      textPrimary: 'black',
      textSecondary: 'gray',
      accent: 'blue',
      textOnAccentSurface: 'white',
      backgroundSecondary: 'lightgray',
      tags: { surreal: 'purple' },
    },
  }),
}));

vi.mock('expo-image', () => ({
  Image: ({ source }: any) => <img src={source?.uri} alt="dream" />,
}));

vi.mock('expo-router', () => ({
  router: {
    push: vi.fn(),
  },
}));

vi.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    spacing: { md: 16 },
    borderRadius: { md: 8, full: 999 },
  },
  getTagColor: () => 'purple',
}));

vi.mock('@/lib/dreamLabels', () => ({
  getDreamThemeLabel: (theme: string) => theme,
}));

vi.mock('@/lib/imageUtils', () => ({
  getImageConfig: () => ({}),
  getThumbnailUrl: (url: string) => url,
}));

// Mock dream object
const mockDream: DreamAnalysis = {
  id: 1,
  transcript: 'Test dream',
  title: 'Test Title',
  interpretation: 'Test Interpretation',
  shareableQuote: 'Quote',
  imageUrl: 'http://example.com/image.jpg',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  theme: 'surreal',
  isFavorite: false,
};

describe('DreamCard', () => {
  it('renders correctly', () => {
    render(
      <DreamCard dream={mockDream} onPress={vi.fn()} />
    );

    expect(screen.getByText('Test Title')).toBeDefined();
    expect(screen.getByText('Test Interpretation')).toBeDefined();
  });

  it('renders analyzed badge when dream is analyzed', () => {
     const analyzedDream: DreamAnalysis = {
        ...mockDream,
        isAnalyzed: true,
        analyzedAt: 1234567890
     };
     render(<DreamCard dream={analyzedDream} onPress={vi.fn()} />);
     expect(screen.getByLabelText('journal.badge.analyzed')).toBeDefined();
  });

  it('renders explored badge when dream is explored', () => {
     const exploredDream: DreamAnalysis = {
        ...mockDream,
        explorationStartedAt: 1234567890
     };
     render(<DreamCard dream={exploredDream} onPress={vi.fn()} />);
     expect(screen.getByLabelText('journal.badge.explored')).toBeDefined();
  });

  it('renders favorite badge when dream is favorite', () => {
     const favoriteDream: DreamAnalysis = {
        ...mockDream,
        isFavorite: true
     };
     render(<DreamCard dream={favoriteDream} onPress={vi.fn()} />);
     expect(screen.getByLabelText('journal.badge.favorite')).toBeDefined();
  });
});
