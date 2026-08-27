/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { StyleSheet } from 'react-native';

import DrawerLayout from '@/app/(drawer)/_layout';
import { DrawerContent } from '@/components/navigation/DrawerContent';
import { translate } from '@/lib/i18n';

const mockCloseDrawer = jest.fn();
const mockPush = jest.fn();
let capturedDrawerProps: Record<string, unknown> | undefined;

jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({
    language: 'en',
    setLanguage: async () => {},
    t: (key: string, values?: Record<string, string | number>) => {
      const { translate } = require('@/lib/i18n');
      return translate('en', key, values);
    },
  }),
}));

jest.mock('expo-blur', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    BlurView: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) =>
      React.createElement(View, { testID: 'drawer.panel', ...props }, children),
  };
});

jest.mock('expo-router', () => ({
  useRouter: () => ({
    push: mockPush,
    back: jest.fn(),
    canGoBack: () => false,
    replace: jest.fn(),
  }),
  usePathname: () => '/',
}));

jest.mock('expo-router/drawer', () => {
  const React = require('react');
  const getDrawerStatusFromState = (state: { history?: { type: string; status?: string }[]; default?: string }) => {
    const entry = state.history?.findLast?.((item) => item.type === 'drawer');
    return entry?.status ?? state.default ?? 'closed';
  };
  const Drawer = ({
    drawerContent,
    screenOptions,
    children,
  }: {
    drawerContent: (props: Record<string, unknown>) => React.ReactNode;
    screenOptions: Record<string, unknown>;
    children: React.ReactNode;
  }) => {
    capturedDrawerProps = screenOptions;
    return React.createElement(
      React.Fragment,
      null,
      drawerContent({
        navigation: { closeDrawer: mockCloseDrawer },
        state: { default: 'closed', history: [{ type: 'drawer', status: 'open' }] },
        descriptors: {},
      }),
      children
    );
  };
  function DrawerScreen() {
    return null;
  }
  Drawer.Screen = DrawerScreen;
  return { Drawer, getDrawerStatusFromState };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 12, right: 0, bottom: 24, left: 0 }),
}));

jest.mock('@/hooks/usePressMotion', () => ({
  usePressMotion: () => ({
    style: undefined,
    handlePressIn: jest.fn(),
    handlePressOut: jest.fn(),
  }),
}));

jest.mock('@/hooks/useChromeTheme', () => ({
  useChromeTheme: () => ({
    mode: 'dark',
    colors: {
      accentText: '#d4a574',
      navbarBg: 'rgba(3, 4, 13, 0.92)',
      navbarBorder: 'rgba(255,255,255,0.08)',
    },
  }),
}));

jest.mock('uniwind', () => ({
  ScopedTheme: ({ children }: React.PropsWithChildren<{ theme: string }>) => children,
  Uniwind: { setTheme: jest.fn() },
  useUniwind: () => ({ theme: 'dark' }),
  withUniwind: (Component: React.ComponentType<object>) => Component,
}));

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style) as Record<string, unknown>;
}

function meetsMinTarget(style: unknown, min = 48): boolean {
  const flat = flatten(style);
  const height = Number(flat.height ?? flat.minHeight ?? 0);
  const width = Number(flat.width ?? flat.minWidth ?? 0);
  return height >= min && (width === 0 || width >= min);
}

function drawerState(status: 'open' | 'closed') {
  return {
    default: 'closed',
    history: [{ type: 'drawer' as const, status }],
  };
}

describe('drawer modal accessibility', () => {
  beforeEach(() => {
    mockCloseDrawer.mockClear();
    mockPush.mockClear();
    capturedDrawerProps = undefined;
  });

  it('treats an open drawer as modal so TalkBack cannot leave it for the tabs', () => {
    const view = render(
      <DrawerContent
        navigation={{ closeDrawer: mockCloseDrawer } as never}
        state={drawerState('open') as never}
        descriptors={{} as never}
      />
    );

    const panel = view.getByTestId('drawer.panel');
    expect(panel.props.accessibilityViewIsModal).toBe(true);
    expect(panel.props.importantForAccessibility).toBe('yes');
  });

  it('drops the modal trap once the drawer is closed', () => {
    const view = render(
      <DrawerContent
        navigation={{ closeDrawer: mockCloseDrawer } as never}
        state={drawerState('closed') as never}
        descriptors={{} as never}
      />
    );

    const panel = view.getByTestId('drawer.panel', { includeHiddenElements: true });
    expect(panel.props.accessibilityViewIsModal).toBe(false);
    expect(panel.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('exposes labelled 48dp links and names the overlay Close the menu', () => {
    render(<DrawerLayout />);

    expect(capturedDrawerProps?.overlayAccessibilityLabel).toBe(translate('en', 'drawer.close'));

    const favorites = screen.getByLabelText(translate('en', 'favorites.title'));
    expect(favorites.props.accessibilityRole).toBe('link');
    expect(meetsMinTarget(favorites.props.style)).toBe(true);

    fireEvent.press(favorites);
    expect(mockCloseDrawer).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/favorites');
  });

  it('keeps Ready and Begin distinct in every catalogue', () => {
    expect(translate('en', 'breathe.ready')).toBe('Ready');
    expect(translate('en', 'breathe.start')).toBe('Begin');
    expect(translate('fr', 'breathe.ready')).toBe('Prêt');
    expect(translate('fr', 'breathe.start')).toBe('Commencer');
    expect(translate('de', 'breathe.ready')).toBe('Bereit');
    expect(translate('es', 'breathe.ready')).toBe('Listo');
    expect(translate('it', 'breathe.ready')).toBe('Pronto');
    expect(translate('pt', 'breathe.ready')).toBe('Pronto');
    expect(translate('de', 'breathe.start')).toBe('Beginnen');
    expect(translate('es', 'breathe.start')).toBe('Empezar');
    expect(translate('it', 'breathe.start')).toBe('Inizia');
    expect(translate('pt', 'breathe.start')).toBe('Começar');
  });
});
