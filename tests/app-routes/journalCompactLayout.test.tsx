/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ThemeLayout } from '@/constants/journalTheme';
import { getBottomNavigationLayout } from '@/constants/layout';
import { TID } from '@/lib/testIDs';
import { searchBarLayout } from '@/components/ui/SearchBar';

jest.mock('@/context/AuthContext', () => ({ AuthContext: require('react').createContext(null) }));
jest.mock('@/services/dreamMediaService', () => ({ resolveDreamMedia: async (dream: any) => ({ imageUrl: dream.imageUrl ?? '', thumbnailUrl: dream.thumbnailUrl }) }));
jest.mock('@/hooks/useRemoteJournalList', () => ({ useRemoteJournalList: () => ({ items: [], loading: false, error: false, complete: true, loadMore: jest.fn() }) }));
jest.mock('@/components/journal/RemoteJournalList', () => ({ RemoteJournalList: ({ header, onOpenDream }: any) => <div data-testid="journal-remote-preview">{header}<button onClick={() => onOpenDream({ remoteId: 2501 })}>Open remote preview</button></div> }));

const mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
const mockPush = jest.fn();
type GuestDream = {
  id: number;
  remoteId?: number;
  clientRequestId?: string;
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
const mockKeyboardListeners = new Map<string, (e?: { endCoordinates?: { height?: number; screenY?: number } }) => void>();
const mockRetryPersistence = jest.fn(async () => undefined);
const mockPersistenceState = { status: 'ready' as const, target: 'device' as const };
const mockLoadRemoteDream = jest.fn();
const mockReloadDreams = jest.fn(async () => undefined);
let mockCompleteness: { status: 'incomplete' } | undefined;
let mockRemotePreviewAllowed = false;
const mockListScrollToOffset = jest.fn();
const mockKeyboardDismiss = jest.fn();
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
      addListener: (event: string, callback: (e?: { endCoordinates?: { height?: number; screenY?: number } }) => void) => {
        mockKeyboardListeners.set(event, callback);
        return { remove: () => mockKeyboardListeners.delete(event) };
      },
      dismiss: () => mockKeyboardDismiss(),
    },
    View: function MockView({
      children,
      testID,
      onPress,
      accessibilityLabel,
      style,
      pointerEvents,
      onTouchStart,
      onMoveShouldSetResponderCapture,
      onMoveShouldSetResponder,
      onResponderGrant,
      onResponderMove,
      onResponderRelease,
      onResponderTerminate,
    }: any) {
      const capturingRef = React.useRef(false);
      const toResponderEvent = (event: any) => {
        const native = event?.nativeEvent ?? event;
        return {
          nativeEvent: {
            pageX: event?.clientX ?? native?.clientX ?? native?.pageX ?? 0,
            pageY: event?.clientY ?? native?.clientY ?? native?.pageY ?? 0,
          },
        };
      };
      const handleDown = (event: any) => {
        capturingRef.current = false;
        onTouchStart?.(toResponderEvent(event));
      };
      const handleMove = (event: any) => {
        const responderEvent = toResponderEvent(event);
        if (!capturingRef.current) {
          const shouldCapture = onMoveShouldSetResponderCapture?.(responderEvent)
            || onMoveShouldSetResponder?.(responderEvent);
          if (shouldCapture) {
            capturingRef.current = true;
            onResponderGrant?.(responderEvent);
          }
        }
        if (capturingRef.current) {
          onResponderMove?.(responderEvent);
        }
      };
      const handleUp = (event: any) => {
        if (capturingRef.current) {
          onResponderRelease?.(toResponderEvent(event));
        }
        capturingRef.current = false;
      };
      const handleCancel = (event: any) => {
        if (capturingRef.current) {
          onResponderTerminate?.(toResponderEvent(event));
        }
        capturingRef.current = false;
      };
      const pointerProps = onTouchStart || onMoveShouldSetResponderCapture || onResponderMove
        ? {
            onPointerDown: handleDown,
            onPointerMove: handleMove,
            onPointerUp: handleUp,
            onPointerCancel: handleCancel,
            onMouseDown: handleDown,
            onMouseMove: handleMove,
            onMouseUp: handleUp,
          }
        : {};
      return React.createElement('div', {
        'data-testid': testID,
        'aria-label': accessibilityLabel,
        onClick: onPress,
        'data-style': JSON.stringify(style ?? {}),
        'data-pointer-events': pointerEvents,
        style: pointerEvents ? { pointerEvents } : undefined,
        ...pointerProps,
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
    completeness: mockCompleteness,
    remotePreviewAllowed: mockRemotePreviewAllowed,
    reloadDreams: mockReloadDreams,
    loadRemoteDreamForPreview: mockLoadRemoteDream,
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
jest.mock('@/components/journal/DreamCard', () => ({
  DreamCard: ({ testID, scrollState, dream, onPress }: any) => (
    <button data-testid={testID} data-scroll-state={scrollState} onClick={() => onPress(dream)}>{dream.title}</button>
  ),
}));
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
          <input
            ref={ref}
            data-testid={inputTestID}
            value={value}
            onChange={(event) => onChangeText(event.target.value)}
            onClick={(event) => event.currentTarget.focus()}
          />
          {value ? (
            <button type="button" data-testid="journal-search-clear" onClick={() => onChangeText('')}>
              Clear
            </button>
          ) : null}
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
    React.useImperativeHandle(ref, () => ({
      scrollToOffset: (args: { offset: number; animated?: boolean }) => {
        mockListScrollToOffset(args);
        props.onScroll?.({
          nativeEvent: { contentOffset: { y: Math.max(0, args?.offset ?? 0) } },
        });
      },
    }));
    const Empty = props.ListEmptyComponent;
    return <div
      data-testid={props.testID}
      data-native-style={JSON.stringify(props.style ?? {})}
      style={{ overflow: 'auto' }}
      onScroll={(event: React.UIEvent<HTMLDivElement>) => {
        props.onScroll?.({
          nativeEvent: { contentOffset: { y: event.currentTarget.scrollTop } },
        });
      }}
    >
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

// RN hit testing, not CSS: `none` skips the view and its descendants, `box-none`
// skips only the view, and `box-only` captures the view while blocking children.
function isRnTouchable(node: Element): boolean {
  const self = node.getAttribute('data-pointer-events');
  if (self === 'none' || self === 'box-none') return false;

  let ancestor = node.parentElement;
  while (ancestor) {
    const pe = ancestor.getAttribute('data-pointer-events');
    if (pe === 'none' || pe === 'box-only') return false;
    ancestor = ancestor.parentElement;
  }
  return true;
}

function pressSearchControl(node: HTMLElement) {
  expect(isRnTouchable(node)).toBe(true);
  fireEvent.click(node);
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

function expectReachableListViewport(
  width: number,
  height: number,
  fontScale: number,
  keyboardVisible = false,
  keyboardHeight = 0,
) {
  const searchMinHeight = searchBarLayout(fontScale).minHeight;
  const searchHeaderHeight = mobileSearchHeaderHeight(fontScale);
  const reservedOverlay = keyboardVisible ? 0 : overlayClearance(width, height, fontScale);
  const listStyle = flattenStyle(mockListProps.style);
  const contentStyle = flattenStyle(mockListProps.contentContainerStyle);
  const marginBottom = listStyle.marginBottom ?? 0;
  const extraNavPadding = (contentStyle.paddingBottom ?? 0) - ThemeLayout.spacing.lg;
  const viewportAboveNav = height - reservedOverlay;
  const keyboardAvoidedViewport = !keyboardVisible || mockPlatform !== 'ios'
    ? viewportAboveNav
    : keyboardHeight > 0
      ? Math.max(0, viewportAboveNav - keyboardHeight)
      : 0;
  const searchInFlow = keyboardAvoidedViewport - searchHeaderHeight >= 120;
  const listViewport = viewportAboveNav - (searchInFlow ? searchHeaderHeight : 0);

  expect(Number(screen.getByTestId(TID.Component.SearchBar).getAttribute('data-min-height'))).toBe(searchMinHeight);
  expect(marginBottom).toBe(reservedOverlay);
  expect(extraNavPadding).toBe(0);
  expect(listStyle.flex).toBe(1);
  expect(listViewport).toBeGreaterThanOrEqual(120);

  const chromeNode = screen.getByTestId('journal-search-chrome');
  const controls = screen.getByTestId('journal-search-controls');
  const input = screen.getByTestId(TID.Input.SearchDreams);
  const chrome = JSON.parse(chromeNode.getAttribute('data-style') || '{}') as {
    position?: string;
  };
  expect(chromeNode.contains(controls)).toBe(true);
  expect(controls.contains(input)).toBe(true);
  expect(controls.getAttribute('data-pointer-events')).toBe('auto');
  if (searchInFlow) {
    expect(chrome.position).toBeUndefined();
    expect(chromeNode.getAttribute('data-pointer-events')).toBe('auto');
    expect(screen.queryByTestId('journal-search-scroll-slot')).toBeNull();
  } else {
    expect(chrome.position).toBe('absolute');
    expect(chromeNode.getAttribute('data-pointer-events')).toBe('box-none');
    expect(chromeNode.style.pointerEvents).toBe('box-none');
    expect(isRnTouchable(chromeNode)).toBe(false);
    expect(isRnTouchable(input)).toBe(true);
    expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId('journal-search-scroll-slot'))).toBe(true);
  }
}

function startOverlaySearchDrag(distance: number, from: HTMLElement) {
  const controls = screen.getByTestId('journal-search-controls');
  expect(controls.contains(from) || controls === from).toBe(true);
  const startX = 120;
  const startY = 96;
  fireEvent.mouseDown(controls, { clientX: startX, clientY: startY, buttons: 1 });
  fireEvent.mouseMove(controls, { clientX: startX, clientY: startY - 9, buttons: 1 });
  fireEvent.mouseMove(controls, { clientX: startX, clientY: startY - distance, buttons: 1 });
  return { controls, startX, startY };
}

function dragFromSearchControls(distance: number, from: HTMLElement) {
  const { controls, startX, startY } = startOverlaySearchDrag(distance, from);
  fireEvent.mouseUp(controls, { clientX: startX, clientY: startY - distance, buttons: 0 });
}

function terminateOverlaySearchDrag(distance: number, from: HTMLElement) {
  const { controls, startX, startY } = startOverlaySearchDrag(distance, from);
  fireEvent.pointerCancel(controls, { clientX: startX, clientY: startY - distance });
}

function collapseSearchByOverlayGesture(offset: number) {
  const chrome = screen.getByTestId('journal-search-chrome');
  const controls = screen.getByTestId('journal-search-controls');
  const list = screen.getByTestId(TID.List.Dreams);
  const input = screen.getByTestId(TID.Input.SearchDreams);

  expect(chrome.contains(input)).toBe(true);
  expect(controls.contains(input)).toBe(true);
  expect(list.contains(chrome)).toBe(false);
  expect(list.contains(controls)).toBe(false);
  expect(chrome.getAttribute('data-pointer-events')).toBe('box-none');
  expect(chrome.style.pointerEvents).toBe('box-none');
  expect(isRnTouchable(chrome)).toBe(false);
  expect(controls.getAttribute('data-pointer-events')).toBe('auto');
  expect(isRnTouchable(input)).toBe(true);

  // The overlay SearchBar covers the uncovered list box at 640x320 fontScale 2.
  // A vertical drag that begins on those controls must still reach FlashList.
  mockListScrollToOffset.mockClear();
  mockKeyboardDismiss.mockClear();
  act(() => {
    dragFromSearchControls(offset, input);
  });
  expect(mockListScrollToOffset).toHaveBeenCalled();
  expect(mockListScrollToOffset).toHaveBeenLastCalledWith({ offset, animated: false });
  expect(mockKeyboardDismiss).toHaveBeenCalled();
}

afterEach(() => {
  mockCompleteness = undefined;
  mockRemotePreviewAllowed = false;
  mockReloadDreams.mockClear();
  cleanup();
  mockDreams.length = 0;
  Object.assign(mockWindow, { width: 390, height: 844, fontScale: 1 });
  mockPush.mockClear();
  mockPlatform = 'android';
  mockKeyboardListeners.clear();
  mockRetryPersistence.mockClear();
  mockListScrollToOffset.mockClear();
  mockKeyboardDismiss.mockClear();
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

  it('keeps search overlaid on iOS short landscape when the keyboard does not shrink the window', () => {
    mockPlatform = 'ios';
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    render(<JournalScreen />);

    expectReachableListViewport(640, 320, 2);
    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    pressSearchControl(input);
    fireEvent.change(input, { target: { value: 'blue room' } });
    expect(document.activeElement).toBe(input);

    const heightBeforeKeyboard = mockWindow.height;
    act(() => {
      mockKeyboardListeners.get('keyboardWillShow')?.({
        endCoordinates: { height: 180, screenY: 140 },
      });
    });
    expect(mockWindow.height).toBe(heightBeforeKeyboard);
    expect(mockWindow.height).toBe(320);
    expectReachableListViewport(640, 320, 2, true, 180);

    const chrome = JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}') as {
      position?: string;
    };
    expect(chrome.position).toBe('absolute');
    expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId('journal-search-scroll-slot'))).toBe(true);
    expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId(TID.List.DreamItem(guestDream.id)))).toBe(true);
    expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
    expect(isRnTouchable(input)).toBe(true);

    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    collapseSearchByOverlayGesture(searchHeaderHeight);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -searchHeaderHeight }] }),
    );
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

    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    pressSearchControl(input);
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: 'blue room' } });
    expect(input.value).toBe('blue room');

    const clear = screen.getByTestId('journal-search-clear');
    pressSearchControl(clear);
    expect(input.value).toBe('');
    expect(screen.queryByTestId('journal-search-clear')).toBeNull();
    expect(document.activeElement).toBe(input);

    mockListScrollToOffset.mockClear();
    mockKeyboardDismiss.mockClear();
    pressSearchControl(input);
    expect(document.activeElement).toBe(input);
    expect(mockListScrollToOffset).not.toHaveBeenCalled();
    expect(mockKeyboardDismiss).not.toHaveBeenCalled();

    collapseSearchByOverlayGesture(searchHeaderHeight);
    const chrome = JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}') as {
      transform?: { translateY: number }[];
    };
    expect(chrome.transform).toEqual([{ translateY: -searchHeaderHeight }]);
    expect(list.contains(screen.getByTestId(TID.List.DreamItem(guestDream.id)))).toBe(true);
    expectReachableListViewport(640, 320, 2);
  });

  it('idles scrolling when a forwarded overlay search drag is terminated', async () => {
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    render(<JournalScreen />);

    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    const dreamCard = screen.getByTestId(TID.List.DreamItem(guestDream.id));

    expectReachableListViewport(640, 320, 2);
    pressSearchControl(input);
    expect(document.activeElement).toBe(input);
    expect(dreamCard.getAttribute('data-scroll-state')).toBe('idle');
    expect(mockListProps.extraData.isScrolling).toBe(false);

    mockListScrollToOffset.mockClear();
    mockKeyboardDismiss.mockClear();
    act(() => {
      terminateOverlaySearchDrag(searchHeaderHeight, input);
    });

    expect(mockListScrollToOffset).toHaveBeenCalled();
    expect(mockKeyboardDismiss).toHaveBeenCalled();
    expect(dreamCard.getAttribute('data-scroll-state')).toBe('scrolling');
    expect(mockListProps.extraData.isScrolling).toBe(true);

    await waitFor(() => {
      expect(screen.getByTestId(TID.List.DreamItem(guestDream.id)).getAttribute('data-scroll-state')).toBe('idle');
      expect(mockListProps.extraData.isScrolling).toBe(false);
    });
  });

  it('resets collapsed search when the overlay layout key changes', () => {
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    const view = render(<JournalScreen />);

    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    expectReachableListViewport(640, 320, 2);

    collapseSearchByOverlayGesture(searchHeaderHeight);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -searchHeaderHeight }] }),
    );

    Object.assign(mockWindow, { width: 320, height: 640, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expectReachableListViewport(320, 640, 2);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}').position).toBeUndefined();

    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expectReachableListViewport(640, 320, 2);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({
        position: 'absolute',
        transform: [{ translateY: 0 }],
      }),
    );
  });

  it('resets overlay drag origin when the keyed list remounts', () => {
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    const view = render(<JournalScreen />);

    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    expect(mockListProps.numColumns).toBe(2);
    expectReachableListViewport(640, 320, 2);

    collapseSearchByOverlayGesture(searchHeaderHeight);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -searchHeaderHeight }] }),
    );

    Object.assign(mockWindow, { width: 320, height: 640, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expect(mockListProps.numColumns).toBe(1);
    expectReachableListViewport(320, 640, 2);

    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expect(mockListProps.numColumns).toBe(2);
    expectReachableListViewport(640, 320, 2);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({
        position: 'absolute',
        transform: [{ translateY: 0 }],
      }),
    );

    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    mockListScrollToOffset.mockClear();
    act(() => {
      dragFromSearchControls(9, input);
    });
    expect(mockListScrollToOffset).toHaveBeenCalled();
    expect(mockListScrollToOffset.mock.calls.every(([args]: [{ offset: number }]) => args.offset <= 9)).toBe(true);
    expect(mockListScrollToOffset).toHaveBeenLastCalledWith({ offset: 9, animated: false });
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -9 }] }),
    );
  });

  it('resets overlay drag origin when returning from desktop', () => {
    mockPlatform = 'web';
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 590, height: 320, fontScale: 2 });
    const view = render(<JournalScreen />);

    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    expect(mockListProps.numColumns).toBe(1);
    expectReachableListViewport(590, 320, 2);

    collapseSearchByOverlayGesture(searchHeaderHeight);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -searchHeaderHeight }] }),
    );

    Object.assign(mockWindow, { width: 1440, height: 900, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expect(mockListProps.numColumns).toBe(4);
    expect(mockListProps.ListHeaderComponent).toBeUndefined();

    Object.assign(mockWindow, { width: 590, height: 320, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expect(mockListProps.numColumns).toBe(1);
    expectReachableListViewport(590, 320, 2);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({
        position: 'absolute',
        transform: [{ translateY: 0 }],
      }),
    );

    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    mockListScrollToOffset.mockClear();
    act(() => {
      dragFromSearchControls(9, input);
    });
    expect(mockListScrollToOffset).toHaveBeenCalled();
    expect(mockListScrollToOffset.mock.calls.every(([args]: [{ offset: number }]) => args.offset <= 9)).toBe(true);
    expect(mockListScrollToOffset).toHaveBeenLastCalledWith({ offset: 9, animated: false });
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -9 }] }),
    );
  });

  it('preserves overlay drag origin when the keyed list does not remount', () => {
    mockDreams.push(guestDream);
    Object.assign(mockWindow, { width: 640, height: 800, fontScale: 2 });
    const view = render(<JournalScreen />);

    expect(mockListProps.numColumns).toBe(2);
    expectReachableListViewport(640, 800, 2);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}').position).toBeUndefined();

    const retainedOffset = 240;
    act(() => {
      mockListProps.onScroll({
        nativeEvent: { contentOffset: { y: retainedOffset } },
      });
    });

    Object.assign(mockWindow, { width: 640, height: 320, fontScale: 2 });
    view.rerender(<JournalScreen />);
    expect(mockListProps.numColumns).toBe(2);
    expectReachableListViewport(640, 320, 2);
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({
        position: 'absolute',
        transform: [{ translateY: 0 }],
      }),
    );

    const input = screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement;
    const searchHeaderHeight = mobileSearchHeaderHeight(2);
    mockListScrollToOffset.mockClear();
    act(() => {
      dragFromSearchControls(9, input);
    });
    expect(mockListScrollToOffset).toHaveBeenCalled();
    expect(mockListScrollToOffset.mock.calls.every(([args]: [{ offset: number }]) => args.offset >= retainedOffset)).toBe(true);
    expect(mockListScrollToOffset).toHaveBeenLastCalledWith({ offset: retainedOffset + 9, animated: false });
    expect(JSON.parse(screen.getByTestId('journal-search-chrome').getAttribute('data-style') || '{}')).toEqual(
      expect.objectContaining({ transform: [{ translateY: -searchHeaderHeight }] }),
    );
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

