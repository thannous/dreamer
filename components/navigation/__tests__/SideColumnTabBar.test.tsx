/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { SideColumnTabBar } from '@/components/navigation/SideColumnTabBar';
import type { SideColumnTabBar as SideColumnTabBarState } from '@/context/SideColumnTabBarContext';
import { TID } from '@/lib/testIDs';

let mockFontScale = 1;
let mockActiveAnalysis: { dreamId: number } | null = null;

jest.mock('react-native', () => {
  const flattenStyle = (style: unknown): Record<string, unknown> => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
    }
    return style && typeof style === 'object' ? style as Record<string, unknown> : {};
  };
  return {
    Platform: { OS: 'ios' },
    StyleSheet: { hairlineWidth: 0.5, create: <T,>(styles: T) => styles, flatten: flattenStyle },
    Pressable: ({ accessibilityHint, accessibilityLabel, accessibilityRole, accessibilityState, children, onPress, style, testID }: {
      accessibilityHint?: string;
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean; busy?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
      style?: unknown;
      testID?: string;
    }) => (
      <button
        aria-description={accessibilityHint}
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected ? 'true' : 'false'}
        aria-busy={accessibilityState?.busy ? 'true' : undefined}
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole}
      >
        {children}
      </button>
    ),
    Text: ({ children, style, numberOfLines }: { children?: React.ReactNode; style?: unknown; numberOfLines?: number }) => (
      <span data-native-style={JSON.stringify(flattenStyle(style))} data-number-of-lines={numberOfLines}>{children}</span>
    ),
    View: ({ children, style, testID, accessibilityRole }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
      accessibilityRole?: string;
    }) => (
      <div data-testid={testID} role={accessibilityRole} data-native-style={JSON.stringify(flattenStyle(style))}>{children}</div>
    ),
    ActivityIndicator: () => <span data-testid="nav-analysis-busy" />,
    useWindowDimensions: () => ({ width: 466, height: 678, scale: 3, fontScale: mockFontScale }),
  };
});
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-router', () => ({ router: { dismissTo: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/navigation/TabBarGlass', () => ({
  TabBarGlass: () => null,
  ActiveTabPill: () => <i data-testid="active-pill" />,
}));
jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <em>{name}</em>,
}));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: { primary: '#primary', primaryBorder: '#primary-border', primaryText: '#primary-text' },
    nav: {
      active: '#active',
      inactive: '#inactive',
      glass: { tint: '#glass-tint', solid: '#glass-solid', highlight: ['#a', '#b'], rim: '#glass-rim' },
      activePill: { fill: '#pill-fill', sheen: ['#a', '#b'], rim: '#pill-rim' },
    },
  }),
}));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/context/AnalysisActivityContext', () => ({
  useAnalysisActivity: () => ({ activeAnalysis: mockActiveAnalysis, lastAnalysisOutcome: null }),
}));
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const TAB_IDS = [TID.Tab.Home, TID.Tab.Journal, TID.Tab.AddDream, TID.Tab.Stats, TID.Tab.Explore];
const styleOf = (node: Element | null | undefined) => JSON.parse(node?.getAttribute('data-native-style') ?? '{}');

function renderBar(bar: Partial<SideColumnTabBarState> = {}, { windowHeight = 678, bottomInset = 34 } = {}) {
  const state: SideColumnTabBarState = { activeKey: 'journal', onSelect: jest.fn(), ...bar };
  render(
    <SideColumnTabBar column={{ side: 'right', width: 84 }} bar={state} windowHeight={windowHeight} bottomInset={bottomInset} />,
  );
  return state;
}

afterEach(() => {
  cleanup();
  mockFontScale = 1;
  mockActiveAnalysis = null;
});

