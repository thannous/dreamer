/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const mockPush = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();

let capturedSubscriptionProps: any = null;

jest.doMock('expo-router', () => ({
  router: { push: mockPush },
  useFocusEffect: () => {},
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      onScrollBeginDrag,
      onScrollEndDrag,
      onMomentumScrollBegin,
      onMomentumScrollEnd,
      contentContainerStyle,
      keyboardShouldPersistTaps,
      showsVerticalScrollIndicator,
      contentInsetAdjustmentBehavior,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => (
    { children, ...props }: { children?: React.ReactNode; [key: string]: any },
  ) => React.createElement(tag, toDomProps(props), children);

  return {
    __esModule: true,
    KeyboardAvoidingView: createElement('div'),
    ScrollView: createElement('div'),
    Pressable: createElement('button'),
    Text: createElement('span'),
    View: createElement('div'),
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  };
});

jest.doMock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, _repl?: any) => key }),
}));

jest.doMock('@/constants/theme', () => ({
  Fonts: {
    fraunces: { semiBold: 'Fraunces-SemiBold', medium: 'Fraunces-Medium' },
    spaceGrotesk: {
      regular: 'SpaceGrotesk-Regular',
      medium: 'SpaceGrotesk-Medium',
      bold: 'SpaceGrotesk-Bold',
    },
  },
}));

jest.doMock('@/lib/appVersion', () => ({
  getAppVersionString: () => null,
}));

jest.doMock('@/lib/moti', () => ({
  MotiView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  MotiText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
}));

jest.doMock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => <div data-testid="atmospheric-background" />,
}));

jest.doMock('@/components/inspiration/PageHeader', () => ({
  PageHeader: ({ titleKey }: { titleKey: string }) => <div>{titleKey}</div>,
}));

jest.doMock('@/components/inspiration/SectionHeading', () => ({
  SectionHeading: () => <div data-testid="section-heading" />,
}));

jest.doMock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#6f62b5',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      textPrimary: '#fff',
      textSecondary: '#c7c2d7',
      textTertiary: '#9a93b4',
      textOnAccentSurface: '#fff',
    },
  }),
}));

jest.doMock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

jest.doMock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.doMock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/components/auth/EmailAuthCard', () => ({
  EmailAuthCard: () => <div data-testid="email-auth-card" />,
}));

jest.doMock('@/components/subscription/SubscriptionCard', () => ({
  SubscriptionCard: (props: any) => {
    capturedSubscriptionProps = props;
    return <div data-testid="subscription-card" />;
  },
}));

jest.doMock('@/components/quota/QuotaStatusCard', () => ({
  QuotaStatusCard: () => <div data-testid="quota-status-card" />,
}));

jest.doMock('@/components/ThemeSettingsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="theme-settings-card" />,
}));

jest.doMock('@/components/LanguageSettingsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="language-settings-card" />,
}));

jest.doMock('@/components/NotificationSettingsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="notification-settings-card" />,
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="icon-symbol" />,
}));

jest.doMock('react-native-reanimated', () => {
  const View = ({ children, ...props }: { children?: React.ReactNode; [key: string]: any }) => (
    <div {...props}>{children}</div>
  );
  const createAnimatedComponent = (Component: any) => {
    const AnimatedComponent = ({ children, ...props }: any) => (
      <Component {...props}>{children}</Component>
    );
    AnimatedComponent.displayName = 'ReanimatedAnimatedComponent';
    return AnimatedComponent;
  };
  return {
    default: {
      View,
      createAnimatedComponent,
    },
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

const { default: SettingsScreen } = require('../settings');

describe('Settings screen', () => {
  it('[B] Given a returning guest is blocked When rendering Then it hides subscription features', () => {
    // Given
    capturedSubscriptionProps = null;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: true });
    mockUseSubscription.mockReturnValue({
      isActive: false,
      loading: false,
      status: null,
    });

    // When
    render(<SettingsScreen />);

    // Then
    expect(screen.getByText('auth.returning_guest.title')).toBeTruthy();
    expect(screen.getByTestId('email-auth-card')).toBeTruthy();
    expect(screen.getByTestId('language-settings-card')).toBeTruthy();
    expect(screen.queryByTestId('subscription-card')).toBeNull();
    expect(screen.queryByTestId(TID.Button.SubscriptionSettingsCta)).toBeNull();
    expect(capturedSubscriptionProps).toBeNull();
  });

  it('[E] Given an invalid expiry date When rendering Then it does not show an expiry label', () => {
    // Given
    capturedSubscriptionProps = null;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockUseSubscription.mockReturnValue({
      isActive: true,
      loading: false,
      status: { expiryDate: 'not-a-date', tier: 'plus', isActive: true },
    });

    // When
    render(<SettingsScreen />);

    // Then
    expect(screen.getByTestId('subscription-card')).toBeTruthy();
    expect(capturedSubscriptionProps?.expiryLabel).toBeUndefined();
  });
});

