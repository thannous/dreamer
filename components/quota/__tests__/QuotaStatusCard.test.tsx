/**
 * @jest-environment jsdom
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import React from 'react';

import type { QuotaStatus, SubscriptionStatus } from '@/lib/types';
import { TID } from '@/lib/testIDs';

const flattenStyle = (style: unknown) =>
  Object.assign(
    {},
    ...(Array.isArray(style) ? style : [style]).filter(
      (entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object'
    )
  );

let mockQuota: {
  quotaStatus: QuotaStatus | null;
  loading: boolean;
  error: Error | null;
  refetch: () => void;
  tier: 'guest' | 'free' | 'plus';
  subscriptionStatus?: SubscriptionStatus | null;
  subscriptionLoading?: boolean;
  refreshSubscription?: () => Promise<void>;
};

jest.mock('react-native', () => {
  const React = require('react');
  return {
    ActivityIndicator: () => <span />,
    Platform: { OS: 'web' },
    Pressable: ({
      children,
      onPress,
      testID,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
    Text: ({
      children,
      testID,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      testID?: string;
      accessibilityLabel?: string;
    }) => (
      <span data-testid={testID} aria-label={accessibilityLabel}>
        {children}
      </span>
    ),
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

jest.mock('@/components/motion', () => ({
  ProgressFill: () => <div data-testid="progress-fill" />,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
  }),
}));

jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({ formatDate: () => '1 August 2026' }),
}));

jest.mock('@/hooks/useQuota', () => ({
  useQuota: () => mockQuota,
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { base: '#accent', text: '#accent' },
    action: {
      primary: '#primary',
      primaryBorder: '#primary-border',
      primaryText: '#primary-text',
    },
    status: {
      danger: { background: '#danger-bg', border: '#danger-border', text: '#danger-text' },
    },
    surface: { border: '#border', raised: '#raised', soft: '#soft' },
    text: { primary: '#text', secondary: '#secondary' },
  }),
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { xl: 24 },
    spacing: { lg20: 20 },
  },
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

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const mockPresentCustomerCenter = jest.fn();
jest.mock('@/services/subscriptionService', () => ({ manageSubscription: () => mockPresentCustomerCenter() }));

jest.mock('@/lib/logger', () => ({
  createScopedLogger: () => ({ warn: jest.fn() }),
}));

const { QuotaStatusCard } = require('../QuotaStatusCard');

const guestStatus = (imageUsed: number, analysisUsed = 0): QuotaStatus => ({
  tier: 'guest',
  canAnalyze: analysisUsed < 2,
  canExplore: true,
  canGenerateImage: imageUsed < 2,
  usage: {
    analysis: { used: analysisUsed, limit: 2, remaining: Math.max(2 - analysisUsed, 0) },
    exploration: { used: 0, limit: null, remaining: null },
    messages: { used: 0, limit: 10, remaining: 10 },
    image: { used: imageUsed, limit: 2, remaining: Math.max(2 - imageUsed, 0) },
  },
});

describe('QuotaStatusCard illustration row', () => {
  beforeEach(() => {
    require('react-native').Platform.OS = 'web';
    mockPresentCustomerCenter.mockReset();
    mockQuota = {
      quotaStatus: guestStatus(1, 2),
      loading: false,
      error: null,
      refetch: jest.fn(),
      tier: 'guest',
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a distinct illustration row for guests without calling it an interpretation', () => {
    render(<QuotaStatusCard />);

    expect(screen.getByTestId(TID.Quota.ImageValue).textContent).toBe('1 / 2');
    expect(screen.getByTestId('quota.analysisValue').textContent).toBe('2 / 2');
    expect(screen.getByLabelText('settings.quota.image_label: 1 / 2')).toBeTruthy();
    expect(screen.getByText('settings.quota.image_label')).toBeTruthy();
    expect(screen.queryByLabelText(/interpretation/i)).toBeNull();
  });

  it('does not show a monthly illustration credit row for authenticated free', () => {
    mockQuota = {
      quotaStatus: {
        tier: 'free',
        canAnalyze: true,
        canExplore: true,
        canGenerateImage: false,
        usage: {
          analysis: { used: 1, limit: 3, remaining: 2 },
          exploration: { used: 0, limit: null, remaining: null },
          messages: { used: 0, limit: 10, remaining: 10 },
          image: { used: 0, limit: 0, remaining: 0 },
        },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      tier: 'free',
    };

    render(<QuotaStatusCard />);

    expect(screen.queryByTestId(TID.Quota.ImageValue)).toBeNull();
    expect(screen.getByTestId('quota.analysisValue')).toBeTruthy();
  });

  it('shows unlimited illustrations for plus', () => {
    mockQuota = {
      quotaStatus: {
        tier: 'plus',
        canAnalyze: true,
        canExplore: true,
        canGenerateImage: true,
        usage: {
          analysis: { used: 0, limit: null, remaining: null },
          exploration: { used: 0, limit: null, remaining: null },
          messages: { used: 0, limit: 20, remaining: 20 },
          image: { used: 0, limit: null, remaining: null },
        },
      },
      loading: false,
      error: null,
      refetch: jest.fn(),
      tier: 'plus',
    };

    render(<QuotaStatusCard />);

    expect(screen.getByTestId(TID.Quota.ImageValue).textContent).toBe('recording.quota.unlimited');
  });
  it('shows an error when subscription management fails, then clears it on retry', async () => {
    require('react-native').Platform.OS = 'android';
    mockQuota = { ...mockQuota, tier: 'plus' };
    mockPresentCustomerCenter.mockRejectedValueOnce(new Error('store unavailable')).mockResolvedValueOnce(undefined);
    render(<QuotaStatusCard />);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.ManageSubscription)); });
    expect(screen.getByText('subscription.error.manage_failed')).toBeTruthy();
    expect(mockPresentCustomerCenter).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByTestId(TID.Button.ManageSubscription)); });
    expect(screen.queryByText('subscription.error.manage_failed')).toBeNull();
  });

  it('keeps the upgrade action available for an expired subscription when quota loading fails', () => {
    const onUpgradePress = jest.fn();
    mockQuota = {
      ...mockQuota,
      tier: 'free',
      quotaStatus: null,
      error: new Error('quota unavailable'),
      subscriptionLoading: false,
      subscriptionStatus: { tier: 'free', isActive: false, expiryDate: '2020-01-01T00:00:00Z' },
    };
    render(<QuotaStatusCard onUpgradePress={onUpgradePress} />);
    expect(screen.getByTestId('subscription-expired-notice')).toBeTruthy();
    expect(screen.getByText('settings.quota.subtitle', { exact: false }).textContent).toContain('settings.quota.tier.free');
    fireEvent.click(screen.getByText('settings.quota.cta_upgrade'));
    expect(onUpgradePress).toHaveBeenCalledTimes(1);
  });

  it.each(['loading', 'unavailable', 'active'] as const)('does not offer another subscription while status is %s', (state: 'loading' | 'unavailable' | 'active') => {
    mockQuota = {
      ...mockQuota,
      tier: state === 'active' ? 'plus' : 'free',
      subscriptionLoading: state === 'loading',
      subscriptionStatus: state === 'active' ? { tier: 'plus', isActive: true } : null,
      refreshSubscription: jest.fn(async () => undefined),
    };
    render(<QuotaStatusCard />);
    expect(screen.queryByText('settings.quota.cta_upgrade')).toBeNull();
    if (state === 'active') expect(screen.getByText('settings.quota.plus_message')).toBeTruthy();
    else expect(screen.queryByText('settings.quota.subtitle', { exact: false })).toBeNull();
    if (state === 'loading') expect(screen.getByText('settings.quota.subscription_checking')).toBeTruthy();
    if (state === 'unavailable') {
      fireEvent.click(screen.getByText('settings.quota.subscription_unavailable'));
      expect(mockQuota.refreshSubscription).toHaveBeenCalledTimes(1);
    }
  });

  it('keeps an unavailable subscription retry usable after a refresh rejection', async () => {
    mockQuota = {
      ...mockQuota, tier: 'free', subscriptionStatus: null,
      refreshSubscription: jest.fn(async () => { throw new Error('offline'); }),
    };
    render(<QuotaStatusCard />);
    await act(async () => { fireEvent.click(screen.getByText('settings.quota.subscription_unavailable')); });
    expect(screen.getByText('settings.quota.subscription_unavailable')).toBeTruthy();
    expect(screen.queryByText('settings.quota.cta_upgrade')).toBeNull();
    expect(mockQuota.refreshSubscription).toHaveBeenCalledTimes(1);
  });

});
