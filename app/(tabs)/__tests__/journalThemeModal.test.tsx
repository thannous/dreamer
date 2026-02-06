/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

vi.mock('@/context/DreamsContext', () => ({
  useDreams: () => ({ dreams: [] }),
}));

vi.mock('@/context/ThemeContext', () => ({
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

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

vi.mock('@/hooks/useJournalAnimations', () => ({
  useModalSlide: () => ({ backdropStyle: {}, contentStyle: {} }),
}));

vi.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatShortDate: () => '2024-01-01',
  }),
}));

vi.mock('@/lib/accessibility', () => ({
  blurActiveElement: () => {},
}));

vi.mock('@/lib/dreamFilters', () => ({
  applyFilters: (dreams: any[]) => dreams,
  getUniqueThemes: () => ['mystical'],
  getUniqueDreamTypes: () => [],
  sortDreamsByDate: (dreams: any[]) => dreams,
}));

vi.mock('@/lib/dreamLabels', () => ({
  getDreamThemeLabel: () => 'Mystique',
  getDreamTypeLabel: (dreamType: string) => dreamType,
}));

vi.mock('@/lib/dreamUsage', () => ({
  isDreamAnalyzed: () => false,
}));

vi.mock('@/lib/imageUtils', () => ({
  getDreamThumbnailUri: () => null,
  preloadImage: () => Promise.resolve(),
}));

vi.mock('@/components/journal/FilterBar', () => ({
  FilterBar: ({ items }: { items: { id: string; onPress: () => void }[] }) => {
    const themeItem = items.find((item) => item.id === 'theme');
    return (
      <button data-testid="open-theme-modal" onClick={themeItem?.onPress}>
        Open theme modal
      </button>
    );
  },
}));

vi.mock('@/components/journal/SearchBar', () => ({
  SearchBar: () => <div data-testid="search-bar" />,
}));

vi.mock('@/components/journal/DateRangePicker', () => ({
  DateRangePicker: () => <div />,
}));

vi.mock('@/components/journal/DreamCard', () => ({
  DreamCard: () => <div />,
}));

vi.mock('@/components/journal/TimelineIndicator', () => ({
  TimelineIndicator: () => <div />,
}));

vi.mock('@/components/guest/UpsellCard', () => ({
  UpsellCard: () => <div />,
}));

vi.mock('@/components/icons/DreamIcons', () => ({
  DreamIcon: () => <div />,
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: () => null,
}));

vi.mock('expo-router', () => ({
  router: { push: vi.fn() },
  useFocusEffect: (cb: () => void | (() => void)) => {
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
  useNavigation: () => ({ setOptions: vi.fn() }),
}));

vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
}));

vi.mock('@/components/ui/BottomSheet', () => ({
  BottomSheet: ({ children, visible, testID }: { children: React.ReactNode; visible: boolean; testID?: string }) => (
    visible ? <div data-testid={testID}>{children}</div> : null
  ),
}));

vi.mock('@/components/journal/EmptyState', () => ({
  EmptyState: () => <div data-testid="empty-state" />,
}));

vi.mock('react-native-reanimated', () => {
  const View = ({ children, style, entering, ...props }: { children?: React.ReactNode; style?: any; entering?: any; [key: string]: any }) => <div {...props}>{children}</div>;
  const createAnimatedComponent = (Component: any) => {
    const AnimatedComponent = ({ style, entering, ...props }: any) => <Component {...props} />;
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

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, top: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

const { default: JournalListScreen } = await import('../journal');

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
