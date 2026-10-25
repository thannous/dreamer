/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { DesktopShell } from '@/components/navigation/DesktopShell';
import { DarkTheme, LightTheme } from '@/constants/journalTheme';
import { getNoctaliaDesignTokens } from '@/constants/noctaliaDesign';
import { getScreenInsets, useContentWindow } from '@/context/ContentWindowContext';
import {
  getSideColumn,
  useSideColumnTabBar,
  useTabBarInSideColumn,
  type NavigationKey,
  type SideColumn,
  type SideColumnTabBar as SideColumnTabBarState,
  type SideColumnTabBarOwner,
} from '@/context/SideColumnTabBarContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

let mockPathname = '/journal';
let mockInsets = { top: 20, right: 54, bottom: 20, left: 0 };

jest.mock('react-native', () => ({
  Platform: { OS: 'ios', select: (options: Record<string, unknown>) => options.ios ?? options.default },
  View: ({ children, style }: { children?: React.ReactNode; style?: unknown }) => (
    <div data-testid={style ? 'shell' : undefined} data-style={style ? JSON.stringify(style) : undefined}>{children}</div>
  ),
  // The folded iPhone Duo, its status bar column on the right.
  useWindowDimensions: () => ({ width: 466, height: 678, scale: 3, fontScale: 1 }),
}));
jest.mock('react-native-safe-area-context', () => {
  const { createContext, useContext } = jest.requireActual<typeof import('react')>('react');
  const SafeAreaInsetsContext = createContext<unknown>(null);
  return {
    SafeAreaInsetsContext,
    // The system's insets outside the shell, what the shell gives its screens inside it.
    useSafeAreaInsets: () => useContext(SafeAreaInsetsContext) ?? mockInsets,
  };
});
jest.mock('expo-router', () => ({ usePathname: () => mockPathname }));
jest.mock('@/components/navigation/DesktopSidebar', () => ({ DesktopSidebar: () => null }));
jest.mock('@/components/navigation/SideColumnTabBar', () => ({
  SideColumnTabBar: ({ column, bar, windowHeight, bottomInset }: {
    column: SideColumn;
    bar: SideColumnTabBarState;
    windowHeight: number;
    bottomInset: number;
  }) => (
    <button
      data-testid="side-column-bar"
      data-column={JSON.stringify(column)}
      data-active={bar.activeKey}
      data-window-height={windowHeight}
      data-bottom-inset={bottomInset}
      aria-description={bar.capturePressHint}
      onClick={() => (bar.activeKey === 'addDream' ? bar.onCapturePress?.() : bar.onSelect('stats'))}
    />
  ),
}));
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: jest.requireActual('@/constants/journalTheme').LightTheme, mode: 'light' }),
}));

function ContentWidth() {
  return <span data-testid="content-width">{useContentWindow().width}</span>;
}

function Navigation({ owner, activeKey, onSelect, onCapturePress, hint }: {
  owner: SideColumnTabBarOwner;
  activeKey: NavigationKey | null;
  onSelect: (key: NavigationKey) => void;
  onCapturePress?: () => void;
  hint?: string;
}) {
  const inColumn = useSideColumnTabBar(owner, activeKey ? { activeKey, onSelect, onCapturePress, capturePressHint: hint } : null);
  return <span data-testid={`in-column-${owner}`}>{String(inColumn)}</span>;
}

function FreedBottom() {
  return <span data-testid="freed-bottom">{String(useTabBarInSideColumn())}</span>;
}

function TopInset() {
  return <span data-testid="top-inset">{useSafeAreaInsets().top}</span>;
}

function shellStyle() {
  return JSON.parse(screen.getByTestId('shell').getAttribute('data-style') ?? '{}');
}

afterEach(() => {
  cleanup();
  mockPathname = '/journal';
  mockInsets = { top: 20, right: 54, bottom: 20, left: 0 };
});

it('keeps screens clear of the folded Duo status bar column, in the page ground', () => {
  render(<DesktopShell><ContentWidth /></DesktopShell>);
  expect(shellStyle()).toEqual({
    paddingLeft: 0,
    paddingRight: 54,
    backgroundColor: getNoctaliaDesignTokens(LightTheme, 'light').screen.background,
  });
  expect(screen.getByTestId('content-width').textContent).toBe('412');
});

it.each(['/onboarding', '/sleep-sounds'])('paints the gutter at night beside %s, which is always night', (pathname: string) => {
  mockPathname = pathname;
  render(<DesktopShell><ContentWidth /></DesktopShell>);
  expect(shellStyle().backgroundColor).toBe(getNoctaliaDesignTokens(DarkTheme, 'dark').screen.background);
  expect(getNoctaliaDesignTokens(DarkTheme, 'dark').screen.background)
    .not.toBe(getNoctaliaDesignTokens(LightTheme, 'light').screen.background);
});

it('keeps a margin above the screens when the folded Duo puts its status bar beside them', () => {
  // Measured in the iPhone Duo simulator (iOS 27.1): no top inset, an 84 pt column on the right.
  mockInsets = { top: 0, right: 84, bottom: 34, left: 0 };
  render(<DesktopShell><TopInset /><ContentWidth /></DesktopShell>);
  expect(screen.getByTestId('top-inset').textContent).toBe('16');
  expect(screen.getByTestId('content-width').textContent).toBe('382');
});

