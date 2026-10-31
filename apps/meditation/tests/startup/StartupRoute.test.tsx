/* eslint-disable @typescript-eslint/no-require-imports -- Jest hoists module factories above imports. */
import { render, screen } from '@testing-library/react-native-legacy';
import { existsSync } from 'fs';
import { join } from 'path';
import React from 'react';

import DrawerLayout from '@/app/(drawer)/_layout';

let mockOnboarding = { loaded: true, state: { completed: true } };

jest.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => mockOnboarding,
}));
jest.mock('@/context/LanguageContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@/hooks/useChromeTheme', () => ({ useChromeTheme: () => ({ mode: 'dark' }) }));
jest.mock('@/components/navigation/DrawerContent', () => ({ DrawerContent: () => null }));
jest.mock('expo-router', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Redirect: ({ href }: { href: string }) => React.createElement(Text, { testID: 'redirect' }, href),
  };
});
jest.mock('expo-router/drawer', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Drawer = ({ children }: React.PropsWithChildren) =>
    React.createElement(View, { testID: 'drawer' }, children);
  Drawer.Screen = () => null;
  return { Drawer };
});

// iOS ignores touches while the root stack runs a transition. A startup screen at `/`
// that redirected to Home ran one at every launch, and a first tap on Home in that
// window was lost (#660). `/` now opens the drawer itself.
describe('startup route', () => {
  it('has no startup screen in the root stack', () => {
    expect(existsSync(join(__dirname, '../../app/index.tsx'))).toBe(false);
  });

  it('opens Home directly for someone who finished onboarding', () => {
    mockOnboarding = { loaded: true, state: { completed: true } };
    render(<DrawerLayout />);

    expect(screen.getByTestId('drawer')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('sends someone who has not finished onboarding to Welcome', () => {
    mockOnboarding = { loaded: true, state: { completed: false } };
    render(<DrawerLayout />);

    expect(screen.getByTestId('redirect').props.children).toBe('/welcome');
    expect(screen.queryByTestId('drawer')).toBeNull();
  });

  it('shows neither while onboarding is still being read', () => {
    mockOnboarding = { loaded: false, state: { completed: false } };
    render(<DrawerLayout />);

    expect(screen.queryByTestId('drawer')).toBeNull();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
