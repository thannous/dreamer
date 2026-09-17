/* @jest-environment jsdom */

import React from 'react';
import { cleanup, render } from '@testing-library/react';

const mockScreenOptions = new Map<string, unknown>();
let mockNavigatorOptions: unknown;
let mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };

afterEach(() => {
  cleanup();
  mockScreenOptions.clear();
  mockNavigatorOptions = undefined;
  mockDimensions = { width: 390, height: 844, scale: 1, fontScale: 1 };
});

jest.mock('expo-router', () => {
  const Tabs = ({
    children,
    screenOptions,
  }: {
    children?: React.ReactNode;
    screenOptions?: unknown;
  }) => {
    mockNavigatorOptions = screenOptions;
    return <nav>{children}</nav>;
  };
  const TabsScreen = ({ name, options }: { name: string; options: unknown }) => {
    mockScreenOptions.set(name, options);
    return <div data-testid={`screen-${name}`} />;
  };
  TabsScreen.displayName = 'MockLucidTabsScreen';
  Tabs.Screen = TabsScreen;
  return { Tabs };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span />,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  useWindowDimensions: () => mockDimensions,
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('@/components/haptic-tab', () => ({
  HapticTab: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
}));

jest.mock('@/constants/lucidTheme', () => ({
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accentStrong: '#4f2fa8',
    background: '#f6f3ff',
    border: '#d8cff3',
    overlay: '#fff',
    text: '#201a35',
    textMuted: '#736d82',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: {
      chrome: {
        tabs: {
          today: 'Today',
          journal: 'Journal',
          programs: 'Journeys',
          night: 'Night',
          progress: 'Insights',
          settings: 'Profile',
        },
      },
    },
  }),
}));

const { default: LucidTabsLayout } = require('@/app/lucid/(tabs)/_layout');

describe('Lucid tabs layout', () => {
  it('keeps navigator and per-screen options stable across parent rerenders', () => {
    const view = render(<LucidTabsLayout />);
    const firstNavigatorOptions = mockNavigatorOptions;
    const firstScreenOptions = new Map(mockScreenOptions);

    view.rerender(<LucidTabsLayout />);

    expect(mockNavigatorOptions).toBe(firstNavigatorOptions);
    expect([...mockScreenOptions.keys()]).toEqual([
      'index',
      'journal',
      'programs',
      'night',
      'progress',
      'settings',
    ]);
    for (const [name, options] of firstScreenOptions) {
      expect(mockScreenOptions.get(name)).toBe(options);
    }

    expect(mockScreenOptions.get('night')).toMatchObject({ href: null, title: 'Night' });
    expect(mockScreenOptions.get('settings')).toMatchObject({ href: null, title: 'Profile' });
    expect(
      [...mockScreenOptions.values()].filter(
        (options) => (options as { href?: unknown }).href !== null
      )
    ).toHaveLength(4);
  });

  it('keeps four localized labels readable at 360 dp with enlarged text', () => {
    mockDimensions = { width: 360, height: 800, scale: 1, fontScale: 2 };
    render(<LucidTabsLayout />);

    const visible = [...mockScreenOptions.entries()].filter(
      ([, options]) => (options as { href?: unknown }).href !== null
    );
    expect(visible.map(([name]) => name)).toEqual(['index', 'journal', 'programs', 'progress']);
    for (const [, options] of visible) {
      const label = (options as {
        tabBarLabel: (input: { color: string }) => React.ReactElement;
      }).tabBarLabel({ color: '#111' });
      const props = label.props as {
        numberOfLines: number;
        maxFontSizeMultiplier: number;
        adjustsFontSizeToFit: boolean;
        minimumFontScale: number;
      };
      expect(props.numberOfLines).toBe(1);
      expect(props.maxFontSizeMultiplier).toBe(1.2);
      expect(props.adjustsFontSizeToFit).toBe(true);
      expect(props.minimumFontScale).toBe(0.85);
    }
    expect((mockNavigatorOptions as { tabBarStyle: { height: number } }).tabBarStyle.height).toBe(72);
  });
});
