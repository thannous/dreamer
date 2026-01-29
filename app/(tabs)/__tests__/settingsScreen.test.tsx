/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TID } from '@/lib/testIDs';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const mockPush = vi.fn();
const mockUseAuth = vi.fn();
const mockUseSubscription = vi.fn();

let capturedSubscriptionProps: any = null;

vi.mock('expo-router', () => ({
  router: { push: mockPush },
  useFocusEffect: (cb: () => void | (() => void)) => {
    React.useEffect(() => {
      const cleanup = cb();
      return typeof cleanup === 'function' ? cleanup : undefined;
    }, [cb]);
  },
}));

vi.mock('@react-navigation/bottom-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

vi.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string, _repl?: any) => key }),
}));

vi.mock('@/context/ThemeContext', () => ({
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

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

vi.mock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/auth/EmailAuthCard', () => ({
  EmailAuthCard: () => <div data-testid="email-auth-card" />,
}));

vi.mock('@/components/subscription/SubscriptionCard', () => ({
  SubscriptionCard: (props: any) => {
    capturedSubscriptionProps = props;
    return <div data-testid="subscription-card" />;
  },
}));

vi.mock('@/components/quota/QuotaStatusCard', () => ({
  QuotaStatusCard: () => <div data-testid="quota-status-card" />,
}));

vi.mock('@/components/ThemeSettingsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="theme-settings-card" />,
}));

vi.mock('@/components/LanguageSettingsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="language-settings-card" />,
}));

vi.mock('@/components/NotificationSettingsCard', () => ({
  __esModule: true,
  default: () => <div data-testid="notification-settings-card" />,
}));

vi.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="icon-symbol" />,
}));

vi.mock('react-native-reanimated', () => {
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

const { default: SettingsScreen } = await import('../settings');

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