it('leaves the system insets alone wherever the status bar sits at the top or nothing takes a side', () => {
  const portrait = { top: 59, right: 0, bottom: 34, left: 0 };
  const browser = { top: 0, right: 0, bottom: 0, left: 0 };
  expect(getScreenInsets(portrait)).toBe(portrait);
  expect(getScreenInsets(browser)).toBe(browser);
  // A phone on its side: the camera on one side, no status bar.
  expect(getScreenInsets({ top: 0, right: 59, bottom: 21, left: 59 })).toEqual({ top: 16, right: 59, bottom: 21, left: 59 });
});

describe('the navigation in the iPhone Duo side column', () => {
  const duo = { top: 0, right: 84, bottom: 34, left: 0 };
  const bar = () => screen.queryByTestId('side-column-bar');

  function Screens(props: {
    tabs: NavigationKey | null;
    recording: NavigationKey | null;
    onTabSelect?: (key: NavigationKey) => void;
    onCapturePress?: () => void;
  }) {
    return (
      <DesktopShell>
        <Navigation owner="tabs" activeKey={props.tabs} onSelect={props.onTabSelect ?? jest.fn()} />
        <Navigation owner="recording" activeKey={props.recording} onSelect={jest.fn()}
          onCapturePress={props.onCapturePress} hint="focus" />
        <FreedBottom />
      </DesktopShell>
    );
  }

  it('finds the column where iOS puts its own bars, and nowhere else', () => {
    // Measured in the iPhone Duo simulator (iOS 27.1): folded, and open on its side.
    expect(getSideColumn({ left: 0, right: 84 }, 'ios')).toEqual({ side: 'right', width: 84 });
    expect(getSideColumn({ left: 84, right: 0 }, 'ios')).toEqual({ side: 'left', width: 84 });
    // Open upright, a phone upright, a phone on its side (camera on one side, both kept clear).
    expect(getSideColumn({ left: 0, right: 0 }, 'ios')).toBeNull();
    expect(getSideColumn({ left: 62, right: 62 }, 'ios')).toBeNull();
    expect(getSideColumn({ left: 84, right: 84 }, 'ios')).toBeNull();
    // Too narrow for the labels, and Android's side insets are its navigation bar or camera.
    expect(getSideColumn({ left: 0, right: 54 }, 'ios')).toBeNull();
    expect(getSideColumn({ left: 0, right: 84 }, 'android')).toBeNull();
  });

  it('draws the navigation of the screen on show in the folded Duo column, and none above the tabs', () => {
    mockInsets = duo;
    const onTabSelect = jest.fn();
    const onCapturePress = jest.fn();
    const { rerender } = render(<Screens tabs="journal" recording="addDream" onTabSelect={onTabSelect} onCapturePress={onCapturePress} />);

    expect(bar()?.getAttribute('data-active')).toBe('journal');
    expect(JSON.parse(bar()?.getAttribute('data-column') ?? '{}')).toEqual({ side: 'right', width: 84 });
    expect(bar()?.getAttribute('data-window-height')).toBe('678');
    expect(bar()?.getAttribute('data-bottom-inset')).toBe('34');
    expect(screen.getByTestId('in-column-tabs').textContent).toBe('true');
    expect(screen.getByTestId('freed-bottom').textContent).toBe('true');
    fireEvent.click(bar()!);
    expect(onTabSelect).toHaveBeenCalledWith('stats');

    // Capture sits above the tabs: its own bar, its own Capture press.
    mockPathname = '/recording';
    rerender(<Screens tabs="journal" recording="addDream" onTabSelect={onTabSelect} onCapturePress={onCapturePress} />);
    expect(bar()?.getAttribute('data-active')).toBe('addDream');
    expect(bar()?.getAttribute('aria-description')).toBe('focus');
    fireEvent.click(bar()!);
    expect(onCapturePress).toHaveBeenCalledTimes(1);

    // A dream pushed above the tabs, or Capture with the keyboard up: the column keeps only the status bar.
    mockPathname = '/journal/12';
    rerender(<Screens tabs="journal" recording="addDream" />);
    expect(bar()).toBeNull();
    mockPathname = '/recording';
    rerender(<Screens tabs="journal" recording={null} />);
    expect(bar()).toBeNull();
    mockPathname = '/';
    rerender(<Screens tabs="home" recording={null} />);
    expect(bar()?.getAttribute('data-active')).toBe('home');
  });

  it.each([
    ['a phone upright', { top: 62, right: 0, bottom: 34, left: 0 }],
    ['a phone on its side', { top: 0, right: 62, bottom: 21, left: 62 }],
  ])('keeps the bar at the bottom on %s', (_name: string, insets: typeof duo) => {
    mockInsets = insets;
    render(<Screens tabs="journal" recording="addDream" />);
    expect(bar()).toBeNull();
    expect(screen.getByTestId('in-column-tabs').textContent).toBe('false');
    expect(screen.getByTestId('freed-bottom').textContent).toBe('false');
  });
});
