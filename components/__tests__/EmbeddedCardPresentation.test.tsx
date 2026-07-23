/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

const flattenStyle = (style: unknown) =>
  Object.assign(
    {},
    ...(Array.isArray(style) ? style : [style]).filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
    )
  );

const mockIsMockModeEnabled = jest.fn(() => false);

jest.mock('react-native', () => {
  const React = require('react');

  return {
    ActivityIndicator: () => <span />,
    Platform: { OS: 'web' },
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      disabled,
      onPress,
      style,
      testID,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { expanded?: boolean; selected?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      style?: unknown | ((state: { pressed: boolean }) => unknown);
      testID?: string;
    }) => (
      <button
        aria-expanded={accessibilityState?.expanded}
        aria-label={accessibilityLabel}
        aria-pressed={accessibilityState?.selected}
        data-testid={testID}
        data-style={JSON.stringify(flattenStyle(typeof style === 'function' ? style({ pressed: false }) : style))}
        disabled={disabled}
        onClick={onPress}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    TextInput: ({ testID }: { testID?: string }) => <input data-testid={testID} />,
    View: ({
      children,
      style,
      testID,
    }: {
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) => (
      <div data-testid={testID} data-style={JSON.stringify(flattenStyle(style))}>
        {children}
      </div>
    ),
  };
});

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { full: 999, md: 12, sm: 8, xl: 24 },
    spacing: { lg: 24, lg20: 20, md: 16, sm: 12, xl: 32, xs: 8 },
  },
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#accent' },
    action: {
      disabled: '#disabled',
      disabledBorder: '#disabled-border',
      disabledText: '#disabled-text',
      primary: '#primary',
      primaryBorder: '#primary-border',
      primaryText: '#primary-text',
    },
    status: {
      danger: { background: '#danger-bg', border: '#danger-border', icon: '#danger', text: '#danger-text' },
      warning: { text: '#warning-text' },
    },
    surface: { active: '#active', border: '#border', raised: '#raised', soft: '#soft' },
    text: { primary: '#text', secondary: '#secondary' },
  }),
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    loading: false,
    refreshUser: jest.fn(),
    setUserTierLocally: jest.fn(),
    user: null,
  }),
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreams: () => ({ dreams: [] }),
  useDreamsActions: () => ({ reloadDreams: jest.fn() }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({ language: 'en' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks/useQuota', () => ({
  useQuota: () => ({
    error: null,
    loading: false,
    quotaStatus: null,
    refetch: jest.fn(),
    tier: 'guest',
  }),
}));

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => ({
    error: null,
    loading: false,
    packages: [],
    processing: false,
    purchase: jest.fn(),
    refreshSubscription: jest.fn(),
    refreshing: false,
    requiresAuth: false,
    restore: jest.fn(),
    status: null,
  }),
}));

jest.mock('@/lib/auth', () => ({
  resendVerificationEmail: jest.fn(),
  signInMock: jest.fn(),
  signInWithEmailPassword: jest.fn(),
  signOut: jest.fn(),
  signUpWithEmailPassword: jest.fn(),
  updateUserTier: jest.fn(),
}));

jest.mock('@/lib/env', () => ({
  getExpoPublicEnvValue: jest.fn(),
  isMockModeEnabled: () => mockIsMockModeEnabled(),
}));

jest.mock('@/lib/guestLimits', () => ({
  getGuestDreamRecordingLimit: () => 3,
}));

jest.mock('@/lib/navigationIntents', () => ({
  requestStayOnSettingsIntent: jest.fn(),
}));

jest.mock('@/lib/quotaReset', () => ({
  getMonthlyQuotaPeriod: () => ({ periodEnd: new Date('2026-08-01T00:00:00Z') }),
}));

jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true }));

jest.mock('@/services/quota/GuestDreamCounter', () => ({
  getLocalDreamRecordingCount: () => Promise.resolve(0),
}));

