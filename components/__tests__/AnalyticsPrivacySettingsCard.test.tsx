/* @jest-environment jsdom */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockGetPreference = jest.fn();
const mockIsAvailable = jest.fn();
const mockSetEnabled = jest.fn();

jest.doMock('react-native', () => ({
  ActivityIndicator: () => <span data-testid="analytics-loading" />,
  Platform: {
    OS: 'web',
    select: (options: Record<string, unknown>) => options.web ?? options.default,
  },
  StyleSheet: { create: <T extends Record<string, unknown>>(styles: T) => styles },
  Switch: ({
    accessibilityLabel,
    disabled,
    onValueChange,
    testID,
    value,
  }: {
    accessibilityLabel?: string;
    disabled?: boolean;
    onValueChange?: (value: boolean) => void;
    testID?: string;
    value?: boolean;
  }) => (
    <input
      aria-label={accessibilityLabel}
      checked={value}
      data-testid={testID}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.target.checked)}
      type="checkbox"
    />
  ),
  Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

jest.doMock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    accent: { strong: '#9a6332' },
    status: { danger: { text: '#a00' } },
    surface: { border: '#ddd', raised: '#fff' },
    text: { primary: '#231f2d', secondary: '#777' },
  }),
}));

jest.doMock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      bold: 'SpaceGrotesk-Bold',
      medium: 'SpaceGrotesk-Medium',
      regular: 'SpaceGrotesk-Regular',
    },
  },
}));

jest.doMock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.doMock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.doMock('@/lib/productAnalytics', () => ({
  getProductAnalyticsPreference: () => mockGetPreference(),
  isProductAnalyticsAvailable: () => mockIsAvailable(),
  setProductAnalyticsEnabled: (enabled: boolean) => mockSetEnabled(enabled),
}));

const { AnalyticsPrivacySettingsCard } = require('@/components/AnalyticsPrivacySettingsCard');

describe('AnalyticsPrivacySettingsCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPreference.mockResolvedValue('enabled');
    mockIsAvailable.mockReturnValue(false);
    mockSetEnabled.mockResolvedValue(undefined);
  });

  it('keeps the audience measurement preference visible when collection is inactive', async () => {
    render(<AnalyticsPrivacySettingsCard />);

    const toggle = await screen.findByTestId('settings-analytics-privacy-toggle');
    expect(screen.getByText('analytics.privacy.toggle_label')).toBeTruthy();
    expect(screen.getByText('analytics.privacy.unavailable')).toBeTruthy();
    expect((toggle as HTMLInputElement).checked).toBe(true);

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(mockSetEnabled).toHaveBeenCalledWith(false);
    });
  });
});
