/* @vitest-environment happy-dom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthApiError } from '@supabase/auth-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TID } from '../../../lib/testIDs';
import EmailAuthCard from '../EmailAuthCard';

const {
  mockAlert,
  mockRequestStayOnSettingsIntent,
  mockSignInWithEmailPassword,
  mockResendVerificationEmail,
} = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockRequestStayOnSettingsIntent: vi.fn(),
  mockSignInWithEmailPassword: vi.fn(),
  mockResendVerificationEmail: vi.fn(),
}));

vi.stubGlobal('__DEV__', false);

vi.mock('react-native', () => {
  return {
    __esModule: true,
    Alert: { alert: mockAlert },
    ActivityIndicator: (props: any) => <div data-testid="activity" {...props} />,
    Platform: { OS: 'web', select: (obj: any) => obj.web ?? obj.default },
    Pressable: ({ children, onPress, disabled, testID }: any) => (
      <button data-testid={testID} disabled={disabled} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: (styles: any) => styles },
    Text: ({ children, testID }: any) => <span data-testid={testID}>{children}</span>,
    TextInput: ({ onChangeText, value, testID }: any) => (
      <input data-testid={testID} value={value} onChange={(event) => onChangeText(event.target.value)} />
    ),
    View: ({ children }: any) => <div>{children}</div>,
  };
});

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

vi.mock('../../../context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#f58c8c',
      backgroundCard: '#111',
      backgroundSecondary: '#222',
      divider: '#333',
      textPrimary: '#fff',
      textSecondary: '#ccc',
    },
  }),
}));

vi.mock('../../../hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../GoogleSignInButton', () => ({
  default: () => <div data-testid="google-sign-in" />,
}));

vi.mock('../EmailVerificationBanner', () => ({
  default: () => <div data-testid="banner" />,
}));

vi.mock('../../../lib/auth', () => ({
  signInMock: vi.fn(),
  signInWithEmailPassword: mockSignInWithEmailPassword,
  signOut: vi.fn(),
  signUpWithEmailPassword: vi.fn(),
  resendVerificationEmail: mockResendVerificationEmail,
}));

vi.mock('../../../lib/navigationIntents', () => ({
  requestStayOnSettingsIntent: mockRequestStayOnSettingsIntent,
}));

describe('EmailAuthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows unverified prompt and allows resending verification email when sign-in fails for confirmation', async () => {
    mockSignInWithEmailPassword.mockRejectedValue(
      new AuthApiError('Email not confirmed', 400, 'email_not_confirmed')
    );

    render(<EmailAuthCard />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByTestId(TID.Input.AuthPassword), {
      target: { value: 'password' },
    });

    fireEvent.click(screen.getByTestId(TID.Button.AuthSignIn));

    await waitFor(() => {
      expect(screen.getByText('settings.account.banner.unverified.title')).toBeDefined();
    });

    fireEvent.click(screen.getByTestId(TID.Button.AuthResendVerification));

    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('user@example.com');
    });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestStayOnSettingsIntent).toHaveBeenCalled();
  });
});

