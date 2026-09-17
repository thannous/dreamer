/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';

const mockBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockReplace = jest.fn();
const mockImportGuestData = jest.fn();
const mockAlert = jest.fn();
let mockGuestImportAvailable = true;

jest.mock('react-native', () => jest.requireActual('../react-native-stub'));

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
  },
}));

jest.mock('@/components/auth/EmailAuthCard', () => ({
  EmailAuthCard: ({ showGoogleSignIn }: { showGoogleSignIn?: boolean }) => (
    <div data-testid="email-auth-card" data-google-enabled={String(showGoogleSignIn)} />
  ),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  // Primitives ajoutées par C4 : le double doit suivre le composant, sinon
  // l'écran rend `undefined` et la suite tombe sur « Element type is invalid ».
  LucidIconTile: () => null,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidScreen: ({
    children,
    testID,
    trailing,
  }: {
    children: React.ReactNode;
    testID?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      {trailing}
      {children}
    </main>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidButton: ({ label, loading, onPress, testID }: {
    label: string;
    loading?: boolean;
    onPress: () => void;
    testID?: string;
  }) => <button data-testid={testID} disabled={loading} onClick={onPress}>{label}</button>,
}));

jest.mock('@/constants/lucidTheme', () => ({
  // Les échelles sont des constantes pures : aucune raison de les simuler, et
  // les simuler faisait planter les StyleSheet.create qui les lisent au chargement.
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({ text: '#111', textSecondary: '#555' }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      content: getLucidContent('en'),
      guestImportAvailable: mockGuestImportAvailable,
      importGuestData: mockImportGuestData,
    }),
  };
});

jest.mock('@/lib/auth', () => ({
  isGoogleSignInAvailable: () => false,
}));

const { default: LucidAccountScreen } = require('@/app/lucid/account');

describe('Lucid Trainer shared account', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGuestImportAvailable = true;
    mockImportGuestData.mockResolvedValue(undefined);
    mockCanGoBack.mockReturnValue(true);
    Alert.alert = mockAlert;
  });

  afterEach(cleanup);

  it('does not expose an unconfigured companion Google sign-in action', () => {
    render(<LucidAccountScreen />);

    expect(screen.getByTestId('email-auth-card').getAttribute('data-google-enabled')).toBe('false');
  });

  it('requires a second explicit confirmation before importing guest training', async () => {
    render(<LucidAccountScreen />);

    fireEvent.click(screen.getByTestId('lucid-import-guest'));
    expect(mockImportGuestData).not.toHaveBeenCalled();

    const confirmButtons = mockAlert.mock.calls[0][2] as { onPress?: () => void }[];
    confirmButtons[1].onPress?.();

    await waitFor(() => expect(mockImportGuestData).toHaveBeenCalledTimes(1));
    expect(mockAlert).toHaveBeenLastCalledWith('Guest training imported');
  });

  it('keeps the explicit import available and reports a recoverable failure', async () => {
    mockImportGuestData.mockRejectedValueOnce(new Error('storage failure'));
    render(<LucidAccountScreen />);

    fireEvent.click(screen.getByTestId('lucid-import-guest'));
    const confirmButtons = mockAlert.mock.calls[0][2] as { onPress?: () => void }[];
    confirmButtons[1].onPress?.();

    await waitFor(() => expect(mockImportGuestData).toHaveBeenCalledTimes(1));
    expect(mockAlert).toHaveBeenLastCalledWith(
      'This could not be loaded. Your saved training remains on this device.',
      'Import failed. The guest training remains separate on this device.'
    );
    expect(screen.getByTestId('lucid-import-guest')).toBeTruthy();
  });

  it('does not offer an import when the guest scope is empty', () => {
    mockGuestImportAvailable = false;
    render(<LucidAccountScreen />);

    expect(screen.queryByTestId('lucid-import-guest')).toBeNull();
  });

  it('returns to Settings when the email confirmation link opens account with empty history', () => {
    mockCanGoBack.mockReturnValue(false);
    render(<LucidAccountScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/settings');
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('preserves native back when account was opened from Settings', () => {
    render(<LucidAccountScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