jest.mock('@/services/subscriptionService', () => ({
  getSubscriptionStoreMode: () => 'mock',
  initializeSubscription: jest.fn(),
  loadSubscriptionPackages: jest.fn(),
}));

jest.mock('@/services/mocks/subscriptionServiceMock', () => ({
  applyMockScenario: jest.fn(),
}));

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

jest.mock('@/components/auth/EmailVerificationBanner', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/auth/EmailVerificationDialog', () => ({
  EmailVerificationPendingDialog: () => null,
  EmailVerificationSuccessDialog: () => null,
}));

jest.mock('@/components/auth/GoogleSignInButton', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@/components/icons/DreamIcons', () => ({
  EyeIcon: () => null,
  EyeOffIcon: () => null,
}));

jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: () => null,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-testid={`icon.${name}`} />,
}));

const { QuotaStatusCard } = require('@/components/quota/QuotaStatusCard');
const { SubscriptionCard } = require('@/components/subscription/SubscriptionCard');
const { SubscriptionQALab } = require('@/components/subscription/SubscriptionQALab');

const embeddedChrome = {
  backgroundColor: 'transparent',
  borderRadius: 0,
  borderWidth: 0,
  marginBottom: 0,
  padding: 0,
};

const getRootStyle = (element: React.ReactElement) => {
  const { container } = render(element);
  const root = container.firstElementChild as HTMLElement;
  return JSON.parse(root.dataset.style ?? '{}');
};

describe('embedded card presentation', () => {
  afterEach(() => {
    cleanup();
    mockIsMockModeEnabled.mockReturnValue(false);
  });

  const cases: [string, () => React.ReactElement][] = [
    ['QuotaStatusCard', () => <QuotaStatusCard presentation="embedded" />],
    [
      'SubscriptionCard',
      () => <SubscriptionCard title="Plus" features={['Feature']} presentation="embedded" />,
    ],
    ['SubscriptionQALab', () => <SubscriptionQALab presentation="embedded" />],
  ];

  it.each(cases)(
    'removes only the outer chrome from %s without forcing root flex',
    (_name: string, createElement: () => React.ReactElement) => {
      const rootStyle = getRootStyle(createElement());

      expect(rootStyle).toEqual(expect.objectContaining(embeddedChrome));
      expect(rootStyle).not.toHaveProperty('flex');
      expect(rootStyle).not.toHaveProperty('flexGrow');
    }
  );

  it('keeps card as the default presentation', () => {
    expect(getRootStyle(<SubscriptionCard title="Plus" features={['Feature']} />)).toEqual(
      expect.objectContaining({
        backgroundColor: '#raised',
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 16,
        padding: 16,
      })
    );
  });

  it('keeps the embedded QA lab compact until its accessible disclosure is opened', () => {
    mockIsMockModeEnabled.mockReturnValue(true);
    const { getByTestId, queryByText } = render(<SubscriptionQALab presentation="embedded" />);
    const toggle = getByTestId('screen.subscription.qaLab.toggle');

    expect(toggle.getAttribute('aria-label')).toBe('settings.section.subscription · QA');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(getByTestId('icon.chevron.down')).toBeTruthy();
    expect(queryByText('Mode')).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(getByTestId('icon.chevron.up')).toBeTruthy();
    expect(queryByText('Mode')).not.toBeNull();
  });

  it('exposes the current mock profile and disabled scenarios semantically', () => {
    mockIsMockModeEnabled.mockReturnValue(true);
    const { getByTestId } = render(<SubscriptionQALab presentation="embedded" />);

    fireEvent.click(getByTestId('screen.subscription.qaLab.toggle'));

    expect(
      getByTestId('btn.subscription.qa.profile.guest').getAttribute('aria-pressed')
    ).toBe('true');
    const monthlyScenario = getByTestId('btn.subscription.qa.scenario.monthly');
    expect(monthlyScenario.getAttribute('aria-pressed')).toBe('false');
    expect((monthlyScenario as HTMLButtonElement).disabled).toBe(true);
  });
});
