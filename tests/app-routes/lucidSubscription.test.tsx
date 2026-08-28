/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPurchase = jest.fn();
const mockRestore = jest.fn();
const mockRefreshSubscription = jest.fn();
const mockTrackProductEvent = jest.fn().mockResolvedValue(undefined);
let mockAnalyticsConsent = true;
let mockSubscription: Record<string, unknown>;

const packages = [
  {
    id: 'monthly',
    interval: 'monthly',
    price: 4.99,
    priceFormatted: '€4.99',
    currency: 'EUR',
  },
  {
    id: 'annual',
    interval: 'annual',
    price: 39.99,
    priceFormatted: '€39.99',
    currency: 'EUR',
  },
];

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

let mockParams: { source?: string } = {};

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  },
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  // Primitives ajoutées par C4 : le double doit suivre le composant, sinon
  // l'écran rend `undefined` et la suite tombe sur « Element type is invalid ».
  LucidIconTile: () => null,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidScreen: ({
    children,
    eyebrow,
    subtitle,
    testID,
    title,
    trailing,
  }: {
    children: React.ReactNode;
    eyebrow?: string;
    subtitle?: string;
    testID?: string;
    title?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      {trailing}
      <span>{eyebrow}</span>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </main>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidSectionHeader: ({ title, caption }: { title: string; caption?: string }) => (
    <header>
      <h2>{title}</h2>
      {caption ? <p>{caption}</p> : null}
    </header>
  ),
  LucidButton: ({
    disabled,
    label,
    loading,
    onPress,
    testID,
  }: {
    disabled?: boolean;
    label: string;
    loading?: boolean;
    onPress: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={label}
      data-testid={testID}
      disabled={disabled || loading}
      onClick={onPress}
    >
      {label}
    </button>
  ),
}));

jest.mock('@/constants/lucidTheme', () => ({
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    amber: '#9a6200',
    border: '#ccc',
    cyan: '#087f8c',
    cyanSoft: '#e4f7f7',
    danger: '#b42318',
    surface: '#fff',
    surfaceRaised: '#f4f4f4',
    success: '#067647',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'en';

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      content: getLucidContent(mockLocale),
      state: {
        onboarding: {
          analyticsConsent: mockAnalyticsConsent,
        },
      },
    }),
  };
});

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
}));

jest.mock('@/lib/analytics', () => ({
  trackProductEvent: (...args: unknown[]) => mockTrackProductEvent(...args),
}));

const { default: LucidSubscriptionScreen } = require('@/app/lucid/subscription');

function createSubscription(overrides: Record<string, unknown> = {}) {
  return {
    status: { tier: 'free', isActive: false, expiryDate: null },
    isActive: false,
    loading: false,
    processing: false,
    refreshing: false,
    error: null,
    packages,
    requiresAuth: false,
    purchase: mockPurchase,
    restore: mockRestore,
    refreshSubscription: mockRefreshSubscription,
    ...overrides,
  };
}

