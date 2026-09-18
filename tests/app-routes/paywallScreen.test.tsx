/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

let mockParams: Record<string, string> = { trigger: 'settings' };
let mockUser = { id: 'user-1' };
jest.doMock('@/context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));

let mockHardwareBack: (() => boolean) | undefined;
const mockPreventRemove = jest.fn((_prevent: boolean, _callback: () => void) => undefined);
jest.doMock('expo-router/react-navigation', () => ({ usePreventRemove: mockPreventRemove }));

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockDismissTo = jest.fn();
const mockRefreshSubscription = jest.fn();
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
    dismissTo: mockDismissTo,
  },
  useLocalSearchParams: () => mockParams,
  useFocusEffect: (callback: () => void | (() => void)) => {
    require('react').useEffect(callback, [callback]);
  },
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
    BackHandler: { addEventListener: (_name: string, callback: () => boolean) => {
      mockHardwareBack = callback;
      return { remove: () => { mockHardwareBack = undefined; } };
    } },
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
    mockParams = { trigger: 'settings' };
    mockUser = { id: 'user-1' };
    mockCanGoBack.mockReturnValue(true);
    mockPurchase.mockResolvedValue(undefined);
    mockRestore.mockResolvedValue(undefined);
    mockRefreshSubscription.mockReset().mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true, storeActive: true });
    mockUseSubscription.mockReturnValue({
      status: { tier: 'free', isActive: false, expiryDate: null },
      isActive: false,
      loading: false,
      processing: false,
      error: null,
      packages,
      purchase: mockPurchase,
      restore: mockRestore,
      refreshSubscription: mockRefreshSubscription,
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

  it.each(['close', 'view', 'system-back', 'android-root-back'])('returns directly to the saved dream on %s after capture', async (action: string) => {
    mockParams = { trigger: 'analysis_cta', afterSave: '1', dreamId: '42', dreamRemoteId: '17', dreamClientRequestId: 'capture-42', dreamOwnerId: 'user-1' };
    if (action === 'android-root-back') mockCanGoBack.mockReturnValue(false);
    render(<PaywallScreen />);
    await act(async () => {
      if (action === 'android-root-back') {
        expect(mockHardwareBack?.()).toBe(true);
      } else if (action === 'system-back') {
        const [prevent, callback] = mockPreventRemove.mock.calls.at(-1)!;
        expect(prevent).toBe(true);
        callback();
      } else {
        fireEvent.click(action === 'close' ? screen.getByTestId(TID.Button.PaywallClose) : screen.getByText('recording.analysis_offer.view'));
      }
    });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: { id: '42', remoteId: '17', clientRequestId: 'capture-42' } });
    expect(mockPreventRemove.mock.calls.at(-1)?.[0]).toBe(false);
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('returns to settings when there is no route to go back to', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));

    expect(mockReplace).toHaveBeenCalledWith('/settings');
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

  it('shows the saved dream, analysis, illustration, plans and purchase together without a comparison step', () => {
    mockParams = { trigger: 'analysis_cta', dreamId: '42', dreamOwnerId: 'user-1' };
    render(<PaywallScreen />);
    expect(screen.getByText('recording.saved_analysis.title')).toBeTruthy();
    expect(screen.getByText('subscription.paywall.saved_dream.analysis')).toBeTruthy();
    expect(screen.getByText('subscription.paywall.saved_dream.illustration')).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PaywallSelectMonthly)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PaywallSelectAnnual)).toBeTruthy();
    expect(screen.getByTestId(TID.Button.PaywallPurchase).textContent).toBe('subscription.paywall.saved_dream.cta');
    expect(screen.queryByText('subscription.paywall.comparison.free')).toBeNull();
    fireEvent.click(screen.getByText('recording.analysis_offer.view'));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it.each(['purchase', 'restore'])('returns to the same dream after a confirmed %s', async (action: string) => {
    mockParams = { trigger: 'analysis_cta', afterSave: '1', dreamId: '42', dreamRemoteId: '17', dreamClientRequestId: 'request-42', dreamOwnerId: 'user-1' };
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true, storeActive: true });
    mockRestore.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true, storeActive: true });
    render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(action === 'purchase' ? TID.Button.PaywallPurchase : TID.Button.PaywallRestore)); });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/journal/[id]',
      params: { id: '42', remoteId: '17', clientRequestId: 'request-42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' },
    });
  });

  it('dispatches the purchase destination once while route params and entitlement rerender', async () => {
    mockParams = { trigger: 'analysis_cta', afterSave: '1', dreamId: '42', dreamOwnerId: 'user-1' };
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true });
    const view = render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase)); });
    mockParams = { ...mockParams };
    const previous = mockUseSubscription.mock.results.at(-1)?.value as Record<string, unknown>;
    mockUseSubscription.mockReturnValue({ ...previous, isActive: true, status: { tier: 'plus', isActive: true } });
    view.rerender(<PaywallScreen />);
    mockParams = { ...mockParams };
    view.rerender(<PaywallScreen />);
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockDismissTo).not.toHaveBeenCalled();
    expect(mockBack).not.toHaveBeenCalled();
  });

  it.each(['cancelled', 'inactive', 'account-change'])('does not resume a dream after %s', async (outcome: string) => {
    mockParams = { trigger: 'analysis_cta', dreamId: '42', dreamOwnerId: 'user-1' };
    if (outcome === 'cancelled') mockPurchase.mockRejectedValue(Object.assign(new Error('Cancelled'), { userCancelled: true }));
    else mockPurchase.mockResolvedValue({ tier: outcome === 'inactive' ? 'free' : 'plus', isActive: outcome !== 'inactive' });
    if (outcome === 'account-change') mockUser = { id: 'other' };
    render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase)); });
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('closing the contextual offer does not request analysis', async () => {
    mockParams = { trigger: 'analysis_cta', dreamId: '42', dreamOwnerId: 'user-1' };
    render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.PaywallClose)); });
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it.each(['purchase', 'restore'])('waits for server confirmation before resuming %s and retries without buying again', async (action: string) => {
    mockParams = { trigger: 'analysis_cta', afterSave: '1', dreamId: '42', dreamOwnerId: 'user-1' };
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: false, storeActive: true });
    mockRestore.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: false, storeActive: true });
    mockRefreshSubscription.mockRejectedValueOnce(new Error('offline'));
    render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(action === 'purchase' ? TID.Button.PaywallPurchase : TID.Button.PaywallRestore)); });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockDismissTo).not.toHaveBeenCalled();
    expect(screen.getByText('subscription.paywall.activation_pending')).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase)); });
    expect(mockRefreshSubscription).toHaveBeenCalledTimes(2);
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ pathname: '/journal/[id]' }));
    expect(mockPurchase).toHaveBeenCalledTimes(action === 'purchase' ? 1 : 0);
    expect(mockRestore).toHaveBeenCalledTimes(action === 'restore' ? 1 : 0);
  });

  it.each(['purchase', 'restore'])('blocks close and every back path while %s is in progress', async (action: string) => {
    mockParams = { trigger: 'analysis_cta', afterSave: '1', dreamId: '42', dreamOwnerId: 'user-1' };
    let finish!: (value: any) => void;
    (action === 'purchase' ? mockPurchase : mockRestore).mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(action === 'purchase' ? TID.Button.PaywallPurchase : TID.Button.PaywallRestore)); });
    expect((screen.getByTestId(TID.Button.PaywallClose) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      fireEvent.click(screen.getByTestId(TID.Button.PaywallClose));
      expect(mockHardwareBack?.()).toBe(true);
      const [blocked, callback] = mockPreventRemove.mock.calls.at(-1)!;
      expect(blocked).toBe(true);
      callback();
    });
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
    await act(async () => { finish({ tier: 'plus', isActive: true, serverConfirmed: true, storeActive: true }); });
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith(expect.objectContaining({ params: expect.objectContaining({ analyzeAfterPurchase: '1' }) }));
  });

  it.each(['purchase', 'restore'])('dismisses back to the existing detail after %s without replacing it with a duplicate', async (action: string) => {
    mockParams = { trigger: 'analysis_cta', dreamId: '42', dreamOwnerId: 'user-1' };
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true });
    mockRestore.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true });
    render(<PaywallScreen />);
    await act(async () => { fireEvent.click(screen.getByTestId(action === 'purchase' ? TID.Button.PaywallPurchase : TID.Button.PaywallRestore)); });
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockDismissTo).toHaveBeenCalledWith({ pathname: '/journal/[id]', params: { id: '42', analyzeAfterPurchase: '1', analysisOwnerId: 'user-1' } });
  });

  it('tracks the purchase funnel around a successful purchase', async () => {
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true, serverConfirmed: true, storeActive: true });
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
      refreshSubscription: mockRefreshSubscription,
      requiresAuth: true,
    });
    render(<PaywallScreen />);

    fireEvent.click(screen.getByTestId(TID.Button.PaywallPurchase));

    expect(mockRequestReturnToPaywallIntent).toHaveBeenCalledWith('settings', { persist: true });
    expect(mockReplace).toHaveBeenCalledWith('/settings?section=account');
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
      refreshSubscription: mockRefreshSubscription,
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
      refreshSubscription: mockRefreshSubscription,
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
  it.each([
    ['expired', false, '2020-01-01T12:00:00Z', true],
    ['new free account', false, null, false],
    ['active non-renewing plan', true, '2099-01-01T12:00:00Z', false],
  ] as const)('shows the expiration explanation only for %s', (_label: string, active: boolean, expiryDate: string | null, visible: boolean) => {
    mockUseSubscription.mockReturnValue({
      status: { tier: active ? 'plus' : 'free', isActive: active, expiryDate, willRenew: false },
      isActive: active, loading: false, processing: false, error: null,
      packages, purchase: mockPurchase, restore: mockRestore, requiresAuth: false,
    });
    render(<PaywallScreen />);
    expect(Boolean(screen.queryByTestId('subscription-expired-notice'))).toBe(visible);
  });

});
