/* @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);
const mockUseSubscription = jest.fn();
const mockOpenURL = jest.fn().mockResolvedValue(undefined);

jest.doMock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
  },
  useLocalSearchParams: () => ({ trigger: 'settings' }),
}));

jest.doMock('react-native', () => {
  const React = require('react');
  const toDomProps = (props: Record<string, any>) => {
    const {
      testID,
      onPress,
      accessibilityRole,
      accessibilityLabel,
      accessibilityState,
      accessible,
      contentContainerStyle,
      contentInsetAdjustmentBehavior,
      style,
      ...rest
    } = props;
    return {
      ...rest,
      ...(testID ? { 'data-testid': testID } : {}),
      ...(onPress ? { onClick: onPress } : {}),
      ...(accessibilityRole ? { role: accessibilityRole } : {}),
      ...(accessibilityLabel ? { 'aria-label': accessibilityLabel } : {}),
      ...(accessibilityState?.checked !== undefined
        ? { 'aria-checked': accessibilityState.checked }
        : {}),
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
    ActivityIndicator: () => <span data-testid="activity-indicator" />,
    Platform: {
      OS: 'web',
      select: (values: Record<string, any>) => values?.web ?? values?.default,
    },
    Linking: {
      openURL: (...args: unknown[]) => mockOpenURL(...args),
    },
    Pressable: createElement('button'),
    ScrollView: createElement('div'),
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T) => styles,
      absoluteFill: {},
      absoluteFillObject: {},
      hairlineWidth: 1,
    },
    Text: createElement('span'),
    View: createElement('div'),
  };
});

jest.doMock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.doMock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => <div data-testid="atmospheric-background" />,
}));

jest.doMock('@/components/ScreenContainer', () => ({
  ScreenContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/components/Toast', () => ({
  Toast: ({ message, testID }: { message: string; testID?: string }) => (
    <div data-testid={testID}>{message}</div>
  ),
}));

jest.doMock('@/components/subscription/PricingOption', () => ({
  PricingOption: ({
    id,
    onPress,
    testID,
    title,
  }: {
    id: string;
    onPress?: (id: string) => void;
    testID?: string;
    title: string;
  }) => (
    <button data-testid={testID} onClick={() => onPress?.(id)}>
      {title}
    </button>
  ),
}));

jest.doMock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <span data-testid="icon-symbol" />,
}));

jest.doMock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: ({
    visible,
    subtitle,
    testID,
  }: {
    visible: boolean;
    subtitle?: string;
    testID?: string;
  }) => (visible ? <div data-testid={testID}>{subtitle}</div> : null),
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    mode: 'dark',
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
      navbarBg: '#0b0a12',
      navbarBorder: '#3a3357',
      navbarTextActive: '#fff',
      navbarTextInactive: '#9a93b4',
    },
  }),
}));

jest.doMock('@/hooks/useClearWebFocus', () => ({
  useClearWebFocus: () => {},
}));

jest.doMock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({
    formatDate: () => '1 janvier 2026',
    formatNumber: (value: number) => String(value),
    formatTime: () => '10:30',
  }),
}));

jest.doMock('@/hooks/useQuota', () => ({
  useQuota: () => ({ quotaStatus: null }),
}));

jest.doMock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockUseSubscription(),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    translationRevision: 0,
    currentLang: 'fr',
  }),
}));

const mockRequestReturnToPaywallIntent = jest.fn();
const mockClearReturnToPaywallIntent = jest.fn();
jest.doMock('@/lib/navigationIntents', () => ({
  requestReturnToPaywallIntent: mockRequestReturnToPaywallIntent,
  clearReturnToPaywallIntent: mockClearReturnToPaywallIntent,
}));

jest.doMock('@/lib/analytics', () => ({
  getPaywallTrigger: (trigger?: string) => trigger ?? 'unknown',
  trackProductEvent: mockTrackProductEvent,
}));

jest.doMock('@/lib/logger', () => ({
  createScopedLogger: () => ({
    debug: jest.fn(),
  }),
}));

const { getLegalLink } = require('@/constants/legalLinks') as typeof import('@/constants/legalLinks');
const { default: PaywallScreen } = require('@/app/paywall');

const packages = [
  {
    id: 'monthly',
    interval: 'monthly',
    price: 4.99,
    priceFormatted: '4,99 €',
    currency: 'EUR',
    title: 'Monthly',
    description: 'Monthly Plus',
  },
  {
    id: 'annual',
    interval: 'annual',
    price: 39.99,
    priceFormatted: '39,99 €',
    currency: 'EUR',
    title: 'Annual',
    description: 'Annual Plus',
  },
];

describe('Paywall screen', () => {
  beforeEach(() => {
    mockCanGoBack.mockReturnValue(true);
    mockPurchase.mockResolvedValue(undefined);
    mockRestore.mockResolvedValue(undefined);
    mockUseSubscription.mockReturnValue({
      status: { tier: 'free', isActive: false, expiryDate: null },
      isActive: false,
      loading: false,
      processing: false,
      error: null,
      packages,
      purchase: mockPurchase,
      restore: mockRestore,
      requiresAuth: false,
    });
  });

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('goes back when the paywall was opened from an existing route', () => {
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('returns to settings when there is no route to go back to', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('purchases the default annual package and confirms success', async () => {
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase));

    await waitFor(() => {
      expect(mockPurchase).toHaveBeenCalledWith('annual');
    });
    expect(mockPurchase).toHaveBeenCalledTimes(1);
    expect((await screen.findByTestId(TID.Toast.PaywallSuccess)).textContent).toBe(
      'subscription.paywall.toast.success'
    );
  });

  it('tracks the purchase funnel around a successful purchase', async () => {
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true });
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase));

    await waitFor(() => {
      expect(mockTrackProductEvent).toHaveBeenCalledWith('purchase_completed', {
        trigger: 'settings',
        plan: 'annual',
        tier: 'plus',
      });
    });
    expect(mockTrackProductEvent).toHaveBeenCalledWith('purchase_started', {
      trigger: 'settings',
      plan: 'annual',
      tier: 'free',
    });
    const purchaseFailed = mockTrackProductEvent.mock.calls.filter(([name]: unknown[]) => name === 'purchase_failed');
    expect(purchaseFailed).toHaveLength(0);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));
    const dismissed = mockTrackProductEvent.mock.calls.filter(([name]: unknown[]) => name === 'paywall_dismissed');
    expect(dismissed).toHaveLength(0);
  });

  it('tracks a cancelled purchase as purchase_failed with reason cancelled', async () => {
    const cancelled = Object.assign(new Error('Purchase was cancelled.'), { userCancelled: true });
    mockPurchase.mockRejectedValue(cancelled);
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallSelectMonthly));
    fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase));

    await waitFor(() => {
      expect(mockTrackProductEvent).toHaveBeenCalledWith('purchase_failed', {
        trigger: 'settings',
        plan: 'monthly',
        reason: 'cancelled',
      });
    });
    expect(mockTrackProductEvent).toHaveBeenCalledWith('paywall_plan_selected', {
      trigger: 'settings',
      plan: 'monthly',
      tier: 'free',
    });
  });

  it('tracks a dismissal only when the paywall is closed without a purchase', () => {
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));

    expect(mockTrackProductEvent).toHaveBeenCalledWith('paywall_dismissed', {
      trigger: 'settings',
      tier: 'free',
      plan_selected: false,
    });
  });

  it('tracks restore outcomes', async () => {
    mockRestore.mockResolvedValue({ tier: 'free', isActive: false });
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallRestore));

    await waitFor(() => {
      expect(mockTrackProductEvent).toHaveBeenCalledWith('restore_completed', {
        trigger: 'settings',
        outcome: 'nothing_to_restore',
      });
    });
  });

  it('sends a guest to the account section and remembers to come back to the paywall', () => {
    mockUseSubscription.mockReturnValue({
      status: { tier: 'free', isActive: false, expiryDate: null },
      isActive: false,
      loading: false,
      processing: false,
      error: null,
      packages,
      purchase: mockPurchase,
      restore: mockRestore,
      requiresAuth: true,
    });
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase));

    expect(mockRequestReturnToPaywallIntent).toHaveBeenCalledWith('settings', { persist: true });
    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings?section=account');
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('clears the return-to-paywall intent when the paywall is closed on purpose', () => {
    render(<PaywallScreen />);
    fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));
    expect(mockClearReturnToPaywallIntent).toHaveBeenCalled();
  });

  it('shows the free-trial CTA and footnote when the selected plan has a trial', async () => {
    mockUseSubscription.mockReturnValue({
      status: { tier: 'free', isActive: false, expiryDate: null },
      isActive: false,
      loading: false,
      processing: false,
      error: null,
      packages: [packages[0], { ...packages[1], freeTrialDays: 7 }],
      purchase: mockPurchase,
      restore: mockRestore,
      requiresAuth: false,
    });
    render(<PaywallScreen />);

    expect(screen.getByTestId(TID.Text.PaywallTrialFootnote).textContent).toBe(
      'subscription.paywall.trial_footnote'
    );
    expect(screen.getByTestId(TID.Button.PaywallPurchase).textContent).toBe(
      'subscription.paywall.button.primary.trial'
    );
  });

  it('replaces an untranslated store error with the localized generic message', () => {
    mockUseSubscription.mockReturnValue({
      status: { tier: 'free', isActive: false, expiryDate: null },
      isActive: false,
      loading: false,
      processing: false,
      error: new Error('The device or user is not allowed to make the purchase.'),
      packages,
      purchase: mockPurchase,
      restore: mockRestore,
      requiresAuth: false,
    });

    render(<PaywallScreen />);

    expect(screen.getByTestId(TID.BottomSheet.PaywallError).textContent).toBe(
      'subscription.paywall.error.message'
    );
  });

  it('exposes Terms of Use and Privacy Policy links that open getLegalLink destinations', () => {
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallTermsOfUse));
    expect(mockOpenURL).toHaveBeenCalledWith(getLegalLink('termsOfUse', 'fr'));

    fireEvent.click(screen.getByTestId(TID.Button.PaywallPrivacyPolicy));
    expect(mockOpenURL).toHaveBeenCalledWith(getLegalLink('privacyPolicy', 'fr'));
  });
});
