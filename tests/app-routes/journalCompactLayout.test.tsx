/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ThemeLayout } from '@/constants/journalTheme';
import { getBottomNavigationLayout } from '@/constants/layout';
import { TID } from '@/lib/testIDs';
import { searchBarLayout } from '@/components/ui/SearchBar';

const mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
const mockPush = jest.fn();
type GuestDream = {
  id: number;
  transcript: string;
  title: string;
  interpretation: string;
  shareableQuote: string;
  imageUrl: string;
  chatHistory: unknown[];
  dreamType: string;
  isAnalyzed: boolean;
};
const mockDreams: GuestDream[] = [];
const guestDream = {
  id: 1_700_000_000_000,
  transcript: 'A blue room',
  title: 'Blue room',
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  isAnalyzed: false,
};
const mockKeyboardListeners = new Map<string, () => void>();
const mockRetryPersistence = jest.fn(async () => undefined);
const mockPersistenceState = { status: 'ready' as const, target: 'device' as const };
let mockPlatform = 'android';
let mockListProps: Record<string, any> = {};

jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) }, useFocusEffect: () => {} }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 24, left: 0, right: 0 }) }));
jest.mock('react-native', () => {
  const React = require('react');
  const element = (tag: string) => function MockNativeElement({ children, testID, onPress, accessibilityLabel }: any) {
    return React.createElement(tag, { 'data-testid': testID, 'aria-label': accessibilityLabel, onClick: onPress }, children);
  };
  return {
    Platform: { get OS() { return mockPlatform; }, select: (values: any) => values[mockPlatform] ?? values.default },
    Keyboard: {
      // RN Web 0.21 does not implement isVisible. Leave it unset on web so a
      // missing production guard fails this suite instead of being masked.
      get isVisible() {
        return mockPlatform === 'web' ? undefined : () => false;
      },
      addListener: (event: string, callback: () => void) => {
        mockKeyboardListeners.set(event, callback);
        return { remove: () => mockKeyboardListeners.delete(event) };
      },
    },
    View: function MockView({ children, testID, onPress, accessibilityLabel, style }: any) {
      return React.createElement('div', {
        'data-testid': testID,
        'aria-label': accessibilityLabel,
        onClick: onPress,
        'data-style': JSON.stringify(style ?? {}),
      }, children);
    },
    Text: element('span'), Pressable: element('button'),
    useWindowDimensions: () => mockWindow,
    StyleSheet: { create: (styles: unknown) => styles, flatten: (styles: unknown) => styles },
  };
});
jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => ({
    dreams: mockDreams,
    persistenceState: mockPersistenceState,
    retryPersistence: mockRetryPersistence,
  }),
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({ getNoctaliaDesignTokens: () => ({ text: { primary: '#fff' }, action: { primaryText: '#111' } }) }));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useLocaleFormatting', () => ({ useLocaleFormatting: () => ({ formatShortDate: () => '' }) }));
jest.mock('@/hooks/useClearWebFocus', () => ({ useClearWebFocus: () => {} }));
jest.mock('@/lib/accessibility', () => ({ blurActiveElement: () => {} }));
jest.mock('@/lib/analytics', () => ({ trackProductEvent: () => Promise.resolve() }));
jest.mock('@/lib/imageUtils', () => ({ getDreamThumbnailUri: () => null, preloadImage: () => Promise.resolve() }));
jest.mock('@/context/ScrollPerfContext', () => ({ ScrollPerfProvider: ({ children }: any) => <>{children}</> }));
jest.mock('@/components/inspiration/AtmosphericBackground', () => ({ AtmosphericBackground: () => null }));
jest.mock('@/components/inspiration/PageHeader', () => ({ PageHeaderContent: () => <header data-testid="journal-header">Journal</header> }));
jest.mock('@/components/dev/MockNavigationRail', () => ({ MockNavigationRail: () => null }));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/guest/UpsellCard', () => ({ UpsellCard: () => <div data-testid="journal-upsell" /> }));
jest.mock('@/components/journal/DreamCard', () => ({ DreamCard: ({ testID }: { testID?: string }) => <div data-testid={testID} /> }));
jest.mock('@/components/journal/EmptyState', () => ({ EmptyState: () => <div data-testid="journal-empty" /> }));
jest.mock('@/components/motion', () => ({ PressableScale: ({ children, onPress, testID }: any) => <button data-testid={testID} onClick={onPress}>{children}</button> }));
jest.mock('@/components/journal/AdvancedFilterSheet', () => ({
  AdvancedFilterSheet: ({ visible, onClose }: any) => visible ? <button data-testid="advanced-filters" onClick={onClose}>Close</button> : null,
}));
jest.mock('@/components/ui/SearchBar', () => {
  const React = require('react');
  const { searchBarLayout: actualSearchBarLayout } = jest.requireActual('@/components/ui/SearchBar') as {
    searchBarLayout: (fontScale: number) => { minHeight: number };
  };
  const { useWindowDimensions } = require('react-native') as { useWindowDimensions: () => { fontScale: number } };
  return {
    searchBarLayout: actualSearchBarLayout,
    SearchBar: React.forwardRef(function MockSearchBar({ testID, inputTestID, value, onChangeText }: any, ref: any) {
      const { minHeight } = actualSearchBarLayout(useWindowDimensions().fontScale);
      return (
        <div data-testid={testID} data-min-height={minHeight} style={{ minHeight }}>
          <input ref={ref} data-testid={inputTestID} value={value} onChange={(event) => onChangeText(event.target.value)} />
        </div>
      );
    }),
  };
});
jest.mock('@/components/journal/FilterBar', () => ({ FilterBar: ({ items }: any) => (
  <div data-testid="journal-filters">{items.map((item: any) => <button key={item.id} data-testid={`filter-${item.id}`} aria-pressed={item.active} onClick={item.onPress}>{item.id}</button>)}</div>
) }));
jest.mock('@shopify/flash-list', () => {
  const React = require('react');
  return { FlashList: React.forwardRef(function MockFlashList(props: any, ref: any) {
    mockListProps = props;
    React.useImperativeHandle(ref, () => ({ scrollToOffset: () => {} }));
    const Empty = props.ListEmptyComponent;
    return <div data-testid={props.testID} data-native-style={JSON.stringify(props.style ?? {})}>
      {props.ListHeaderComponent}
      {props.data.length === 0
        ? (typeof Empty === 'function' ? <Empty /> : Empty)
        : props.data.map((item: { id: number }, index: number) => (
          <React.Fragment key={props.keyExtractor?.(item, index) ?? item.id}>
            {props.renderItem({ item, index })}
          </React.Fragment>
        ))}
    </div>;
  }) };
});

