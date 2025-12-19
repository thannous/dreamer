/* @vitest-environment happy-dom */
import React from 'react';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthApiError } from '@supabase/auth-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TID } from '../../../lib/testIDs';
import { EmailAuthCard } from '../EmailAuthCard';

const {
  mockAlert,
  mockRequestStayOnSettingsIntent,
  mockSignInWithEmailPassword,
  mockSignUpWithEmailPassword,
  mockSignOut,
  mockResendVerificationEmail,
} = vi.hoisted(() => ({
  mockAlert: vi.fn(),
  mockRequestStayOnSettingsIntent: vi.fn(),
  mockSignInWithEmailPassword: vi.fn(),
  mockSignUpWithEmailPassword: vi.fn(),
  mockSignOut: vi.fn(),
  mockResendVerificationEmail: vi.fn(),
}));

vi.stubGlobal('__DEV__', false);

let currentUser: any = null;
let authLoading = false;
let supabaseConfigured = true;

vi.mock('react-native', () => {
  return {
    __esModule: true,
    Alert: { alert: mockAlert },
    ActivityIndicator: (props: any) => <div data-testid="activity" {...props} />,
    Animated: {
      Value: class {
        value: number;
        constructor(value: number) {
          this.value = value;
        }
        setValue(next: number) {
          this.value = next;
        }
        interpolate() { return this; }
      },
      View: ({ children }: any) => <div>{children}</div>,
      timing: () => ({ start: (cb?: () => void) => cb?.() }),
      spring: () => ({ start: (cb?: () => void) => cb?.() }),
      parallel: () => ({ start: (cb?: () => void) => cb?.() }),
    },
    Easing: {
      ease: 'ease',
      in: () => 'in',
      out: () => 'out',
      inOut: () => 'inOut',
    },
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
    Dimensions: { get: () => ({ width: 375, height: 812 }) },
    Keyboard: { dismiss: vi.fn() },
    KeyboardAvoidingView: ({ children }: any) => <div>{children}</div>,
    ScrollView: ({ children }: any) => <div>{children}</div>,
    TouchableWithoutFeedback: ({ children, onPress }: any) => <div onClick={onPress}>{children}</div>,
  };
});

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({ user: currentUser, loading: authLoading }),
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

vi.mock('../../../context/LanguageContext', () => ({
  useLanguage: () => ({
    language: 'en',
    locale: { languageTag: 'en-US' },
    setLanguage: vi.fn(),
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
  signOut: mockSignOut,
  signUpWithEmailPassword: mockSignUpWithEmailPassword,
  resendVerificationEmail: mockResendVerificationEmail,
}));

vi.mock('../../../lib/navigationIntents', () => ({
  requestStayOnSettingsIntent: mockRequestStayOnSettingsIntent,
}));

vi.mock('../../../lib/supabase', () => ({
  get isSupabaseConfigured() {
    return supabaseConfigured;
  },
}));

vi.mock('../EmailVerificationDialog', () => ({
  EmailVerificationDialog: () => <div data-testid="email-verification-dialog" />,
}));

vi.mock('../../ui/StandardBottomSheet', () => ({
  StandardBottomSheet: () => <div data-testid="standard-bottom-sheet" />,
}));

vi.mock('../../../constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { sm: 4, md: 8, lg: 12 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  },
}));

describe('EmailAuthCard', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    currentUser = null;
    authLoading = false;
    supabaseConfigured = true;
    mockSignInWithEmailPassword.mockResolvedValue(undefined);
    mockSignUpWithEmailPassword.mockResolvedValue({ email_confirmed_at: null });
    mockSignOut.mockResolvedValue(undefined);
  });

  it('shows unverified prompt and allows resending verification email when sign-in fails for confirmation', async () => {
    // Use fake timers to control time-based cooldowns
    vi.useFakeTimers({ shouldAdvanceTime: true });

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
    await vi.advanceTimersByTimeAsync(61000);

    fireEvent.click(screen.getByTestId(TID.Button.AuthResendVerification));

    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('user@example.com');
    });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestStayOnSettingsIntent).toHaveBeenCalled();

    vi.useRealTimers();
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
    supabaseConfigured = false;

    render(<EmailAuthCard />);

    expect(screen.getByText('settings.account.hint.configure_supabase')).toBeDefined();
  });

  it('renders signed-in state and allows sign-out', async () => {
    currentUser = { email: 'user@example.com' };

    render(<EmailAuthCard />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthSignOut));

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });
});
