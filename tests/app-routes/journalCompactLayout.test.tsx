/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { TID } from '@/lib/testIDs';

const mockWindow = { width: 390, height: 844, scale: 1, fontScale: 1 };
const mockPush = jest.fn();
const mockDreams: unknown[] = [];
const mockKeyboardListeners = new Map<string, () => void>();
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
      isVisible: () => false,
      addListener: (event: string, callback: () => void) => {
        mockKeyboardListeners.set(event, callback);
        return { remove: () => mockKeyboardListeners.delete(event) };
      },
    },
    View: element('div'), Text: element('span'), Pressable: element('button'),
    useWindowDimensions: () => mockWindow,
    StyleSheet: { create: (styles: unknown) => styles, flatten: (styles: unknown) => styles },
  };
});
jest.mock('@/context/DreamsContext', () => ({ useDreams: () => ({ dreams: mockDreams }) }));
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
jest.mock('@/components/journal/DreamCard', () => ({ DreamCard: () => null }));
jest.mock('@/components/journal/EmptyState', () => ({ EmptyState: () => <div data-testid="journal-empty" /> }));
jest.mock('@/components/motion', () => ({ PressableScale: ({ children, onPress, testID }: any) => <button data-testid={testID} onClick={onPress}>{children}</button> }));
jest.mock('@/components/journal/AdvancedFilterSheet', () => ({
  AdvancedFilterSheet: ({ visible, onClose }: any) => visible ? <button data-testid="advanced-filters" onClick={onClose}>Close</button> : null,
}));
jest.mock('@/components/ui/SearchBar', () => {
  const React = require('react');
  return { SearchBar: React.forwardRef(function MockSearchBar({ testID, inputTestID, value, onChangeText }: any, ref: any) { return (
    <div data-testid={testID}><input ref={ref} data-testid={inputTestID} value={value} onChange={(event) => onChangeText(event.target.value)} /></div>
  ); }) };
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
      {props.data.length === 0 ? <Empty /> : null}
    </div>;
  }) };
});

const { default: JournalScreen } = require('@/app/(tabs)/journal');

afterEach(() => {
  cleanup();
  Object.assign(mockWindow, { width: 390, height: 844, fontScale: 1 });
  mockPush.mockClear();
  mockPlatform = 'android';
  mockKeyboardListeners.clear();
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
      expect(list.contains(input)).toBe(true);
      expect(mockListProps.keyboardShouldPersistTaps).toBe('handled');
      expect(list.contains(screen.getByTestId('journal-upsell'))).toBe(true);
      expect(React.isValidElement(mockListProps.ListHeaderComponent)).toBe(true);
      expect(height - mockListProps.style.marginBottom).toBeGreaterThanOrEqual(120);
      expect(mockListProps.contentInsetAdjustmentBehavior).toBe('never');
      expect(typeof mockListProps.renderItem).toBe('function');
      expect(typeof mockListProps.keyExtractor).toBe('function');
      expect(typeof mockListProps.getItemType).toBe('function');
      fireEvent.change(input, { target: { value: 'blue' } });
      expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
      fireEvent.change(input, { target: { value: 'blue room' } });
      expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
      if (screen.getByTestId('filter-favorites').getAttribute('aria-pressed') !== 'true') {
        fireEvent.click(screen.getByTestId('filter-favorites'));
      }
      expect(screen.getByTestId('filter-favorites').getAttribute('aria-pressed')).toBe('true');
      fireEvent.click(screen.getByTestId(TID.Button.FilterMore));
      expect(screen.getByTestId('advanced-filters')).toBeTruthy();

      Object.assign(mockWindow, { width: height, height: width });
      view.rerender(<JournalScreen />);
      expect((screen.getByTestId(TID.Input.SearchDreams) as HTMLInputElement).value).toBe('blue room');
      expect(screen.getByTestId('filter-favorites').getAttribute('aria-pressed')).toBe('true');
      expect(screen.getByTestId('advanced-filters')).toBeTruthy();
      expect(screen.getByTestId(TID.List.Dreams).contains(screen.getByTestId(TID.Input.SearchDreams))).toBe(true);
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
    expect(list.contains(screen.getByTestId('journal-header'))).toBe(true);
    expect(list.contains(screen.getByTestId('journal-upsell'))).toBe(true);
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
    expect(mockListProps.keyboardShouldPersistTaps).toBe('handled');
    expect(mockListProps.keyboardDismissMode).toBe('on-drag');

    act(() => { mockKeyboardListeners.get('keyboardDidHide')?.(); });
    Object.assign(mockWindow, { height: 949 });
    view.rerender(<JournalScreen />);
    expect(screen.getByTestId(TID.Input.SearchDreams)).toBe(input);
    expect(mockListProps.style.marginBottom).toBe(navigationClearance);
    view.unmount();
    expect(mockKeyboardListeners.size).toBe(0);
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
