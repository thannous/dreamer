/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
});

const mockPush = jest.fn();
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();
let mockWindowWidth = 390;
let mockPlatformOS = 'web';

let capturedSettingsProps: any = null;

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
      style,
      ...rest
    } = props;
    const normalizedStyle = Object.assign(
      {},
      ...(Array.isArray(style) ? style : [style]).filter(
        (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
      )
    );
    return {
      ...rest,
      ...(style ? { style: normalizedStyle } : {}),
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
    };
  };
  const createElement = (tag: string) => {
    const MockNativeElement = ({
      children,
      ...props
    }: {
      children?: React.ReactNode;
      [key: string]: any;
    }) => React.createElement(tag, toDomProps(props), children);
    MockNativeElement.displayName = `MockNative${tag}`;
    return MockNativeElement;
  };

  return {
    __esModule: true,
    InteractionManager: {
      runAfterInteractions: (callback: () => void) => {
        callback();
        return { cancel: jest.fn() };
      },
    },
    KeyboardAvoidingView: createElement('div'),
    ScrollView: createElement('div'),
    Pressable: createElement('button'),
    Text: createElement('span'),
    View: createElement('div'),
    Platform: {
      get OS() {
        return mockPlatformOS;
      },
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    useWindowDimensions: () => ({
      width: mockWindowWidth,
      height: 844,
      scale: 1,
      fontScale: 1,
    }),
  };
});

jest.doMock('expo-router/js-tabs', () => ({
  useBottomTabBarHeight: () => 0,
}));

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.doMock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatDate: () => '1 janvier 2026',
    formatTime: () => '10:30',
  }),
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

jest.doMock('@/components/NoctaliaScreenHeader', () => ({
  NoctaliaScreenHeader: ({ titleKey }: { titleKey: string }) => <div>{titleKey}</div>,
}));

jest.doMock('@/components/inspiration/SectionHeading', () => ({
  SectionHeading: () => <div data-testid="section-heading" />,
}));

jest.doMock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  StaticFlatGlassCard: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'light',
    colors: {
      accent: '#6f62b5',
      accentDark: '#55479c',
      accentLight: '#988de0',
      backgroundCard: '#221b3b',
      backgroundSecondary: '#2f274f',
      backgroundDark: '#0b0a12',
      divider: '#3a3357',
      overlay: 'rgba(0,0,0,.4)',
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

jest.doMock('@/context/ScrollPerfContext', () => ({
  ScrollPerfProvider: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/hooks/useScrollIdle', () => ({
  useScrollIdle: () => ({
    isScrolling: false,
    onScrollBeginDrag: jest.fn(),
    onScrollEndDrag: jest.fn(),
    onMomentumScrollBegin: jest.fn(),
    onMomentumScrollEnd: jest.fn(),
  }),
}));

jest.doMock('@/components/auth/EmailAuthCard', () => ({
  EmailAuthCard: () => <div data-testid="email-auth-card" />,
}));

jest.doMock('@/components/quota/QuotaStatusCard', () => ({
  QuotaStatusCard: () => <div data-testid="quota-status-card" />,
}));

jest.doMock('@/components/settings/SettingsFieldGroup', () => ({
  SettingsFieldGroup: function MockSettingsFieldGroup(props: any) {
    capturedSettingsProps = props;
    return (
      <div data-testid="settings-field-group">
        {props.account}
        {props.quota}
        {!props.returningGuestBlocked ? (
          <button data-testid="settings-plus-card" onClick={props.onOpenSubscription}>
            {props.subscriptionTitle}
          </button>
        ) : null}
      </div>
    );
  },
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

const { default: SettingsScreen } = require('@/app/(tabs)/settings');

describe('Settings screen', () => {
  afterEach(() => {
    mockWindowWidth = 390;
    mockPlatformOS = 'web';
  });

  it('[B] lets the account card fill the mock-aligned editorial column', () => {
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockUseSubscription.mockReturnValue({
      isActive: false,
      loading: false,
      status: null,
    });

    render(<SettingsScreen />);

    expect(screen.getByTestId('settings-account-rn-content').style.width).toBe('100%');
    expect(screen.getByTestId('settings-quota-rn-content')).toBeTruthy();
    expect(screen.getByTestId('quota-status-card')).toBeTruthy();
    expect(capturedSettingsProps).toMatchObject({
      subscriptionTitle: 'subscription.settings.title.plus',
      subscriptionSubtitle: 'settings.plus.subtitle',
    });
  });

  it('[B] caps hosted React Native content to the centered desktop field group', () => {
    mockWindowWidth = 1440;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockUseSubscription.mockReturnValue({
      isActive: false,
      loading: false,
      status: null,
    });

    render(<SettingsScreen />);

    expect(screen.getByTestId('settings-account-rn-content').style.width).toBe('100%');
  });

  it('[B] keeps the Android clipping guard while using the full card width', () => {
    mockPlatformOS = 'android';
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockUseSubscription.mockReturnValue({
      isActive: false,
      loading: false,
      status: null,
    });

    render(<SettingsScreen />);

    const accountContent = screen.getByTestId('settings-account-rn-content');
    expect(accountContent.style.width).toBe('100%');
    expect(accountContent.style.paddingBottom).toBe('24px');
  });

  it('[B] Given a returning guest is blocked When rendering Then it hides subscription features', () => {
    // Given
    capturedSettingsProps = null;
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
    expect(capturedSettingsProps?.returningGuestBlocked).toBe(true);
    expect(screen.queryByTestId('settings-plus-card')).toBeNull();
  });

  it('[B] Given a free user When rendering Then the compact Plus card opens the paywall', () => {
    // Given
    capturedSettingsProps = null;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockUseSubscription.mockReturnValue({
      isActive: false,
      loading: false,
      status: null,
    });

    // When
    render(<SettingsScreen />);

    // Then
    expect(screen.getByTestId('settings-plus-card')).toBeTruthy();
    expect(capturedSettingsProps).toMatchObject({
      subscriptionTitle: 'subscription.settings.title.plus',
      subscriptionSubtitle: 'settings.plus.subtitle',
    });
    screen.getByTestId('settings-plus-card').click();
    expect(mockPush).toHaveBeenCalledTimes(1);
  });

  it('[E] keeps the mock copy stable for active subscriptions', () => {
    // Given
    capturedSettingsProps = null;
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
    mockUseSubscription.mockReturnValue({
      isActive: true,
      loading: false,
      status: { expiryDate: 'not-a-date', tier: 'plus', isActive: true },
    });

    // When
    render(<SettingsScreen />);

    // Then
    expect(screen.getByTestId('settings-plus-card').textContent).toBe(
      'subscription.settings.title.plus'
    );
  });
});
