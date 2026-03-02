/* @jest-environment jsdom */
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Alert } from 'react-native';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Alert: { alert: () => {} },
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.web ?? options.default,
    },
    ActivityIndicator: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
    Pressable: ({
      children,
      onPress,
      disabled,
      testID,
    }: {
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      disabled?: boolean;
      testID?: string;
    }) => (
      <button data-testid={testID} disabled={disabled} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <span data-testid={testID}>{children}</span>
    ),
    TextInput: ({
      value,
      onChangeText,
      testID,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      testID?: string;
    }) => (
      <input
        data-testid={testID}
        value={value ?? ''}
        onChange={(event) => onChangeText?.((event.target as HTMLInputElement).value)}
      />
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

const {
  mockAlert,
  mockRequestStayOnSettingsIntent,
  mockSignInWithEmailPassword,
  mockSignUpWithEmailPassword,
  mockSignOut,
  mockResendVerificationEmail,
} = ((factory: any) => factory())(() => ({
  mockAlert: jest.fn(),
  mockRequestStayOnSettingsIntent: jest.fn(),
  mockSignInWithEmailPassword: jest.fn(),
  mockSignUpWithEmailPassword: jest.fn(),
  mockSignOut: jest.fn(),
  mockResendVerificationEmail: jest.fn(),
}));

((key: string, value: unknown) => { Object.defineProperty(globalThis, key, { configurable: true, writable: true, value }); })('__DEV__', false);

let mockCurrentUser: any = null;
let mockAuthLoading = false;
let mockSupabaseConfigured = true;

jest.mock('@supabase/auth-js', () => {
  class AuthApiError extends Error {
    status: number;
    code: string;
    constructor(message: string, status: number, code: string) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }

  const isAuthApiError = (error: unknown): error is AuthApiError =>
    Boolean(error && typeof error === 'object' && 'status' in error && 'code' in error);

  return { AuthApiError, isAuthApiError };
});

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser, loading: mockAuthLoading }),
}));

jest.mock('@/context/ThemeContext', () => ({
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

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    locale: { languageTag: 'en-US' },
    setLanguage: jest.fn(),
  }),
}));

jest.mock('@/components/auth/GoogleSignInButton', () => ({
  __esModule: true,
  default: () => <div data-testid="google-sign-in" />,
}));

jest.mock('@/components/auth/EmailVerificationBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="banner" />,
}));

jest.mock('@/components/icons/DreamIcons', () => ({
  EyeIcon: () => <div data-testid="eye-icon" />,
  EyeOffIcon: () => <div data-testid="eye-off-icon" />,
}));

jest.mock('@/lib/auth', () => ({
  signInMock: jest.fn(),
  signInWithEmailPassword: mockSignInWithEmailPassword,
  signOut: mockSignOut,
  signUpWithEmailPassword: mockSignUpWithEmailPassword,
  resendVerificationEmail: mockResendVerificationEmail,
}));

jest.mock('@/lib/navigationIntents', () => ({
  requestStayOnSettingsIntent: mockRequestStayOnSettingsIntent,
}));

jest.mock('@/lib/supabase', () => ({
  get isSupabaseConfigured() {
    return mockSupabaseConfigured;
  },
}));

jest.mock('@/components/auth/EmailVerificationDialog', () => ({
  EmailVerificationPendingDialog: () => <div data-testid="email-verification-dialog" />,
  EmailVerificationSuccessDialog: () => <div data-testid="email-verification-dialog" />,
}));

jest.mock('@/components/ui/StandardBottomSheet', () => ({
  StandardBottomSheet: () => <div data-testid="standard-bottom-sheet" />,
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { sm: 4, md: 8, lg: 12 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      regular: 'SpaceGrotesk-Regular',
      medium: 'SpaceGrotesk-Medium',
    },
  },
  GlassCardTokens: {
    borderWidth: 1,
    getBackground: (backgroundCard: string) => backgroundCard,
  },
}));