describe('Lucid Trainer subscription', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    mockLocale = 'en';
    mockAnalyticsConsent = true;
    mockCanGoBack.mockReturnValue(true);
    mockPurchase.mockResolvedValue({ tier: 'plus', isActive: true });
    mockRestore.mockResolvedValue({ tier: 'plus', isActive: true });
    mockRefreshSubscription.mockResolvedValue({ tier: 'free', isActive: false });
    mockSubscription = createSubscription();
  });

  afterEach(cleanup);

  it('purchases the annual offer by default and reports consented conversion states', async () => {
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByTestId('lucid-purchase'));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('annual'));
    expect(await screen.findByText('Plus is now active on this account.')).toBeTruthy();
    expect(mockTrackProductEvent).toHaveBeenCalledWith('lucid_conversion', {
      surface: 'paywall',
      action: 'started',
      tier: 'free',
    });
    expect(mockTrackProductEvent).toHaveBeenCalledWith('lucid_conversion', {
      surface: 'paywall',
      action: 'completed',
      tier: 'plus',
    });
  });

  it('lets the user select the monthly store offer', async () => {
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByTestId('lucid-plan-monthly'));
    fireEvent.click(screen.getByTestId('lucid-purchase'));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('monthly'));
  });

  it('keeps authentication inside the Lucid shell', () => {
    mockSubscription = createSubscription({ requiresAuth: true });
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByTestId('lucid-open-account'));

    expect(mockPush).toHaveBeenCalledWith('/lucid/account');
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it('renders explicit loading, error and unavailable states', () => {
    mockSubscription = createSubscription({
      loading: true,
      packages: [],
      status: null,
    });
    const { rerender } = render(<LucidSubscriptionScreen />);
    expect(screen.getByText('Loading store offers')).toBeTruthy();

    mockSubscription = createSubscription({
      error: new Error('subscription.error.network'),
      packages: [],
      status: null,
    });
    rerender(<LucidSubscriptionScreen />);

    expect(screen.getByText('Store temporarily unavailable')).toBeTruthy();
    expect(screen.queryByText('No offer available')).toBeNull();
  });

  it('keeps an empty catalog as a distinct unavailable state', () => {
    mockSubscription = createSubscription({
      packages: [],
      status: { tier: 'free', isActive: false, expiryDate: null },
    });
    render(<LucidSubscriptionScreen />);

    expect(screen.getByText('No offer available')).toBeTruthy();
    expect(screen.queryByText('Store temporarily unavailable')).toBeNull();
  });

  it('restores purchases without analytics when consent is disabled', async () => {
    mockAnalyticsConsent = false;
    mockRestore.mockResolvedValue({ tier: 'free', isActive: false });
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByTestId('lucid-restore'));

    await waitFor(() => expect(mockRestore).toHaveBeenCalledTimes(1));
    expect(
      await screen.findByText('No active Plus purchase was found for this account.')
    ).toBeTruthy();
    expect(mockTrackProductEvent).not.toHaveBeenCalled();
  });

  it('offers a recoverable status check after a store error', async () => {
    mockRefreshSubscription.mockResolvedValue({ tier: 'plus', isActive: true });
    mockSubscription = createSubscription({
      error: new Error('subscription.error.store_unavailable'),
      packages: [],
    });
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByTestId('lucid-check-subscription'));

    await waitFor(() => expect(mockRefreshSubscription).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Plus is active on this account.')).toBeTruthy();
  });

  it('falls back to Lucid settings when no previous route exists', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/settings');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('lists only current Plus benefits from the shared matrix and shows remaining free tools', () => {
    render(<LucidSubscriptionScreen />);

    expect(screen.getByText('Additional immersive scene rehearsals after the free preview')).toBeTruthy();
    expect(screen.getByText('Deeper trends and comparisons already in Noctalia')).toBeTruthy();
    expect(screen.getByText('Noctalia premium interpretation already in the journal')).toBeTruthy();
    expect(screen.getByText('The same Plus right on this account')).toBeTruthy();
    expect(screen.queryByText(/multi-week|atlas grouping|advanced transcription|multi-device/i)).toBeNull();
    expect(screen.getByText('Complete safety controls')).toBeTruthy();
    expect(screen.getByText('Night stop')).toBeTruthy();
    expect(screen.getByText('Export')).toBeTruthy();
    expect(screen.getByText('Delete')).toBeTruthy();
    expect(screen.getByText('Accessibility')).toBeTruthy();
    expect(screen.getByText('The first immersive rehearsal, complete and local')).toBeTruthy();
  });

  it('names the already lived rehearsal when opened from the feature gate', () => {
    mockParams = { source: 'dream_rehearsal' };
    render(<LucidSubscriptionScreen />);

    expect(screen.getByText('You already rehearsed one scene')).toBeTruthy();
    expect(screen.getByText(/Extra rehearsals use Plus/)).toBeTruthy();
  });

  it('does not treat an unconfirmed store return as a completed conversion', async () => {
    mockPurchase.mockResolvedValue({ tier: 'free', isActive: false });
    render(<LucidSubscriptionScreen />);

    fireEvent.click(screen.getByTestId('lucid-purchase'));

    expect(
      await screen.findByText(
        'The store returned without a confirmed Plus entitlement. Check the status or restore purchases before trying again.'
      )
    ).toBeTruthy();
    expect(mockTrackProductEvent).toHaveBeenCalledWith('lucid_conversion', {
      surface: 'paywall',
      action: 'started',
      tier: 'free',
    });
    expect(mockTrackProductEvent).not.toHaveBeenCalledWith('lucid_conversion', {
      surface: 'paywall',
      action: 'completed',
      tier: 'free',
    });
    expect(mockTrackProductEvent).not.toHaveBeenCalledWith(
      'lucid_conversion',
      expect.objectContaining({ action: 'completed' })
    );
  });

  it('names expired Plus access without treating it as an active entitlement', () => {
    mockSubscription = createSubscription({
      status: {
        tier: 'plus',
        isActive: false,
        expiryDate: '2026-01-15T00:00:00.000Z',
        willRenew: false,
      },
      isActive: false,
    });
    render(<LucidSubscriptionScreen />);

    expect(screen.getByText('Plus access ended on Jan 15, 2026')).toBeTruthy();
    expect(screen.getByText('Free plan')).toBeTruthy();
    expect(screen.queryByText('Plus active')).toBeNull();
  });

  it('keeps the same Plus and free IDs across the five locales', () => {
    const {
      LUCID_PLUS_CURRENT_BENEFIT_IDS,
      LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS,
      listLucidPlusPaywallItems,
    } = jest.requireActual('@/lib/lucid/plusEntitlements');
    const { COPY } = jest.requireActual('@/app/lucid/subscription');
    const locales = ['en', 'fr', 'es', 'de', 'it'] as const;

    expect(locales.every((locale) => COPY[locale])).toBe(true);
    for (const locale of locales) {
      const plusIds = listLucidPlusPaywallItems(
        LUCID_PLUS_CURRENT_BENEFIT_IDS,
        COPY[locale].benefits
      ).map((item: { id: string }) => item.id);
      const freeIds = listLucidPlusPaywallItems(
        LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS,
        COPY[locale].remainingFree
      ).map((item: { id: string }) => item.id);
      expect(plusIds).toEqual([...LUCID_PLUS_CURRENT_BENEFIT_IDS]);
      expect(freeIds).toEqual([...LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS]);
      expect(Object.keys(COPY[locale].benefits)).toEqual([...LUCID_PLUS_CURRENT_BENEFIT_IDS]);
      expect(Object.keys(COPY[locale].remainingFree)).toEqual([...LUCID_PLUS_PAYWALL_FREE_FEATURE_IDS]);
    }

    const { rerender } = render(<LucidSubscriptionScreen />);
    for (const locale of locales) {
      mockLocale = locale;
      rerender(<LucidSubscriptionScreen />);
      expect(screen.queryByText(/multi-week|atlas grouping|advanced transcription|multi-device/i)).toBeNull();
      for (const label of Object.values(COPY[locale].benefits) as string[]) {
        expect(screen.getByText(label)).toBeTruthy();
      }
      expect(screen.getByText(COPY[locale].remainingFree.safety)).toBeTruthy();
      expect(screen.getByText(COPY[locale].remainingFree.night_stop)).toBeTruthy();
      expect(screen.getByText(COPY[locale].remainingFree.export)).toBeTruthy();
      expect(screen.getByText(COPY[locale].remainingFree.delete)).toBeTruthy();
      expect(screen.getByText(COPY[locale].remainingFree.accessibility)).toBeTruthy();
      expect(screen.getByText(COPY[locale].remainingFree.first_immersive_rehearsal)).toBeTruthy();
    }
  });
});
