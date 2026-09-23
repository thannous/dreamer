/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

afterEach(() => {
  cleanup();
  jest.clearAllMocks();
  mockParams = {};
});

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = true;
const mockUseAuth = jest.fn();
const mockUseSubscription = jest.fn();
const mockResetGuestRecordingAllowance = jest.fn(async () => 1);
let mockWindowWidth = 390;
let mockPlatformOS = 'web';

let capturedSettingsProps: any = null;
let mockParams: { auth?: string; section?: string } = {};
let mockInitialAccountSheetOpen = false;

jest.doMock('expo-router', () => ({
  router: { push: mockPush, back: mockBack, replace: mockReplace, canGoBack: () => mockCanGoBack },
  useFocusEffect: () => {},
  useLocalSearchParams: () => mockParams,
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
    ActivityIndicator: createElement('div'),
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
  useTranslation: () => ({
    t: (key: string, replacements?: Record<string, string>) =>
      key === 'settings.app_version'
        ? `Version ${replacements?.version}`
        : key,
  }),
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
  getAppVersionString: () => '3.0.1 (42)',
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
  NoctaliaScreenHeader: ({ titleKey, actions = [] }: any) => <div>{titleKey}{actions.map((action: any) => <button key={action.testID} data-testid={action.testID} onClick={action.onPress} />)}</div>,
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
      accentText: '#55479c',
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
  EmailAuthCard: ({ initialAccountSheetOpen, presentation }: any) => { mockInitialAccountSheetOpen = initialAccountSheetOpen; return <div data-testid="email-auth-card" data-presentation={presentation} />; },
}));

jest.doMock('@/components/quota/QuotaStatusCard', () => ({
  QuotaStatusCard: ({ onUpgradePress }: { onUpgradePress?: () => void }) =>
    <button data-testid="quota-status-card" onClick={onUpgradePress}>subscription-options</button>,
}));

jest.doMock('@/components/settings/LegalSection', () => ({
  LegalSection: () => <div data-testid="legal-section" />,
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

jest.doMock('@/services/voiceLiveSpikeStorage', () => ({
  loadDebugEnabled: jest.fn(async () => false),
  loadFeatureEnabled: jest.fn(async () => false),
  saveDebugEnabled: jest.fn(async () => undefined),
  saveFeatureEnabled: jest.fn(async () => undefined),
}));

jest.doMock('@/services/quota/GuestDreamCounter', () => ({
  resetGuestDreamRecordingAllowanceForDev: () => mockResetGuestRecordingAllowance(),
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

const { default: SettingsScreen } = require('@/app/settings');
const { VOICE_LIVE_SPIKE_TEST_IDS } = require('@/lib/voiceLiveSpikeHost');
const { withDevFlag } = require('@/tests/setDevFlag');

describe('Settings screen', () => {
  let restoreDevFlag: (() => void) | undefined;

  beforeEach(() => {
    restoreDevFlag = withDevFlag(false);
  });

  afterEach(() => {
    restoreDevFlag?.();
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

    expect(screen.getByTestId('settings-account-rn-content').className).toContain('w-full');
    expect(screen.getByTestId('settings-quota-rn-content')).toBeTruthy();
    expect(screen.getByTestId('quota-status-card')).toBeTruthy();
    expect(capturedSettingsProps).toMatchObject({
      appVersionLabel: 'Version 3.0.1 (42)',
      subscriptionTitle: 'subscription.settings.title.plus',
      subscriptionSubtitle: 'settings.plus.subtitle',
    });
    expect(screen.queryByTestId(VOICE_LIVE_SPIKE_TEST_IDS.debugEntry)).toBeNull();
    expect(screen.queryByTestId('guest-recording-qa-reset')).toBeNull();
  });

  it('offers a guest-only dev reset that reports the preserved dream count', async () => {
    restoreDevFlag?.();
    restoreDevFlag = withDevFlag(true);
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false, user: null });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    render(<SettingsScreen />);
    fireEvent.click(screen.getByTestId('guest-recording-qa-reset-button'));

    await waitFor(() => expect(mockResetGuestRecordingAllowance).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('guest-recording-qa-reset-result').textContent).toContain('4 rêves'));
  });

  it('does not offer the guest reset to a signed-in developer', () => {
    restoreDevFlag?.();
    restoreDevFlag = withDevFlag(true);
    mockUseAuth.mockReturnValue({ returningGuestBlocked: false, user: { id: 'user-1' } });
    mockUseSubscription.mockReturnValue({ isActive: false, loading: false, status: null });

    render(<SettingsScreen />);
    expect(screen.queryByTestId('guest-recording-qa-reset')).toBeNull();
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

    expect(screen.getByTestId('settings-account-rn-content').className).toContain('w-full');
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

    // Uniwind resolves `className` in the Metro transformer, which Jest never runs, so
    // the classes assert the intent: full width, plus the Android clipping guard.
    const accountContent = screen.getByTestId('settings-account-rn-content');
    expect(accountContent.className).toContain('w-full');
    expect(accountContent.className).toContain('pb-6');
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


it.each([true, false])('returns to the calling screen with a safe direct-link fallback (history=%s)', (hasHistory: boolean) => {
  mockCanGoBack = hasHistory;
  mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
  render(<SettingsScreen />);
  fireEvent.click(screen.getByTestId('settings.back'));
  if (hasHistory) expect(mockBack).toHaveBeenCalledTimes(1);
  else expect(mockReplace).toHaveBeenCalledWith('/');
});


it('opens the account form for the drawer sign-in entry', () => {
  mockParams = { auth: 'signin' };
  mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
  render(<SettingsScreen />);
  expect(mockInitialAccountSheetOpen).toBe(true);
});


it('includes subscription access in the account without general preferences', () => {
  mockParams = { section: 'account' };
  mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
  render(<SettingsScreen />);
  expect(screen.getByTestId('settings-account-only')).toBeTruthy();
  expect(screen.getByTestId('email-auth-card')).toBeTruthy();
  expect(screen.queryByTestId('settings-field-group')).toBeNull();
  expect(screen.getByTestId('settings-quota-rn-content')).toBeTruthy();
  fireEvent.click(screen.getByTestId('quota-status-card'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/paywall', params: { trigger: 'settings' } });
  expect(mockInitialAccountSheetOpen).toBeFalsy();
});

it.each(['signup', 'signin'])('opens the requested %s form directly without a second account action or sheet', (auth: string) => {
  mockCanGoBack = true;
  mockBack.mockClear();
  mockParams = { section: 'account', auth };
  mockUseAuth.mockReturnValue({ returningGuestBlocked: false });
  render(<SettingsScreen />);
  expect(screen.getByTestId('email-auth-card').getAttribute('data-presentation')).toBe('card');
  expect(mockInitialAccountSheetOpen).toBeFalsy();
  expect(screen.queryByTestId('settings-quota-rn-content')).toBeNull();
  fireEvent.click(screen.getByTestId('settings.back'));
  expect(mockBack).toHaveBeenCalledTimes(1);
});
it('preserves the authentication recovery surface for a blocked returning guest', () => {
  mockParams = { section: 'account' };
  mockUseAuth.mockReturnValue({ returningGuestBlocked: true });
  render(<SettingsScreen />);
  expect(screen.queryByTestId('settings-account-only')).toBeNull();
  expect(screen.getByTestId('settings-field-group')).toBeTruthy();
});