const { default: JournalScreen } = require('@/app/(tabs)/journal');

const MOCK_INSETS = { top: 24, bottom: 24 };

function flattenStyle(style: unknown): Record<string, number> {
  if (!style) return {};
  if (Array.isArray(style)) {
    return style.reduce<Record<string, number>>((acc, item) => ({ ...acc, ...flattenStyle(item) }), {});
  }
  return { ...(style as Record<string, number>) };
}

function mobileSearchHeaderHeight(fontScale: number) {
  return MOCK_INSETS.top + ThemeLayout.spacing.sm + searchBarLayout(fontScale).minHeight + ThemeLayout.spacing.sm;
}

function overlayClearance(width: number, height: number, fontScale: number) {
  const navigationLayout = getBottomNavigationLayout(width, height, fontScale);
  return navigationLayout.barHeight + Math.max(
    MOCK_INSETS.bottom,
    navigationLayout.minimumBottomInset,
  );
}

function expectReachableListViewport(width: number, height: number, fontScale: number, keyboardVisible = false) {
  const searchMinHeight = searchBarLayout(fontScale).minHeight;
  const searchHeaderHeight = mobileSearchHeaderHeight(fontScale);
  const reservedOverlay = keyboardVisible ? 0 : overlayClearance(width, height, fontScale);
  const listStyle = flattenStyle(mockListProps.style);
  const contentStyle = flattenStyle(mockListProps.contentContainerStyle);
  const marginBottom = listStyle.marginBottom ?? 0;
  const extraNavPadding = (contentStyle.paddingBottom ?? 0) - ThemeLayout.spacing.lg;
  const viewportAboveNav = height - reservedOverlay;
  const searchInFlow = viewportAboveNav - searchHeaderHeight >= 120;
  const listViewport = viewportAboveNav - (searchInFlow ? searchHeaderHeight : 0);

  expect(Number(screen.getByTestId(TID.Component.SearchBar).getAttribute('data-min-height'))).toBe(searchMinHeight);
  expect(marginBottom).toBe(reservedOverlay);
  expect(extraNavPadding).toBe(0);
  expect(listStyle.flex).toBe(1);
  expect(listViewport).toBeGreaterThanOrEqual(120);

  const chrome = JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}') as {
    position?: string;
  };
  if (searchInFlow) {
    expect(chrome.position).toBeUndefined();
    expect(screen.queryByTestId('journal-search-scroll-slot')).toBeNull();
  } else {
    expect(chrome.position).toBe('absolute');
    expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId('journal-search-scroll-slot'))).toBe(true);
  }
}