const { AuthApiError } = require('@supabase/auth-js');
const { EmailAuthCard } = require('../EmailAuthCard');

describe('EmailAuthCard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = null;
    mockAuthLoading = false;
    mockSupabaseConfigured = true;
    Alert.alert = mockAlert;
    mockSignInWithEmailPassword.mockResolvedValue(undefined);
    mockSignUpWithEmailPassword.mockResolvedValue({ email_confirmed_at: null });
    mockSignOut.mockResolvedValue(undefined);
  });

  it('shows unverified prompt and allows resending verification email when sign-in fails for confirmation', async () => {
    // Use fake timers to control time-based cooldowns
    jest.useFakeTimers({ advanceTimers: true });

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

    // Advance past the 60-second cooldown period (60000ms)
    await jest.advanceTimersByTimeAsync(61000);

    fireEvent.click(screen.getByTestId(TID.Button.AuthResendVerification));

    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('user@example.com');
    });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestStayOnSettingsIntent).toHaveBeenCalled();

    jest.useRealTimers();
  });

  it('signs in with valid credentials and clears the password', async () => {
    render(<EmailAuthCard />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: ' user@example.com ' },
    });
    fireEvent.change(screen.getByTestId(TID.Input.AuthPassword), {
      target: { value: 'password' },
    });

    fireEvent.click(screen.getByTestId(TID.Button.AuthSignIn));

    await waitFor(() => {
      expect(mockSignInWithEmailPassword).toHaveBeenCalledWith('user@example.com', 'password');
    });

    expect(mockRequestStayOnSettingsIntent).toHaveBeenCalled();
    await waitFor(() => {
      expect((screen.getByTestId(TID.Input.AuthPassword) as HTMLInputElement).value).toBe('');
    });
  });

  it('starts verification flow on sign-up when email is unconfirmed', async () => {
    render(<EmailAuthCard />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByTestId(TID.Input.AuthPassword), {
      target: { value: 'password' },
    });

    await waitFor(() => {
      expect((screen.getByTestId(TID.Button.AuthSignUp) as HTMLButtonElement).disabled).toBe(false);
    });

    fireEvent.click(screen.getByTestId(TID.Button.AuthSignUp));

    await waitFor(() => {
      expect(mockSignUpWithEmailPassword).toHaveBeenCalledWith('user@example.com', 'password', 'en');
    });

    expect(mockRequestStayOnSettingsIntent).toHaveBeenCalled();
  });

  it('does not show unverified banner when sign-up returns confirmed email', async () => {
    mockSignUpWithEmailPassword.mockResolvedValue({ email_confirmed_at: '2024-01-01' });

    render(<EmailAuthCard />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByTestId(TID.Input.AuthPassword), {
      target: { value: 'password' },
    });

    fireEvent.click(screen.getByTestId(TID.Button.AuthSignUp));

    await waitFor(() => {
      expect(mockSignUpWithEmailPassword).toHaveBeenCalled();
    });

    expect(screen.queryByText('settings.account.banner.unverified.title')).toBeNull();
  });

  it('shows validation errors for invalid email and short password', async () => {
    render(<EmailAuthCard />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: 'invalid' },
    });
    fireEvent.change(screen.getByTestId(TID.Input.AuthPassword), {
      target: { value: '123' },
    });

    expect(screen.getByText('auth.email.invalid')).toBeDefined();
    expect(screen.getByText('auth.password.too_short')).toBeDefined();
  });

  it('shows configuration hint when supabase is not configured', () => {
    mockSupabaseConfigured = false;

    render(<EmailAuthCard />);

    expect(screen.getByText('settings.account.hint.configure_supabase')).toBeDefined();
  });

  it('renders signed-in state and allows sign-out', async () => {
    mockCurrentUser = { email: 'user@example.com' };

    render(<EmailAuthCard />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthSignOut));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
