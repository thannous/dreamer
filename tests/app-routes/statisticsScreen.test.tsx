/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';
import type { DreamAnalysis } from '@/lib/types';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const mockPush = jest.fn();
const mockUseDreams = jest.fn();
const mockUseSubscription = jest.fn();

const buildDream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 1,
  transcript: 'Dream',
  title: 'Dream',
  interpretation: 'Analysis',
  shareableQuote: '',
  imageUrl: '',
  dreamType: 'Symbolic Dream',
  theme: 'calm',
  isAnalyzed: true,
  analysisStatus: 'done',
  analyzedAt: 1,
  chatHistory: [],
  ...overrides,
});

const profileDreams: DreamAnalysis[] = [
  buildDream({
    id: 3,
    memory: {
      origin: 'remembered',
      anchorDream: true,
      strongestFragment: 'place',
    },
  }),
  buildDream({ id: 2, memory: { origin: 'remembered', strongestFragment: 'place' } }),
  buildDream({ id: 1, memory: { strongestFragment: 'fear' } }),
];

jest.doMock('expo-router', () => ({
  router: { push: mockPush },
  useFocusEffect: () => {},
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
      numberOfLines,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      onScrollBeginDrag,
      onScrollEndDrag,
      showsVerticalScrollIndicator,
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
    InteractionManager: {
      runAfterInteractions: () => ({ cancel: jest.fn() }),
    },
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    Share: { share: jest.fn() },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    Text: createElement('span'),
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
    View: createElement('div'),
  };
});

jest.doMock('react-native-gifted-charts', () => ({
  PieChart: () => <div data-testid="pie-chart" />,
}));

jest.doMock('react-native-svg', () => ({
  Line: () => <span data-testid="svg-line" />,
  Rect: () => <span data-testid="svg-rect" />,
  Svg: ({ children }: { children?: React.ReactNode }) => <svg>{children}</svg>,
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

jest.doMock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => <div data-testid="atmospheric-background" />,
}));

jest.doMock('@/components/inspiration/GlassCard', () => ({
  StaticFlatGlassCard: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
    <div data-testid={testID}>{children}</div>
  ),
}));

jest.doMock('@/components/inspiration/PageHeader', () => ({
  PageHeader: ({ titleKey }: { titleKey: string }) => <div>{titleKey}</div>,
}));

jest.doMock('@/components/inspiration/SectionHeading', () => ({
  SectionHeading: ({ title }: { title: string }) => <div>{title}</div>,
}));

jest.doMock('@/components/NoctaliaScreenHeader', () => ({
  NoctaliaScreenHeader: ({ titleKey }: { titleKey: string }) => <div>{titleKey}</div>,
}));

jest.doMock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/components/dev/MockNavigationRail', () => ({
  MockNavigationRail: () => <div data-testid="mock-navigation-rail" />,
}));

jest.doMock('@/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="icon-symbol" />,
}));

jest.doMock('@/context/DreamsContext', () => ({
  useDreams: () => mockUseDreams(),
}));

jest.doMock('@/context/ScrollPerfContext', () => ({
  ScrollPerfProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
    colors: {
      accent: '#6f62b5',
      accentLight: '#b6a8ff',
      backgroundCard: '#221b3b',
      backgroundDark: '#0b0a12',
      backgroundSecondary: '#2f274f',
      divider: '#3a3357',
      textOnAccentSurface: '#fff',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#9a93b4',
      tags: {
        calm: '#8bd3c7',
        mystical: '#b6a8ff',
        noir: '#77819a',
        surreal: '#f0a868',
      },
    },
  }),
}));

jest.doMock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.doMock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatNumber: (value: number) => String(value),
    formatPercent: (value: number) => `${Math.round(value * 100)}%`,
  }),
}));

jest.doMock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onMomentumScrollBegin: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
    onScrollBeginDrag: jest.fn(),
    onScrollEndDrag: jest.fn(),
  }),
}));

jest.doMock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.doMock('@/constants/theme', () => ({
  Fonts: {
    fraunces: { bold: 'Fraunces-Bold', semiBold: 'Fraunces-SemiBold' },
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

const { default: StatisticsScreen } = require('@/app/(tabs)/statistics');

describe('Statistics screen dream profile Plus boundary', () => {
  it('[B] Given an unanalyzed anchor dream When viewing Stats Then the profile seed is visible', () => {
    mockUseDreams.mockReturnValue({
      dreams: [
        buildDream({
          id: 4,
          interpretation: '',
          isAnalyzed: false,
          analysisStatus: 'none',
          analyzedAt: undefined,
          memory: {
            origin: 'remembered',
            anchorDream: true,
            strongestFragment: 'place',
          },
        }),
      ],
      loaded: true,
    });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByTestId(TID.Component.DreamProfileCard)).toBeTruthy();
    expect(screen.queryByTestId(TID.Component.StatsInsight)).toBeNull();
    expect(screen.getByText('stats.profile.readiness.seeded.label')).toBeTruthy();
    expect(screen.getByText('stats.profile.next_action.capture_more.cta')).toBeTruthy();
    expect(screen.getByTestId(TID.Component.DreamProfilePlusPreview)).toBeTruthy();
  });

  it('[B] Given a free user When viewing Stats Then recurring profile signals are a Plus preview', () => {
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false });

    render(<StatisticsScreen />);

    expect(screen.getByTestId(TID.Component.DreamProfilePlusPreview)).toBeTruthy();
    expect(screen.getByText('stats.profile.plus_preview.title')).toBeTruthy();
    expect(screen.getAllByText('stats.profile.plus_preview.locked_value')).toHaveLength(4);
    expect(screen.queryByText('dream.type.symbolic')).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.DreamProfileUpgradeCta));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/paywall',
      params: { trigger: 'settings' },
    });
  });

  it('[B] Given a Plus user When viewing Stats Then recurring profile signals are visible', () => {
    mockUseDreams.mockReturnValue({ dreams: profileDreams, loaded: true });
    mockUseSubscription.mockReturnValue({ isActive: true, loading: false });

    render(<StatisticsScreen />);

    expect(screen.queryByTestId(TID.Component.DreamProfilePlusPreview)).toBeNull();
    expect(screen.getByText('dream.type.symbolic')).toBeTruthy();
    expect(screen.getByText('calm')).toBeTruthy();
    expect(screen.getByText('stats.profile.fragment.place')).toBeTruthy();
  });
});