afterEach(() => {
  cleanup();
  mockDreams.length = 0;
  Object.assign(mockWindow, { width: 390, height: 844, fontScale: 1 });
  mockPush.mockClear();
  mockPlatform = 'android';
  mockKeyboardListeners.clear();
  mockRetryPersistence.mockClear();
});

describe('Journal compact large-text layout', () => {
  it.each([[640, 320], [915, 412]])('keeps virtualization and persistent controls at %i by %i dp', (width: number, height: number) => {
    const view = render(<JournalScreen />);
    for (const scale of [1, 1.5, 2]) {
      Object.assign(mockWindow, { width, height, fontScale: scale });
      view.rerender(<JournalScreen />);
      const list = screen.getByTestId(TID.List.Dreams);
      const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
      expect(screen.getAllByTestId(TID.Component.SearchBar)).toHaveLength(1);
      expect(screen.getAllByTestId('journal-filters')).toHaveLength(1);
      expect(screen.getAllByTestId(TID.Button.HeaderJournalSettings)).toHaveLength(1);
      expect(list.contains(input)).toBe(false);
      expect(mockListProps.keyboardShouldPersistTaps).toBe('handled');
      expect(list.contains(screen.getByTestId('journal-upsell'))).toBe(true);
      expect(React.isValidElement(mockListProps.ListHeaderComponent)).toBe(true);
      expectReachableListViewport(width, height, scale);
      expect(mockListProps.contentInsetAdjustmentBehavior).toBe('never');
      expect(typeof mockListProps.renderItem).toBe('function');
      expect(typeof mockListProps.keyExtractor).toBe('function');
      expect(typeof mockListProps.getItemType).toBe('function');
      input.focus();
      fireEvent.change(input, { target: { value: 'blue' } });
      expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
      fireEvent.change(input, { target: { value: 'blue room' } });
      expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
      expect(document.activeElement).toBe(input);
      if (screen.getByTestId('filter-favorites').getAttribute('aria-pressed') !== 'true') {
        fireEvent.click(screen.getByTestId('filter-favorites'));
      }
      expect(screen.getByTestId('filter-favorites').getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(screen.getByTestId(TID.Button.FilterMore));
      expect(screen.getByTestId('advanced-filters')).toBeTruthy();

      input.focus();
      expect(document.activeElement).toBe(input);
      Object.assign(mockWindow, { width: height, height: width });
      view.rerender(<JournalScreen />);
      const inputAfterRotation = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
      expect(inputAfterRotation).toBe(input);
      expect(document.activeElement).toBe(input);
      expect(inputAfterRotation.value).toBe('blue room');
      expect(screen.getByTestId('filter-favorites').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('advanced-filters')).toBeTruthy();
      expect(screen.getByTestId(TID.List.Dreams).contains(inputAfterRotation)).toBe(false);
      expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId('journal-upsell'))).toBe(true);
      expect(React.isValidElement(mockListProps.ListHeaderComponent)).toBe(true);
      expect(mockListProps.keyboardShouldPersistTaps).toBe('handled');
      fireEvent.click(screen.getByTestId('advanced-filters'));
      fireEvent.click(screen.getByTestId(TID.Button.HeaderJournalSettings));
      expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/settings');
    }
  });

  it.each([1, 1.5])('keeps the Honor search input mounted and frees hidden navigation space with font scale %s', (fontScale: number) => {
    Object.assign(mockWindow, { width: 437, height: 949, fontScale });
    const view = render(<JournalScreen />);
    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    const list = screen.getByTestId(TID.List.Dreams);
    const navigationClearance = mockListProps.style.marginBottom;
    expect(list.contains(input)).toBe(false);
    expect(list.contains(screen.getByTestId('journal-header'))).toBe(true);
    expect(list.contains(screen.getByTestId('journal-upsell'))).toBe(true);
    expect(React.isValidElement(mockListProps.ListHeaderComponent)).toBe(true);
    expectReachableListViewport(437, 949, fontScale);
    expect(navigationClearance).toBeGreaterThan(0);
    input.focus();
    fireEvent.change(input, { target: { value: 'blue room' } });

    act(() => { mockKeyboardListeners.get('keyboardDidShow')?.(); });
    Object.assign(mockWindow, { height: 490 });
    view.rerender(<JournalScreen />);
    expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.value).toBe('blue room');
    expect(mockListProps.style.marginBottom).toBe(0);
    expectReachableListViewport(437, 490, fontScale, true);
    expect(mockListProps.keyboardShouldPersistTaps).toBe('handled');
    expect(mockListProps.keyboardDismissMode).toBe('on-drag');

    act(() => { mockKeyboardListeners.get('keyboardDidHide')?.(); });
    Object.assign(mockWindow, { height: 949 });
    view.rerender(<JournalScreen />);
    expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
    expect(mockListProps.style.marginBottom).toBe(navigationClearance);
    expectReachableListViewport(437, 949, fontScale);
    view.unmount();
    expect(mockKeyboardListeners.size).toBe(0);
  });

  it.each([[640, 320], [915, 412]])('keeps the header upsell scrollable at %i by %i dp when a guest has a dream', (width: number, height: number) => {
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width, height, fontScale: 2 });
    const view = render(<JournalScreen />);
    const list = screen.getByTestId(TID.List.Dreams);
    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    const upsell = screen.getByTestId('journal-upsell');
    const dreamCard = screen.getByTestId(TID.List.DreamItem(guestDream.id));

    expect(list.contains(input)).toBe(false);
    expect(list.contains(upsell)).toBe(true);
    expect(list.contains(dreamCard)).toBe(true);
    expect(screen.queryByTestId('journal-empty')).toBeNull();
    expect(React.isValidElement(mockListProps.ListHeaderComponent)).toBe(true);
    expect(searchBarLayout(2).minHeight).toBe(112);
    expectReachableListViewport(width, height, 2);

    input.focus();
    fireEvent.change(input, { target: { value: 'blue room' } });
    expect(document.activeElement).toBe(input);
    Object.assign(mockWindow, { width: height, height: width });
    view.rerender(<JournalScreen />);
    const inputAfterRotation = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    expect(inputAfterRotation).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(screen.getByTestId(TID.List.Dreams).contains(inputAfterRotation)).toBe(false);
    expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId('journal-upsell'))).toBe(true);
    expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId(TID.List.DreamItem(guestDream.id)))).toBe(true);
    expectReachableListViewport(height, width, 2);
  });

  it('keeps dream cards reachable under the production SearchBar at 640 by 320 dp and fontScale 2', () => {
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    render(<JournalScreen />);

    const searchMinHeight = searchBarLayout(2).minHeight;
    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    const reservedOverlay = overlayClearance(640, 320, 2);
    const list = screen.getByTestId(TID.List.Dreams);
    const dreamCard = screen.getByTestId(TID.List.DreamItem(guestDream.id));
    const listStyle = flattenStyle(mockListProps.style);
    const uncoveredListBox = 320 - reservedOverlay;

    expect(searchMinHeight).toBe(112);
    expect(searchHeaderHeight).toBe(152);
    expect(reservedOverlay).toBe(200);
    expect(listStyle.marginBottom).toBe(reservedOverlay);
    expect(uncoveredListBox).toBeGreaterThanOrEqual(120);
    expect(320 - searchHeaderHeight - reservedOverlay).toBeLessThan(120);
    expect(Number(screen.getByTestId(TID.Component.SearchBar).getAttribute('data-min-height'))).toBe(112);
    expect(list.contains(screen.getByTestId(TID.Input.SearchDreams))).toBe(false);
    expect(list.contains(dreamCard)).toBe(true);
    expect(list.contains(screen.getByTestId('journal-search-scroll-slot'))).toBe(true);

    act(() => {
      mockListProps.onScroll({ nativeEvent: { contentOffset: { y: searchHeaderHeight } } });
    });
    const chrome = JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}') as {
      transform?: { translateY: number }[];
    };
    expect(chrome.transform).toEqual([{ translateY: -searchHeaderHeight }]);
    expect(list.contains(screen.getByTestId(TID.List.DreamItem(guestDream.id)))).toBe(true);
    expectReachableListViewport(640, 320, 2);
  });

  it('preserves the fixed desktop header and grid', () => {
    mockPlatform = 'web';
    Object.assign(mockWindow, { width: 1440, height: 900, fontScale: 1.5 });
    render(<JournalScreen />);
    const list = screen.getByTestId(TID.List.Dreams);
    expect(list.contains(screen.getByTestId(TID.Input.SearchDreams))).toBe(false);
    expect(list.contains(screen.getByTestId('journal-upsell'))).toBe(false);
    expect(mockListProps.ListHeaderComponent).toBeUndefined();
    expect(mockListProps.style).toBeUndefined();
    expect(mockListProps.numColumns).toBe(4);
  });
});
