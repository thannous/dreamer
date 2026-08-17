import React from 'react';
import { Alert, Linking } from 'react-native';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react-native';
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

  it('opens the localized legal pages in the browser', () => {
    const { getByTestId } = render(<LegalSection />);

    fireEvent.press(getByTestId('settings-legal-privacy-policy'));
    expect(openURLSpy).toHaveBeenLastCalledWith('https://noctalia.app/fr/politique-confidentialite/');

    fireEvent.press(getByTestId('settings-legal-terms-of-use'));
    expect(openURLSpy).toHaveBeenLastCalledWith('https://noctalia.app/fr/cgu/');

    fireEvent.press(getByTestId('settings-legal-account-deletion'));
    expect(openURLSpy).toHaveBeenLastCalledWith('https://noctalia.app/fr/suppression-compte/');
  });

  it('hides the delete-account action for guests', () => {
    mockUser = null;
    const { queryByTestId, getByTestId } = render(<LegalSection />);

    expect(getByTestId('settings-legal-privacy-policy')).toBeTruthy();
    expect(queryByTestId('settings-delete-account')).toBeNull();
  });

  it('requires a two-step confirmation before deleting the account', async () => {
    mockRequestAccountDeletion.mockResolvedValue({ deleted: true });
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
      expect(mockFinalizeAccountDeletion).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledTimes(3);
    });
    expect(alertSpy.mock.calls[2][0]).toBe('settings.deleteAccount.successTitle');
    expect(alertSpy.mock.calls[2][1]).toBe('settings.deleteAccount.successMessage');
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
