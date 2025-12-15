// @vitest-environment happy-dom
import { render, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { DreamCard } from './DreamCard';
import { DreamAnalysis } from '../../lib/types';
import { vi, describe, it, expect, afterEach } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock hooks
vi.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      backgroundCard: 'white',
      textPrimary: 'black',
      textSecondary: 'gray',
      accent: 'blue',
      textOnAccentSurface: 'white',
      backgroundSecondary: 'lightgray',
    },
  }),
}));

vi.mock('../../hooks/useJournalAnimations', () => ({
  useScalePress: () => ({
    animatedStyle: {},
    onPressIn: vi.fn(),
    onPressOut: vi.fn(),
  }),
}));

vi.mock('../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock icons
vi.mock('@expo/vector-icons', () => ({
  Ionicons: (props: any) => <div data-testid={`icon-${props.name}`} />,
}));

// Mock helpers
vi.mock('../../lib/dreamLabels', () => ({
  getDreamThemeLabel: (theme: string) => theme,
}));

vi.mock('../../lib/dreamUsage', () => ({
  isDreamAnalyzed: (dream: any) => dream.isAnalyzed,
  isDreamExplored: (dream: any) => dream.isExplored,
}));

vi.mock('../../lib/imageUtils', () => ({
  getImageConfig: () => ({}),
  getThumbnailUrl: () => 'thumb',
}));

// Mock Animated and Pressable
vi.mock('react-native', async () => {
  return {
    StyleSheet: { create: (obj: any) => obj, absoluteFillObject: {} },
    View: ({ style, ...props }: any) => <div {...props} />,
    Text: ({ style, ...props }: any) => <div {...props} />,
    Pressable: ({ style, onPress, ...props }: any) => <button onClick={onPress} {...props} />,
    Platform: { OS: 'web' },
  };
});

vi.mock('react-native-reanimated', () => ({
  default: {
    createAnimatedComponent: (Comp: any) => Comp,
    View: ({ style, ...props }: any) => <div {...props} />,
  },
}));

vi.mock('expo-image', () => ({
  Image: (props: any) => <img src={props.source.uri} {...props} />,
}));

describe('DreamCard', () => {
  const mockDream: DreamAnalysis = {
    id: 123,
    title: 'Test Dream',
    transcript: 'Some content',
    date: '2023-01-01',
    isAnalyzed: false,
    isExplored: false,
    isFavorite: false,
  } as any;

  it('renders explored badge icon correctly', () => {
    const { getByTestId } = render(
      <DreamCard
        dream={{ ...mockDream, isExplored: true }}
        onPress={vi.fn()}
      />
    );
    expect(getByTestId('icon-chatbubble-ellipses-outline')).toBeTruthy();
  });

  it('renders analyzed badge icon when analyzed but not explored', () => {
    const { getByTestId, queryByTestId } = render(
      <DreamCard
        dream={{ ...mockDream, isAnalyzed: true, isExplored: false }}
        onPress={vi.fn()}
      />
    );
    expect(getByTestId('icon-sparkles')).toBeTruthy();
    expect(queryByTestId('icon-chatbubble-ellipses-outline')).toBeNull();
  });

  it('calls onPress with id', () => {
    const onPress = vi.fn();
    const { getByRole } = render(
      <DreamCard
        dream={mockDream}
        onPress={onPress}
      />
    );

    fireEvent.click(getByRole('button'));
    expect(onPress).toHaveBeenCalledWith(123);
  });
});
