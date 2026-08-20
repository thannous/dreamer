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

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    push: mockPush,
    replace: mockReplace,
  },
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

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      content: getLucidContent('en'),
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
    expect(screen.getByText('No offer available')).toBeTruthy();
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
});
