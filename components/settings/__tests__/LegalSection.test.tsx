import React from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native-legacy';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { LegalSection } from '@/components/settings/LegalSection';
import {
  finalizeAccountDeletion,
  requestAccountDeletion,
} from '@/services/accountDeletionService';

let mockUser: { id: string } | null = { id: 'user-1' };

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    currentLang: 'fr',
    translationRevision: 0,
  }),
}));

jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    surface: { raised: '#fff', borderStrong: '#000', border: '#000', soft: '#eee' },
    text: { primary: '#000', secondary: '#111', tertiary: '#222' },
    accent: { base: '#333', text: '#333'},
    status: { danger: { background: '#f00', border: '#f00', text: '#f00', icon: '#f00' } },
    action: { primary: '#000', primaryText: '#fff' },
  }),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => null,
}));

jest.mock('@/services/accountDeletionService', () => ({
  requestAccountDeletion: jest.fn(),
  finalizeAccountDeletion: jest.fn(),
}));

let mockAnalyticsAvailable = true;
const mockAnalyticsToggle = jest.fn(async () => {});
jest.mock('@/components/settings/useAnalyticsPreferenceController', () => ({
  useAnalyticsPreferenceController: () => ({
    title: 'analytics.privacy.title',
    description: 'analytics.privacy.description',
    toggleLabel: 'analytics.privacy.toggle_label',
    status: 'analytics.privacy.enabled',
    errorMessage: 'analytics.privacy.error',
    available: mockAnalyticsAvailable,
    enabled: true,
    loading: false,
    saving: false,
    error: false,
    toggle: mockAnalyticsToggle,
  }),
}));

// Stability reports exist only in a native build; lib/observe's own test covers them.
jest.mock('@/components/settings/useStabilityReportsController', () => ({
  useStabilityReportsController: () => ({ available: false }),
}));

// The AI permission row is proven by the dreamer-ai-consent-settings web journey.
jest.mock('@/components/settings/useAiConsentController', () => ({
  useAiConsentController: () => ({ enabled: true, loading: false, saving: false, error: false, toggle: jest.fn() }),
}));

const mockRequestAccountDeletion = jest.mocked(requestAccountDeletion);
const mockFinalizeAccountDeletion = jest.mocked(finalizeAccountDeletion);

type AlertButton = { text?: string; style?: string; onPress?: () => void };

const alertSpy = jest.spyOn(Alert, 'alert');
const openURLSpy = jest.spyOn(Linking, 'openURL');
const lastAlertButtons = (): AlertButton[] => {
  const call = alertSpy.mock.calls.at(-1);
  return (call?.[2] ?? []) as AlertButton[];
};

