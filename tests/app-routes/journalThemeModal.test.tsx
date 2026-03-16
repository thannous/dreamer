/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  cleanup();
});

jest.doMock('@/context/DreamsContext', () => ({
  useDreams: () => ({ dreams: [] }),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#6f62b5',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      overlay: 'rgba(0, 0, 0, 0.5)',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      timeline: '#3a3357',
    },
    shadows: { xl: {}, lg: {}, md: {}, sm: {} },
  }),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.doMock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.doMock('@/hooks/useJournalAnimations', () => ({
  useModalSlide: () => ({ backdropStyle: {}, contentStyle: {} }),
}));

jest.doMock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatShortDate: () => '2024-01-01',
  }),
}));

jest.doMock('@/constants/theme', () => ({
  Fonts: {
    fraunces: { semiBold: 'Fraunces-SemiBold', medium: 'Fraunces-Medium' },
    spaceGrotesk: {
      regular: 'SpaceGrotesk-Regular',
      medium: 'SpaceGrotesk-Medium',
      bold: 'SpaceGrotesk-Bold',
    },
  },
}));

jest.doMock('@/lib/moti', () => ({
  MotiView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MotiText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

jest.doMock('@/lib/accessibility', () => ({
  blurActiveElement: () => {},
}));

jest.doMock('@/lib/dreamFilters', () => ({
  applyFilters: (dreams: any[]) => dreams,
  getUniqueThemes: () => ['mystical'],
  getUniqueDreamTypes: () => [],
  sortDreamsByDate: (dreams: any[]) => dreams,
}));

jest.doMock('@/lib/dreamLabels', () => ({
  getDreamThemeLabel: () => 'Mystique',
  getDreamTypeLabel: (dreamType: string) => dreamType,
}));

jest.doMock('@/lib/dreamUsage', () => ({
  isDreamAnalyzed: () => false,
}));

jest.doMock('@/lib/imageUtils', () => ({
  getDreamThumbnailUri: () => null,
  preloadImage: () => Promise.resolve(),
}));

jest.doMock('@/components/journal/FilterBar', () => ({
  FilterBar: function MockFilterBar({
    items,
  }: {
    items: { id: string; onPress: () => void }[];
  }) {
    const themeItem = items.find((item) => item.id === 'theme');
    return (
      <button data-testid="open-theme-modal" onClick={themeItem?.onPress}>
        Open theme modal
      </button>
    );
  },
}));

jest.doMock('@/components/ui/SearchBar', () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

jest.doMock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => <div data-testid="atmospheric-background" />,
}));

jest.doMock('@/components/inspiration/PageHeader', () => ({
  PageHeaderContent: () => <div data-testid="page-header-content" />,
}));

jest.doMock('@/components/journal/DateRangePicker', () => ({
  DateRangePicker: () => <div />,
}));

jest.doMock('@/components/journal/DreamCard', () => ({
  DreamCard: () => <div />,
}));

jest.doMock('@/components/journal/TimelineIndicator', () => ({
  TimelineIndicator: () => <div />,
}));

jest.doMock('@/components/guest/UpsellCard', () => ({
  UpsellCard: () => <div />,
}));

jest.doMock('@/components/ui/FloatingAddDreamButton', () => ({
  FloatingAddDreamButton: () => <div data-testid="add-dream-button" />,
}));

jest.doMock('@/components/icons/DreamIcons', () => ({
  DreamIcon: () => <div />,
}));

jest.doMock('@shopify/flash-list', () => ({
  FlashList: () => null,
}));

jest.doMock('expo-router', () => ({
  router: { push: jest.fn() },
  useFocusEffect: () => {},
  useNavigation: () => ({ setOptions: jest.fn() }),
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
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
    ScrollView: createElement('div'),
    Pressable: createElement('button'),
    Text: createElement('span'),
    View: createElement('div'),
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  };
});

jest.doMock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

jest.doMock('@/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, visible, testID }: { children: React.ReactNode; visible: boolean; testID?: string }) => (
    visible ? <div data-testid={testID}>{children}</div> : null
  ),
}));

jest.doMock('@/components/journal/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

jest.doMock('react-native-reanimated', () => {
  const View = function MockReanimatedView({
    children,
    style,
    entering,
    ...props
  }: {
    children?: React.ReactNode;
    style?: any;
    entering?: any;
    [key: string]: any;
  }) {
    return <div {...props}>{children}</div>;
  };
  const createAnimatedComponent = (Component: any) => {
    const AnimatedComponent = function MockAnimatedComponent({
      style,
      entering,
      ...props
    }: any) {
      return <Component {...props} />;
    };
    AnimatedComponent.displayName = 'ReanimatedAnimatedComponent';
    return AnimatedComponent;
  };
  const springifyChain = { damping: () => springifyChain };
  const enteringChain = {
    delay: () => enteringChain,
    duration: () => enteringChain,
    springify: () => springifyChain,
  };
  return {
    default: {
      View,
      createAnimatedComponent,
    },
    FadeInDown: enteringChain,
    SlideInDown: { springify: () => ({ damping: () => ({}) }) },
    useAnimatedStyle: () => ({}),
    useSharedValue: (val: any) => ({ value: val }),
    withTiming: (val: any) => val,
    withSpring: (val: any) => val,
    withDelay: (_d: number, val: any) => val,
    interpolate: () => 1,
    Extrapolation: { CLAMP: 'clamp' },
    runOnJS: (fn: any) => fn,
    cancelAnimation: () => {},
    Easing: { out: () => {}, in: () => {}, cubic: {} },
  };
});

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const { default: JournalListScreen } = require('@/app/(tabs)/journal');

describe('Journal theme modal', () => {
  it('shows a checkmark for the selected theme', () => {
    render(<JournalListScreen />);

    fireEvent.click(screen.getByTestId('open-theme-modal'));
    fireEvent.click(screen.getByText('Mystique'));

    fireEvent.click(screen.getByTestId('open-theme-modal'));

    expect(screen.getAllByTestId('icon-checkmark')).toHaveLength(1);
  });

  it('[E] Given a theme is selected When selecting it again Then it clears the selection', () => {
    render(<JournalListScreen />);

    // Given
    fireEvent.click(screen.getByTestId('open-theme-modal'));
    fireEvent.click(screen.getByText('Mystique'));

    // When
    fireEvent.click(screen.getByTestId('open-theme-modal'));
    fireEvent.click(screen.getByText('Mystique'));

    // Then
    fireEvent.click(screen.getByTestId('open-theme-modal'));
    expect(screen.queryAllByTestId('icon-checkmark')).toHaveLength(0);
  });
});

