/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { NoctaliaBottomNav } from '@/components/navigation/NoctaliaBottomNav';
import { TID } from '@/lib/testIDs';

let mockPlatformOS: 'android' | 'web' = 'web';
let mockWindowWidth = 390;
let mockWindowHeight = 844;
let mockFontScale = 1;
let mockActiveAnalysis: { dreamId: number } | null = null;
const mockPush = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  const flattenStyle = (style: unknown): Record<string, unknown> => {
    if (Array.isArray(style)) {
      return Object.assign({}, ...style.filter(Boolean).map(flattenStyle));
    }
    return style && typeof style === 'object' ? style as Record<string, unknown> : {};
  };

  return {
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
    },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      className,
      onPress,
      style,
      testID,
      ...rest
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { selected?: boolean; busy?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      className?: string;
      onPress?: () => void;
      style?: unknown;
      testID?: string;
    }) => (
      <button
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected ? 'true' : 'false'}
        aria-busy={accessibilityState?.busy ? 'true' : undefined}
        data-native-class={className}
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-testid={testID}
        onClick={onPress}
        role={accessibilityRole}
        {...(rest as Record<string, unknown>)}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
      flatten: flattenStyle,
    },
    Text: ({
      children,
      className,
      maxFontSizeMultiplier,
      numberOfLines,
      accessible,
      style,
    }: {
      children?: React.ReactNode;
      className?: string;
      maxFontSizeMultiplier?: number;
      numberOfLines?: number;
      accessible?: boolean;
      style?: unknown;
    }) => (
      <span
        data-max-font-size-multiplier={maxFontSizeMultiplier}
        data-number-of-lines={numberOfLines}
        data-accessible={accessible === false ? 'false' : undefined}
        data-native-class={className}
        data-native-style={JSON.stringify(flattenStyle(style))}
      >
        {children}
      </span>
    ),
    View: ({
      children,
      className,
      style,
      accessible,
    }: {
      children?: React.ReactNode;
      className?: string;
      style?: unknown;
      accessible?: boolean;
    }) => (
      <div
        data-native-class={className}
        data-native-style={JSON.stringify(flattenStyle(style))}
        data-accessible={accessible === false ? 'false' : undefined}
      >
        {children}
      </div>
    ),
    ActivityIndicator: () => <span data-testid="nav-analysis-busy" />,
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: mockWindowHeight,
      scale: 1,
      fontScale: mockFontScale,
    }),
  };
});