it('keeps exhaustive retry available after remote previews have finished', () => {
  const { AuthContext } = require('@/context/AuthContext');
  mockCompleteness = { status: 'incomplete' };
  mockRemotePreviewAllowed = true;
  mockDreams.length = 0;
  render(<AuthContext.Provider value={{ user: { id: 'owner-a' } }}><JournalScreen /></AuthContext.Provider>);
  expect(screen.getByTestId('journal-remote-preview')).toBeTruthy();
  expect(screen.getByText('journal.completeness.incomplete')).toBeTruthy();
  fireEvent.click(screen.getByText('journal.persistence.retry'));
  expect(mockReloadDreams).toHaveBeenCalledTimes(1);
});


it('opens the selected card with its stable remote identity when timestamps collide', () => {
  mockDreams.push({ ...guestDream, remoteId: 17, title: 'Other dream' }, { ...guestDream, remoteId: 2501, clientRequestId: 'last-request', title: 'Selected dream' });
  render(<JournalScreen />);
  fireEvent.click(screen.getByText('Selected dream'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: {
    id: String(guestDream.id), remoteId: '2501', clientRequestId: 'last-request',
  } });
});


it('carries stable identity from a cold remote preview into the detail route', async () => {
  const { AuthContext } = require('@/context/AuthContext');
  mockRemotePreviewAllowed = true;
  mockLoadRemoteDream.mockResolvedValue({ ...guestDream, remoteId: 2501, clientRequestId: 'preview-request' });
  render(<AuthContext.Provider value={{ user: { id: 'owner-a' } }}><JournalScreen /></AuthContext.Provider>);
  await act(async () => { fireEvent.click(screen.getByText('Open remote preview')); });
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: {
    id: String(guestDream.id), remoteId: '2501', clientRequestId: 'preview-request',
  } });
});