it('stands the five destinations on end at the bottom of the folded Duo column', () => {
  renderBar();

  expect(styleOf(screen.getByTestId(TID.Component.SideColumnTabBar))).toEqual({
    position: 'absolute', top: 0, bottom: 0, width: 84, right: 0,
  });
  // Five 64 pt cells, top to bottom in reading order, resting on the bottom safe area.
  const frame = styleOf(screen.getByRole('tablist'));
  expect(frame).toMatchObject({ bottom: 34, left: 6, width: 72, height: 328 });
  const tabs = screen.getAllByRole('tab');
  expect(tabs.map((tab) => tab.getAttribute('data-testid'))).toEqual(TAB_IDS);
  tabs.forEach((tab) => expect(styleOf(tab).height).toBe(64));
  expect(tabs.map((tab) => tab.querySelector('span')?.textContent)).toEqual([
    'nav.home', 'nav.journal', 'nav.capture_dream', 'nav.stats', 'nav.explore',
  ]);
  expect(screen.getByTestId(TID.Tab.Journal).getAttribute('aria-selected')).toBe('true');
  expect(screen.getAllByTestId('active-pill')).toHaveLength(1);
  expect(screen.getByTestId(TID.Tab.Journal).querySelector('[data-testid="active-pill"]')).not.toBeNull();
});

it('opens another destination, and leaves the active one alone', () => {
  const bar = renderBar();

  fireEvent.click(screen.getByTestId(TID.Tab.Stats));
  fireEvent.click(screen.getByTestId(TID.Tab.AddDream));
  fireEvent.click(screen.getByTestId(TID.Tab.Journal));

  expect(bar.onSelect).toHaveBeenNthCalledWith(1, 'stats');
  expect(bar.onSelect).toHaveBeenNthCalledWith(2, 'addDream');
  expect(bar.onSelect).toHaveBeenCalledTimes(2);
});

it('lets Capture act on the open capture, with its own icon and hint', () => {
  const onCapturePress = jest.fn();
  const bar = renderBar({ activeKey: 'addDream', captureIcon: 'mic', onCapturePress, capturePressHint: 'nav.capture_focus_hint' });

  const capture = screen.getByTestId(TID.Tab.AddDream);
  fireEvent.click(capture);

  expect(onCapturePress).toHaveBeenCalledTimes(1);
  expect(bar.onSelect).not.toHaveBeenCalled();
  expect(capture.getAttribute('aria-description')).toBe('nav.capture_focus_hint');
  expect(capture.querySelector('em')?.textContent).toBe('mic');
});

it('shows a dream analysis running in the background on Capture', () => {
  mockActiveAnalysis = { dreamId: 4 };
  renderBar();

  const capture = screen.getByTestId(TID.Tab.AddDream);
  expect(capture.getAttribute('aria-busy')).toBe('true');
  expect(capture.querySelector('[data-testid="nav-analysis-busy"]')).not.toBeNull();
});

it.each([
  // The Duo folded on its side (estimated), open on its side and folded (measured).
  [466, 21, 63],
  [669, 34, 64],
  [678, 34, 64],
])('leaves the top of a %i pt column to the status bar and the camera', (windowHeight: number, bottomInset: number, cell: number) => {
  renderBar({}, { windowHeight, bottomInset });

  const frame = styleOf(screen.getByRole('tablist'));
  screen.getAllByRole('tab').forEach((tab) => expect(styleOf(tab).height).toBe(cell));
  expect(frame.bottom).toBe(bottomInset);
  expect(windowHeight - frame.bottom - frame.height).toBeGreaterThanOrEqual(120);
});

it('keeps the short names and a smaller Capture with large text', () => {
  mockFontScale = 1.3;
  renderBar();

  const labels = screen.getAllByRole('tab').map((tab) => tab.querySelector('span')?.textContent);
  expect(labels).toEqual(['nav.home_compact', 'nav.journal', 'nav.capture_dream_compact', 'nav.stats_compact', 'nav.explore_compact']);
  const disc = screen.getByTestId(TID.Tab.AddDream).querySelector('div');
  // A 64 pt cell holds the 19 pt label and a 35 pt disc.
  expect(styleOf(disc)).toMatchObject({ width: 35, height: 35 });
  expect(styleOf(screen.getByTestId(TID.Tab.AddDream).querySelector('span')).height).toBe(19);
});