jest.mock('expo-router', () => ({
  router: { push: (...args: any[]) => mockPush(...args) },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span />,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    action: {
      primary: '#primary',
      primaryBorder: '#primary-border',
      primaryText: '#primary-text',
    },
    nav: {
      active: '#active',
      background: '#background',
      border: '#border',
      inactive: '#inactive',
    },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: { spaceGrotesk: { medium: 'SpaceGrotesk-Medium' } },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/context/AnalysisActivityContext', () => ({
  useAnalysisActivity: () => ({ activeAnalysis: mockActiveAnalysis, lastAnalysisOutcome: null }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

afterEach(() => {
  cleanup();
  mockPlatformOS = 'web';
  mockWindowWidth = 390;
  mockWindowHeight = 844;
  mockFontScale = 1;
  mockActiveAnalysis = null;
  mockPush.mockClear();
});

const barBox = (testID: string) =>
  JSON.parse(
    screen.getByTestId(testID).parentElement?.parentElement?.getAttribute('data-native-style') ?? '{}'
  ) as { height?: number; start?: number; end?: number };
const centerBox = (testID: string) =>
  JSON.parse(
    screen.getByTestId(testID).querySelector('div')?.getAttribute('data-native-style') ?? '{}'
  ) as { width?: number; height?: number };
const barLabels = () =>
  Array.from(screen.getByTestId(TID.Tab.AddDream).parentElement?.querySelectorAll('span') ?? []).filter(
    (node) => node.textContent
  );

describe('NoctaliaBottomNav', () => {
  it('stays available on a wide Android window', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 1280;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const addDreamTab = screen.getByTestId(TID.Tab.AddDream);
    expect(addDreamTab).toBeTruthy();
    expect(addDreamTab.parentElement?.parentElement?.getAttribute('data-native-style')).toContain('"start":160');
    expect(addDreamTab.parentElement?.parentElement?.getAttribute('data-native-style')).toContain('"end":160');
  });

  it('remains hidden on desktop Web', () => {
    mockPlatformOS = 'web';
    mockWindowWidth = 1280;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    expect(screen.queryByTestId(TID.Tab.AddDream)).toBeNull();
  });

  it('remains available on narrow Web windows', () => {
    mockPlatformOS = 'web';
    mockWindowWidth = 390;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    expect(screen.getByTestId(TID.Tab.AddDream)).toBeTruthy();
  });

  it.each([361, 375, 390, 399, 400, 430])('applies shared label sizing to all five destinations at %i dp', (width) => {
    mockWindowWidth = width;
    render(<NoctaliaBottomNav activeKey="addDream" />);

    const labels = barLabels();
    expect(labels).toHaveLength(5);
    labels.forEach((label) => {
      const style = JSON.parse(label.getAttribute('data-native-style') ?? '{}');
      expect(style.fontSize).toBe(width < 400 ? 11 : 12);
      expect(label.getAttribute('data-number-of-lines')).toBe('1');
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
    });
    const margin = width < 400 ? 8 : 22;
    expect(barBox(TID.Tab.AddDream)).toMatchObject({ start: margin, end: margin, height: 86 });
  });

  it('keeps the capture label stable when another tab is active', () => {
    render(<NoctaliaBottomNav activeKey="home" />);

    const captureTab = screen.getByTestId(TID.Tab.AddDream);
    expect(captureTab.textContent).toBe('nav.capture_dream');
    expect(captureTab.getAttribute('aria-label')).toBe('nav.capture_dream_accessibility');
  });

  it('renders five tabs, keeps Capture third, and keeps settings out of the bar', () => {
    render(<NoctaliaBottomNav activeKey="home" />);

    expect(screen.getByTestId(TID.Tab.Home)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Journal)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.AddDream)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Stats)).toBeTruthy();
    expect(screen.getByTestId(TID.Tab.Explore)).toBeTruthy();
    expect(screen.queryByTestId(TID.Tab.Settings)).toBeNull();
    expect([
      screen.getByText('nav.home'),
      screen.getByText('nav.journal'),
      screen.getByText('nav.capture_dream'),
      screen.getByText('nav.stats'),
      screen.getByText('nav.explore'),
    ]).toHaveLength(5);
    expect(screen.queryByText('nav.settings')).toBeNull();
  });

  it('opens the nested Explorer tab from Capture so resource back navigation returns there', () => {
    render(<NoctaliaBottomNav activeKey="addDream" />);

    fireEvent.click(screen.getByTestId(TID.Tab.Explore));

    expect(mockPush).toHaveBeenCalledWith('/(tabs)/explore');
  });

  it('keeps words visible on two lines at 320 dp with default text scale', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 1;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const box = barBox(TID.Tab.AddDream);
    const center = centerBox(TID.Tab.AddDream);
    const labels = barLabels();
    const barClass = screen.getByTestId(TID.Tab.AddDream).parentElement?.parentElement?.getAttribute('data-native-class');

    expect(box.start).toBe(8);
    expect(box.end).toBe(8);
    expect(box.height).toBe(102);
    expect(barClass).toContain('px-1');
    expect(center.width).toBeCloseTo(54.8, 1);
    expect(center.height).toBe(92);
    expect(screen.queryByTestId(TID.Tab.Settings)).toBeNull();
    expect(labels).toHaveLength(5);
    labels.forEach((label) => {
      expect(label.getAttribute('data-max-font-size-multiplier')).toBeNull();
      expect(label.getAttribute('data-number-of-lines')).toBe('2');
      expect(label.getAttribute('data-accessible')).toBe('false');
      expect(label.getAttribute('data-native-class')).toContain('text-[11px]');
    });
  });

  it('keeps five visible labels at fontScale 2 while the bar grows', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 320;
    mockWindowHeight = 640;
    mockFontScale = 2;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const box = barBox(TID.Tab.AddDream);
    const center = centerBox(TID.Tab.AddDream);
    const labels = barLabels();

    expect(box.height).toBe(306);
    expect(center.width).toBe(278);
    expect(center.height).toBe(52);
    expect(labels).toHaveLength(5);
    expect(screen.getByText('nav.capture_dream').getAttribute('data-number-of-lines')).toBe('1');
    [TID.Tab.Home, TID.Tab.Journal, TID.Tab.AddDream, TID.Tab.Stats, TID.Tab.Explore]
      .forEach((testID) => expect(screen.getByTestId(testID).getAttribute('role')).toBe('tab'));
    expect(screen.getByTestId(TID.Tab.Explore).getAttribute('aria-label')).toBe('nav.explore');
    expect(screen.getByTestId(TID.Tab.AddDream).getAttribute('aria-label')).toBe('nav.capture_dream_accessibility');
    expect(screen.getByTestId(TID.Tab.AddDream).getAttribute('aria-selected')).toBe('true');
  });

  it.each([320, 360, 434])('keeps all five actions in reading order with Capture centered at %i dp', (width) => {
    mockPlatformOS = 'android';
    mockWindowWidth = width;
    for (const scale of [1, 1.5, 2]) {
      mockFontScale = scale;
      const view = render(<NoctaliaBottomNav activeKey="addDream" />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((tab) => tab.getAttribute('data-testid'))).toEqual([
        TID.Tab.Home, TID.Tab.Journal, TID.Tab.AddDream, TID.Tab.Stats, TID.Tab.Explore,
      ]);
      const frames = tabs.map((tab) => JSON.parse(tab.getAttribute('data-native-style') ?? '{}'));
      if (scale === 1) {
        expect(frames.every((frame) => frame.position === undefined)).toBe(true);
      } else {
        expect(frames[0].top).toBe(frames[1].top);
        expect(frames[3].top).toBe(frames[4].top);
        expect(frames[2].top).toBeGreaterThan(frames[0].top);
        expect(frames[2].top).toBeLessThan(frames[3].top);
        expect(frames[2].width).toBe(frames[0].width * 2);
        expect(centerBox(TID.Tab.AddDream).width).toBeGreaterThan(130);
      }
      fireEvent.click(tabs[4]);
      expect(mockPush).toHaveBeenLastCalledWith('/(tabs)/explore');
      view.unmount();
    }
  });

  it('keeps compact landscape words visible at fontScale 2 while the bar grows', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 915;
    mockWindowHeight = 412;
    mockFontScale = 2;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const box = barBox(TID.Tab.AddDream);
    const center = centerBox(TID.Tab.AddDream);
    const labels = barLabels();

    expect(box.height).toBe(176);
    expect(center.width).toBeCloseTo(276.33, 2);
    expect(center.height).toBe(92);
    expect(labels).toHaveLength(5);
    expect(screen.getByText('nav.capture_dream').getAttribute('data-number-of-lines')).toBe('1');
  });

  it.each([[640, 320], [915, 412]])('preserves five logical actions around centered Capture at %i by %i dp', (width, height) => {
    mockPlatformOS = 'android';
    mockWindowWidth = width;
    mockWindowHeight = height;
    for (const scale of [1, 1.5, 2]) {
      mockFontScale = scale;
      const view = render(<NoctaliaBottomNav activeKey="addDream" />);
      const tabs = screen.getAllByRole('tab');
      expect(tabs.map((tab) => tab.getAttribute('data-testid'))).toEqual([
        TID.Tab.Home, TID.Tab.Journal, TID.Tab.AddDream, TID.Tab.Stats, TID.Tab.Explore,
      ]);
      const frames = tabs.map((tab) => JSON.parse(tab.getAttribute('data-native-style') ?? '{}'));
      if (scale === 1) {
        expect(frames.every((frame) => frame.position === undefined)).toBe(true);
      } else {
        expect(frames[0].start).toBe(frames[1].start);
        expect(frames[3].start).toBe(frames[4].start);
        expect(frames[2].start).toBe(frames[0].width);
        expect(frames[2].height).toBe(frames[0].height * 2);
        expect(frames[1].top).toBe(frames[0].height);
        expect(frames[4].top).toBe(frames[3].height);
      }
      expect(tabs[2].getAttribute('aria-selected')).toBe('true');
      view.unmount();
    }
  });

  it('widens the center action and margins on a 390 dp phone without growing the bar', () => {
    mockPlatformOS = 'android';
    mockWindowWidth = 390;

    render(<NoctaliaBottomNav activeKey="addDream" />);

    const box = barBox(TID.Tab.AddDream);
    const center = centerBox(TID.Tab.AddDream);
    const barClass = screen.getByTestId(TID.Tab.AddDream).parentElement?.parentElement?.getAttribute('data-native-class');
    const centerLabel = Array.from(screen.getByTestId(TID.Tab.AddDream).querySelectorAll('span')).find(
      (element) => element.textContent === 'nav.capture_dream'
    );

    expect(box.start).toBe(8);
    expect(box.end).toBe(8);
    expect(barClass).toContain('px-2');
    expect(center.width).toBeCloseTo(67.2, 1);
    expect(center.height).toBe(76);
    expect(centerLabel?.getAttribute('data-native-class')).toContain('text-[12px]');
    expect(centerLabel?.getAttribute('data-max-font-size-multiplier')).toBeNull();
    expect(centerLabel?.getAttribute('data-accessible')).toBe('false');
    expect(box.height).toBe(86);
    expect(centerLabel?.getAttribute('data-number-of-lines')).toBe('1');
  });

  it('mirrors the selected tab on the web DOM and keeps Capture unselected when idle', () => {
    render(<NoctaliaBottomNav activeKey="home" />);

    expect(screen.getByTestId(TID.Tab.Home).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId(TID.Tab.AddDream).getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId(TID.Tab.Explore).getAttribute('aria-selected')).toBe('false');
  });

  it('marks Capture selected only when really active', () => {
    const view = render(<NoctaliaBottomNav activeKey="addDream" />);
    expect(screen.getByTestId(TID.Tab.AddDream).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId(TID.Tab.Home).getAttribute('aria-selected')).toBe('false');
    view.unmount();
  });

  it('mirrors the analysis busy state on Capture and clears it when idle', () => {
    mockActiveAnalysis = { dreamId: 7 };
    const busy = render(<NoctaliaBottomNav activeKey="addDream" />);
    expect(screen.getByTestId(TID.Tab.AddDream).getAttribute('aria-busy')).toBe('true');
    expect(screen.queryByTestId('nav-analysis-busy')).toBeTruthy();
    busy.unmount();
    cleanup();

    mockActiveAnalysis = null;
    render(<NoctaliaBottomNav activeKey="addDream" />);
    // No analysis: product passes Boolean(null) = false, so the DOM carries
    // an explicit "false" rather than no attribute. Non-capture tabs stay null.
    expect(screen.getByTestId(TID.Tab.AddDream).getAttribute('aria-busy')).toBe('false');
    expect(screen.getByTestId(TID.Tab.Home).getAttribute('aria-busy')).toBeNull();
    expect(screen.queryByTestId('nav-analysis-busy')).toBeNull();
  });
});
