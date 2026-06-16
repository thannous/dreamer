/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn();

jest.mock('expo-router', () => ({
  router: { push: mockPush, back: mockBack },
  useLocalSearchParams: mockUseLocalSearchParams,
}));

jest.mock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      hitSlop,
      contentContainerStyle,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      numberOfLines,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    Text: createElement('span'),
    View: createElement('div'),
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      flatten: (style: any) => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style),
      hairlineWidth: 1,
    },
  };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textOnAccentSurface: '#fff',
    },
    shadows: { xl: {}, lg: {}, md: {}, sm: {} },
  }),
}));

const mockUseDreams = jest.fn();
jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => mockUseDreams(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: function MockFlatGlassCard({
    children,
    testID,
  }: {
    children?: React.ReactNode;
    testID?: string;
  }) {
    return <div data-testid={testID}>{children}</div>;
  },
  GlassCard: function MockGlassCard({
    children,
    onPress,
    testID,
  }: {
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return (
      <button data-testid={testID} onClick={onPress}>
        {children}
      </button>
    );
  },
}));

jest.mock('@/components/inspiration/PageHeader', () => ({
  PageHeaderContent: () => <div data-testid="page-header" />,
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    fraunces: {
      medium: 'Fraunces-Medium',
      semiBold: 'Fraunces-SemiBold',
    },
    spaceGrotesk: {
      regular: 'SpaceGrotesk-Regular',
      medium: 'SpaceGrotesk-Medium',
    },
    lora: {
      bold: 'Lora-Bold',
    },
  },
}));

jest.mock('@/lib/moti', () => ({
  MotiView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MotiText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

const { default: DreamCategoriesScreen } = require('@/app/dream-categories/[id]');

describe('Dream categories screen', () => {
  it('[B] Given a dream When pressing a category Then it navigates to the chat route', () => {
    // Given
    mockUseLocalSearchParams.mockReturnValue({ id: '123' });
    mockUseDreams.mockReturnValue({
      dreams: [{ id: 123, title: 'A dream', chatHistory: [] }],
    });

    // When
    render(<DreamCategoriesScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.DreamCategory('symbols')));

    // Then
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/dream-chat/[id]',
      params: { id: '123', category: 'symbols' },
    });
  });

  it('[B] Given a fully explored dream When pressing synthesis Then it opens the synthesis chat route', () => {
    // Given
    mockUseLocalSearchParams.mockReturnValue({ id: '123' });
    mockUseDreams.mockReturnValue({
      dreams: [
        {
          id: 123,
          title: 'A dream',
          chatHistory: [
            { id: 'u1', role: 'user', text: 'symbols', meta: { category: 'symbols' } },
            { id: 'm1', role: 'model', text: 'Symbol reply' },
            { id: 'u2', role: 'user', text: 'emotions', meta: { category: 'emotions' } },
            { id: 'm2', role: 'model', text: 'Emotion reply' },
            { id: 'u3', role: 'user', text: 'growth', meta: { category: 'growth' } },
            { id: 'm3', role: 'model', text: 'Growth reply' },
          ],
        },
      ],
    });

    // When
    render(<DreamCategoriesScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.Exploration360Synthesis));

    // Then
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/dream-chat/[id]',
      params: { id: '123', mode: 'synthesis' },
    });
  });

  it('[S] Given a new dream When rendering Then it shows 360 progress without synthesis CTA', () => {
    // Given
    mockUseLocalSearchParams.mockReturnValue({ id: '123' });
    mockUseDreams.mockReturnValue({
      dreams: [{ id: 123, title: 'A dream', chatHistory: [] }],
    });

    // When
    render(<DreamCategoriesScreen />);

    // Then
    expect(screen.getByTestId(TID.Component.Exploration360Panel)).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.Exploration360Synthesis)).toBeNull();
  });

  it('[E] Given an unknown dream id When rendering Then it shows a not-found message', () => {
    // Given
    mockUseLocalSearchParams.mockReturnValue({ id: '999' });
    mockUseDreams.mockReturnValue({ dreams: [] });

    // When
    render(<DreamCategoriesScreen />);

    // Then
    expect(screen.getByText('dream_categories.not_found.title')).toBeTruthy();
  });
});