describe('LegalSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    openURLSpy.mockResolvedValue(undefined);
    mockUser = { id: 'user-1' };
  });

  afterEach(cleanup);

  it('exposes the usage-measurement opt-out when analytics is available', () => {
    mockAnalyticsAvailable = true;
    const { getByTestId } = render(<LegalSection />);

    fireEvent(getByTestId('settings-analytics-preference-switch'), 'valueChange', false);
    expect(mockAnalyticsToggle).toHaveBeenCalledWith(false);
  });

  it('hides the usage-measurement row when analytics is unavailable in this build', () => {
    mockAnalyticsAvailable = false;
    const { queryByTestId } = render(<LegalSection />);
    expect(queryByTestId('settings-analytics-preference')).toBeNull();
    mockAnalyticsAvailable = true;
  });

  it('opens the localized legal pages in the browser', () => {
    const { getByTestId } = render(<LegalSection />);

    fireEvent.press(getByTestId('settings-legal-privacy-policy'));
    expect(openURLSpy).toHaveBeenLastCalledWith('https://noctalia.app/fr/politique-confidentialite/');

    fireEvent.press(getByTestId('settings-legal-terms-of-use'));
    expect(openURLSpy).toHaveBeenLastCalledWith('https://noctalia.app/fr/cgu/');

    fireEvent.press(getByTestId('settings-legal-account-deletion'));
    expect(openURLSpy).toHaveBeenLastCalledWith('https://noctalia.app/fr/suppression-compte/');
  });

  it('lets guests write to us, and shows the address when no mail app opens', async () => {
    mockUser = null;
    const { getByTestId, getByText } = render(<LegalSection />);
    expect(getByText('contact@noctalia.app')).toBeTruthy();

    fireEvent.press(getByTestId('settings-legal-contact'));
    expect(openURLSpy).toHaveBeenLastCalledWith('mailto:contact@noctalia.app');

    openURLSpy.mockRejectedValueOnce(new Error('no handler'));
    fireEvent.press(getByTestId('settings-legal-contact'));
    await waitFor(() => expect(alertSpy).toHaveBeenLastCalledWith('settings.legal.contact', 'contact.mail_unavailable'));
  });

  it('hides the delete-account action for guests', () => {
    mockUser = null;
    const { queryByTestId, getByTestId } = render(<LegalSection />);

    expect(getByTestId('settings-legal-privacy-policy')).toBeTruthy();
    expect(queryByTestId('settings-delete-account')).toBeNull();
  });

  it('keeps the deleted identity when server deletion invalidates auth after confirmation', async () => {
    mockRequestAccountDeletion.mockImplementation(async () => {
      mockUser = null;
      return { deleted: true };
    });
    mockFinalizeAccountDeletion.mockResolvedValue(undefined);

    const { getByTestId } = render(<LegalSection />);
    fireEvent.press(getByTestId('settings-delete-account'));

    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0][0]).toBe('settings.deleteAccount.confirmTitle');
    expect(alertSpy.mock.calls[0][1]).toBe('settings.deleteAccount.confirmMessage');
    expect(mockRequestAccountDeletion).not.toHaveBeenCalled();

    // Step 1 -> confirm shows the subscription warning (deletion does not
    // cancel an active Google Play subscription).
    lastAlertButtons()[1].onPress?.();
    expect(alertSpy).toHaveBeenCalledTimes(2);
    expect(alertSpy.mock.calls[1][1]).toBe('settings.deleteAccount.subscriptionWarning');
    expect(mockRequestAccountDeletion).not.toHaveBeenCalled();

    // Step 2 -> destructive confirm triggers the deletion.
    const destructive = lastAlertButtons().find((button) => button.style === 'destructive');
    destructive?.onPress?.();
    expect(mockRequestAccountDeletion).toHaveBeenCalledTimes(1);

    // Success: local cleanup + sign-out, then the success message.
    await waitFor(() => {
      expect(mockFinalizeAccountDeletion).toHaveBeenCalledWith('user-1');
    });
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(3);
    });
    expect(alertSpy.mock.calls[2][0]).toBe('settings.deleteAccount.successTitle');
    expect(alertSpy.mock.calls[2][1]).toBe('settings.deleteAccount.successMessage');
  });

  describe('in a browser, where react-native-web has no Alert', () => {
    const browser = globalThis as unknown as { confirm?: (message: string) => boolean; alert?: (message: string) => void };
    let confirmAnswers: boolean[];
    const browserConfirm = jest.fn((_message: string) => confirmAnswers.shift() ?? false);
    const browserAlert = jest.fn((_message: string) => {});
    let platform: { restore: () => void };

    beforeEach(() => {
      platform = jest.replaceProperty(Platform, 'OS', 'web');
      browser.confirm = browserConfirm;
      browser.alert = browserAlert;
    });

    afterEach(() => {
      platform.restore();
      delete browser.confirm;
      delete browser.alert;
    });

    it('asks both questions with the browser\'s dialogs, then deletes and says so', async () => {
      confirmAnswers = [true, true];
      mockRequestAccountDeletion.mockResolvedValue({ deleted: true });
      mockFinalizeAccountDeletion.mockResolvedValue(undefined);

      const { getByTestId } = render(<LegalSection />);
      fireEvent.press(getByTestId('settings-delete-account'));

      expect(browserConfirm).toHaveBeenCalledTimes(2);
      expect(browserConfirm).toHaveBeenNthCalledWith(1, 'settings.deleteAccount.confirmTitle\n\nsettings.deleteAccount.confirmMessage');
      expect(browserConfirm).toHaveBeenNthCalledWith(2, 'settings.deleteAccount.confirmTitle\n\nsettings.deleteAccount.subscriptionWarning');
      expect(mockRequestAccountDeletion).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mockFinalizeAccountDeletion).toHaveBeenCalledWith('user-1'));
      await waitFor(() => expect(browserAlert).toHaveBeenCalledWith(
        'settings.deleteAccount.successTitle\n\nsettings.deleteAccount.successMessage',
      ));
      expect(alertSpy).not.toHaveBeenCalled();
    });

    it('keeps the account when either question is declined', () => {
      const { getByTestId } = render(<LegalSection />);

      confirmAnswers = [false];
      fireEvent.press(getByTestId('settings-delete-account'));
      expect(browserConfirm).toHaveBeenCalledTimes(1);

      confirmAnswers = [true, false];
      fireEvent.press(getByTestId('settings-delete-account'));
      expect(browserConfirm).toHaveBeenCalledTimes(3);
      expect(mockRequestAccountDeletion).not.toHaveBeenCalled();
    });

    it('says in the browser when the deletion fails', async () => {
      confirmAnswers = [true, true];
      mockRequestAccountDeletion.mockRejectedValue(new Error('HTTP 500'));

      const { getByTestId } = render(<LegalSection />);
      fireEvent.press(getByTestId('settings-delete-account'));

      await waitFor(() => expect(browserAlert).toHaveBeenCalledWith('settings.deleteAccount.errorMessage'));
      expect(mockFinalizeAccountDeletion).not.toHaveBeenCalled();
    });
  });

  it('shows the generic error message when deletion fails', async () => {
    mockRequestAccountDeletion.mockRejectedValue(new Error('HTTP 500'));

    const { getByTestId } = render(<LegalSection />);
    fireEvent.press(getByTestId('settings-delete-account'));
    lastAlertButtons()[1].onPress?.();
    lastAlertButtons().find((button) => button.style === 'destructive')?.onPress?.();

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(3);
    });
    expect(alertSpy.mock.calls[2][0]).toBe('settings.deleteAccount.errorMessage');
    expect(mockFinalizeAccountDeletion).not.toHaveBeenCalled();
  });
});
