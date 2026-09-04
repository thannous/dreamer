/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  cleanup();
  mockWindowWidth = 390;
});

let mockWindowWidth = 390;

jest.doMock('@/context/DreamsContext', () => ({
  useDreams: () => ({ dreams: [] }),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#6f62b5',
      accentText: '#6f62b5',
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
  getUniqueThemes: jest.fn(() => ['mystical']),
  getUniqueDreamTypes: jest.fn(() => []),
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
    onClear,
    clearTestID,
  }: {
    items: { id: string; active?: boolean; onPress: () => void; testID?: string }[];
    onClear: () => void;
    clearTestID?: string;
  }) {
    const hasActive = items.some((item) => item.id !== 'all' && item.active);
    return (
      <div>
        {items.map((item) => (
          <button key={item.id} data-testid={item.testID} onClick={item.onPress}>
            {item.id}
          </button>
        ))}
        {hasActive ? (
          <button data-testid={clearTestID} onClick={onClear}>
            clear
          </button>
        ) : null}
      </div>
    );
  },
}));

jest.doMock('@/components/ui/SearchBar', () => ({
  SearchBar: ({
    testID,
    inputTestID,
    value,
    onChangeText,
  }: {
    testID?: string;
    inputTestID?: string;
    value: string;
    onChangeText: (text: string) => void;
  }) => (
    <div data-testid={testID ?? 'search-bar'}>
      <input
        data-testid={inputTestID ?? 'input.searchDreams'}
        value={value}
        onChange={(event) => onChangeText(event.target.value)}
      />
    </div>
  ),
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

jest.doMock('@/components/icons/DreamIcons', () => ({
  DreamIcon: () => <div />,
}));

jest.doMock('@shopify/flash-list', () => ({
  FlashList: () => null,
}));

const mockPush = jest.fn();

jest.doMock('expo-router', () => ({
  router: { push: mockPush },
  useFocusEffect: () => {},
  useNavigation: () => ({ setOptions: jest.fn() }),
  usePathname: () => '/journal',
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
      showsVerticalScrollIndicator,
      showsHorizontalScrollIndicator,
      horizontal,
      numberOfLines,
      adjustsFontSizeToFit,
      minimumFontScale,
      hitSlop,
      style,
      className,
      ...rest
    } = props;
    return {
      ...rest,
      ...(className ? { className } : {}),
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
    useWindowDimensions: () => ({ width: mockWindowWidth, height: 844, scale: 1, fontScale: 1 }),
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
  const enteringChain: any = {
    delay: () => enteringChain,
    duration: () => enteringChain,
    springify: () => springifyChain,
    withInitialValues: () => enteringChain,
    easing: () => enteringChain,
  };
  return {
    // Without `__esModule`, Babel's interop makes `default` the whole module object, so
    // `Animated.createAnimatedComponent` resolves to undefined. Flag it explicitly and
    // give the default export the full animated-component surface.
    __esModule: true,
    default: {
      View,
      Text: View,
      ScrollView: View,
      FlatList: View,
      createAnimatedComponent,
    },
    createAnimatedComponent,
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
    Easing: {
      out: () => {},
      in: () => {},
      cubic: {},
      bezier: (..._points: number[]) => (value: any) => value,
    },
    // Reanimated CSS easing helpers, used by `@/components/motion`. They only need to be
    // inert values that survive being spread into a style object.
    cubicBezier: (...points: number[]) => `cubic-bezier(${points.join(', ')})`,
    linear: (...points: any[]) => `linear(${points.join(', ')})`,
    steps: (count: number) => `steps(${count})`,
    useReducedMotion: () => false,
    FadeIn: enteringChain,
    FadeOut: enteringChain,
    FadeInUp: enteringChain,
    LinearTransition: enteringChain,
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

describe('Journal advanced filter sheet', () => {
  it('shows a checkmark for the selected theme', () => {
    render(<JournalListScreen />);

    fireEvent.click(screen.getByTestId('btn.filterMore'));
    fireEvent.click(screen.getByText('Mystique'));

    fireEvent.click(screen.getByTestId('btn.filterMore'));

    expect(screen.getAllByTestId('icon-checkmark').length).toBeGreaterThan(0);
  });

  it('[E] Given a theme is selected When selecting it again Then it clears the selection', () => {
    render(<JournalListScreen />);

    // Given
    fireEvent.click(screen.getByTestId('btn.filterMore'));
    fireEvent.click(screen.getByText('Mystique'));

    // When
    fireEvent.click(screen.getByTestId('btn.filterMore'));
    fireEvent.click(screen.getByText('Mystique'));

    // Then
    fireEvent.click(screen.getByTestId('btn.filterMore'));
    expect(screen.queryAllByTestId('icon-checkmark')).toHaveLength(0);
  });

  it('keeps exactly three quick filters and a separate advanced action', () => {
    render(<JournalListScreen />);

    expect(screen.getByTestId('btn.filterAll')).toBeTruthy();
    expect(screen.getByTestId('btn.filterFavorites')).toBeTruthy();
    expect(screen.getByTestId('btn.filterToDeepen')).toBeTruthy();
    expect(screen.getByTestId('btn.filterMore')).toBeTruthy();
    expect(screen.queryByTestId('btn.filterAnalyzed')).toBeNull();
    expect(screen.queryByTestId('btn.filterExplored')).toBeNull();
  });

  it('exposes settings from the journal header without a fifth tab', () => {
    mockPush.mockReset();
    render(<JournalListScreen />);

    const settings = screen.getByTestId('btn.header.journal.settings');
    expect(settings.getAttribute('aria-label')).toBe('nav.settings');
    fireEvent.click(settings);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/settings');
    expect(screen.queryByTestId('tab.settings')).toBeNull();
  });
  it('keeps journal settings and more actions at least 44 dp', () => {
    render(<JournalListScreen />);
    expect(screen.getByTestId('btn.header.journal.settings').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('btn.header.journal.settings').className).toContain('min-w-[44px]');
    expect(screen.getByTestId('btn.filterMore').className).toContain('min-h-[44px]');
    expect(screen.getByTestId('btn.filterMore').className).toContain('min-w-[44px]');
  });


  it('resets advanced filters when Tous is pressed', () => {
    render(<JournalListScreen />);

    fireEvent.click(screen.getByTestId('btn.filterMore'));
    fireEvent.click(screen.getByText('Mystique'));
    fireEvent.click(screen.getByTestId('btn.filterMore'));
    expect(screen.getAllByTestId('icon-checkmark').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId('btn.filterAll'));
    fireEvent.click(screen.getByTestId('btn.filterMore'));
    expect(screen.queryAllByTestId('icon-checkmark')).toHaveLength(0);
  });

  it('keeps search and three quick filters visible at 320dp without Atlas chrome', () => {
    mockWindowWidth = 320;
    render(<JournalListScreen />);

    expect(screen.getByTestId('btn.filterAll')).toBeTruthy();
    expect(screen.getByTestId('btn.filterFavorites')).toBeTruthy();
    expect(screen.getByTestId('btn.filterToDeepen')).toBeTruthy();
    expect(screen.getByTestId('component.searchBar')).toBeTruthy();
    expect(screen.getByTestId('btn.filterMore')).toBeTruthy();
    expect(screen.queryByTestId('btn.filterSearch')).toBeNull();
    expect(screen.queryByText('journal.atlas.search')).toBeNull();
  });

  it('surfaces an active advanced filter chip that Tous can reset', () => {
    render(<JournalListScreen />);

    fireEvent.click(screen.getByTestId('btn.filterMore'));
    fireEvent.click(screen.getByText('Mystique'));

    expect(screen.getByTestId('btn.filterTheme')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn.filterAll'));
    expect(screen.queryByTestId('btn.filterTheme')).toBeNull();
  });

  it('keeps recurrence combinable with a dream type and resets both in one action', () => {
    const { getUniqueDreamTypes } = require('@/lib/dreamFilters');
    getUniqueDreamTypes.mockReturnValue(['Symbolic Dream', 'Recurring Dream']);
    render(<JournalListScreen />);

    fireEvent.click(screen.getByTestId('btn.filterMore'));
    fireEvent.click(screen.getByText('Symbolic Dream'));
    fireEvent.click(screen.getByText('journal.filter.recurring'));
    fireEvent.click(screen.getByText('journal.filter_sheet.sort.oldest'));

    expect(screen.getByTestId('btn.filterRecurring')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn.clearFilters'));
    expect(screen.queryByTestId('btn.filterRecurring')).toBeNull();
    expect(screen.queryByTestId('btn.filterSearch')).toBeNull();

    fireEvent.click(screen.getByTestId('btn.filterMore'));
    expect(screen.queryAllByTestId('icon-checkmark')).toHaveLength(0);
  });

  it('surfaces an active search as a visible chip that Tous can reset', () => {
    render(<JournalListScreen />);

    fireEvent.change(screen.getByTestId('input.searchDreams'), { target: { value: 'harbor' } });
    expect(screen.getByTestId('btn.filterSearch')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn.filterAll'));
    expect(screen.queryByTestId('btn.filterSearch')).toBeNull();
  });
});
