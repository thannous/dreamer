/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    ScrollView: ({
      automaticallyAdjustKeyboardInsets,
      children,
      contentInsetAdjustmentBehavior,
      keyboardDismissMode,
      keyboardShouldPersistTaps,
      nestedScrollEnabled,
    }: {
      automaticallyAdjustKeyboardInsets?: boolean;
      children?: React.ReactNode;
      contentInsetAdjustmentBehavior?: string;
      keyboardDismissMode?: string;
      keyboardShouldPersistTaps?: string;
      nestedScrollEnabled?: boolean;
    }) => (
      <div
        data-testid="account-sheet-scroll"
        data-adjust-keyboard-insets={String(automaticallyAdjustKeyboardInsets)}
        data-content-inset-adjustment={contentInsetAdjustmentBehavior}
        data-keyboard-dismiss-mode={keyboardDismissMode}
        data-keyboard-taps={keyboardShouldPersistTaps}
        data-nested-scroll={String(nestedScrollEnabled)}
      >
        {children}
      </div>
    ),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
  };
});

const {
  mockAlert,
  mockClearStayOnSettingsIntent,
  mockRequestStayOnSettingsIntent,
  mockSignInWithEmailPassword,
  mockSignUpWithEmailPassword,
  mockSignOut,
  mockResendVerificationEmail,
  mockRequestPasswordReset,
  mockReloadDreams,
} = ((factory: any) => factory())(() => ({
  mockAlert: jest.fn(),
  mockClearStayOnSettingsIntent: jest.fn(),
  mockRequestStayOnSettingsIntent: jest.fn(),
  mockSignInWithEmailPassword: jest.fn(),
  mockSignUpWithEmailPassword: jest.fn(),
  mockSignOut: jest.fn(),
  mockResendVerificationEmail: jest.fn(),
  mockRequestPasswordReset: jest.fn(),
  mockReloadDreams: jest.fn(),
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

jest.mock('@/context/DreamsContext', () => ({
  useDreamsActions: () => ({ reloadDreams: mockReloadDreams }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#f58c8c',
      accentText: '#f58c8c',
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

jest.mock('@/components/auth/AppleSignInButton', () => ({
  __esModule: true,
  default: () => <div data-testid="apple-sign-in" />,
}));

jest.mock('@/components/auth/EmailVerificationBanner', () => ({
  __esModule: true,
  default: () => <div data-testid="banner" />,
}));

jest.mock('@/components/icons/DreamIcons', () => ({
  EyeIcon: () => <div data-testid="eye-icon" />,
  EyeOffIcon: () => <div data-testid="eye-off-icon" />,
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: () => <div data-testid="account-icon" />,
}));

jest.mock('@/lib/auth', () => ({
  requestPasswordReset: mockRequestPasswordReset,
  signInMock: jest.fn(),
  signInWithEmailPassword: mockSignInWithEmailPassword,
  signOut: mockSignOut,
  signUpWithEmailPassword: mockSignUpWithEmailPassword,
  resendVerificationEmail: mockResendVerificationEmail,
}));

jest.mock('@/lib/navigationIntents', () => ({
  clearStayOnSettingsIntent: mockClearStayOnSettingsIntent,
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
  StandardBottomSheet: ({
    children,
    snapPoints,
    subtitle,
    testID,
    title,
    visible,
  }: {
    children?: React.ReactNode;
    snapPoints?: unknown[];
    subtitle?: string;
    testID?: string;
    title?: string;
    visible: boolean;
  }) => visible ? (
    <div
      data-testid={testID ?? 'standard-bottom-sheet'}
      data-snap-points={snapPoints ? JSON.stringify(snapPoints) : undefined}
      data-title={title}
      data-subtitle={subtitle}
    >
      {children}
    </div>
  ) : null,
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
  let usingFakeTimers = false;

  afterEach(() => {
    cleanup();
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    Platform.OS = 'web';
    if (usingFakeTimers) {
      jest.clearAllTimers();
      jest.useRealTimers();
      usingFakeTimers = false;
    }
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
    mockReloadDreams.mockResolvedValue(undefined);
    mockRequestPasswordReset.mockResolvedValue(undefined);
  });

  it('opens the forgot-password panel pre-filled with the sign-in email and shows a neutral confirmation', async () => {
    render(<EmailAuthCard />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: ' user@example.com ' },
    });
    expect(screen.queryByTestId(TID.Component.AuthForgotPasswordPanel)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.AuthForgotPassword));

    expect(screen.getByTestId(TID.Component.AuthForgotPasswordPanel)).toBeDefined();
    expect(screen.getByText('auth.forgot_password.title')).toBeDefined();
    expect((screen.getByTestId(TID.Input.AuthForgotPasswordEmail) as HTMLInputElement).value).toBe(
      'user@example.com'
    );

    fireEvent.click(screen.getByTestId(TID.Button.AuthSendPasswordReset));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('user@example.com');
    });
    await waitFor(() => {
      expect(screen.getByTestId(TID.Text.AuthForgotPasswordStatus).textContent).toBe(
        'auth.forgot_password.sent'
      );
    });
    // The neutral confirmation replaces the form; no sign-in attempt was made.
    expect(screen.queryByTestId(TID.Input.AuthForgotPasswordEmail)).toBeNull();
    expect(screen.queryByTestId(TID.Button.AuthSendPasswordReset)).toBeNull();
    expect(mockSignInWithEmailPassword).not.toHaveBeenCalled();
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('shows the same neutral confirmation for an unknown address', async () => {
    render(<EmailAuthCard />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthForgotPassword));
    fireEvent.change(screen.getByTestId(TID.Input.AuthForgotPasswordEmail), {
      target: { value: 'nobody@example.com' },
    });
    fireEvent.click(screen.getByTestId(TID.Button.AuthSendPasswordReset));

    await waitFor(() => {
      expect(mockRequestPasswordReset).toHaveBeenCalledWith('nobody@example.com');
    });
    await waitFor(() => {
      expect(screen.getByText('auth.forgot_password.sent')).toBeDefined();
    });
  });

  it('keeps the send button disabled until the reset email is valid and while sending', async () => {
    let resolveRequest: () => void = () => {};
    mockRequestPasswordReset.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveRequest = resolve;
      })
    );

    render(<EmailAuthCard />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthForgotPassword));
    expect((screen.getByTestId(TID.Button.AuthSendPasswordReset) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId(TID.Input.AuthForgotPasswordEmail), {
      target: { value: 'not-an-email' },
    });
    expect((screen.getByTestId(TID.Button.AuthSendPasswordReset) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByTestId(TID.Input.AuthForgotPasswordEmail), {
      target: { value: 'user@example.com' },
    });
    expect((screen.getByTestId(TID.Button.AuthSendPasswordReset) as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(screen.getByTestId(TID.Button.AuthSendPasswordReset));
    await waitFor(() => {
      expect((screen.getByTestId(TID.Button.AuthSendPasswordReset) as HTMLButtonElement).disabled).toBe(true);
    });
    expect(mockRequestPasswordReset).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveRequest();
    });
    await waitFor(() => {
      expect(screen.getByText('auth.forgot_password.sent')).toBeDefined();
    });
  });

  it('surfaces a generic translated error when the reset request fails', async () => {
    mockRequestPasswordReset.mockRejectedValue(new Error('rate limited'));

    render(<EmailAuthCard />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthForgotPassword));
    fireEvent.change(screen.getByTestId(TID.Input.AuthForgotPasswordEmail), {
      target: { value: 'user@example.com' },
    });
    fireEvent.click(screen.getByTestId(TID.Button.AuthSendPasswordReset));

    await waitFor(() => {
      expect(screen.getByTestId('standard-bottom-sheet').getAttribute('data-title')).toBe(
        'auth.forgot_password.error_title'
      );
    });
    expect(screen.getByTestId('standard-bottom-sheet').getAttribute('data-subtitle')).toBe(
      'auth.forgot_password.error_message'
    );
    // The panel stays open so the user can retry.
    expect(screen.queryByText('auth.forgot_password.sent')).toBeNull();
    expect(screen.getByTestId(TID.Input.AuthForgotPasswordEmail)).toBeDefined();
  });

  it('closes the forgot-password panel with cancel', () => {
    render(<EmailAuthCard />);

    fireEvent.click(screen.getByTestId(TID.Button.AuthForgotPassword));
    expect(screen.getByTestId(TID.Component.AuthForgotPasswordPanel)).toBeDefined();

    fireEvent.click(screen.getByTestId(TID.Button.AuthCloseForgotPassword));

    expect(screen.queryByTestId(TID.Component.AuthForgotPasswordPanel)).toBeNull();
    expect(screen.getByTestId(TID.Button.AuthForgotPassword)).toBeDefined();
    expect(mockRequestPasswordReset).not.toHaveBeenCalled();
  });

  it('shows unverified prompt and allows resending verification email when sign-in fails for confirmation', async () => {
    // Use fake timers to control time-based cooldowns
    jest.useFakeTimers({ advanceTimers: true });
    usingFakeTimers = true;

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
    await act(async () => {
      await jest.advanceTimersByTimeAsync(61000);
    });

    fireEvent.click(screen.getByTestId(TID.Button.AuthResendVerification));

    await waitFor(() => {
      expect(mockResendVerificationEmail).toHaveBeenCalledWith('user@example.com');
    });

    expect(mockAlert).not.toHaveBeenCalled();
    expect(mockRequestStayOnSettingsIntent).toHaveBeenCalled();

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
    expect(mockRequestStayOnSettingsIntent.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignInWithEmailPassword.mock.invocationCallOrder[0]
    );
    await waitFor(() => {
      expect((screen.getByTestId(TID.Input.AuthPassword) as HTMLInputElement).value).toBe('');
    });
  });

  it('requests the Lucid settings destination before authentication can emit a session', async () => {
    render(<EmailAuthCard returnTo="/lucid/(tabs)/settings" />);

    fireEvent.change(screen.getByTestId(TID.Input.AuthEmail), {
      target: { value: 'user@example.com' },
    });
    fireEvent.change(screen.getByTestId(TID.Input.AuthPassword), {
      target: { value: 'password' },
    });
    fireEvent.click(screen.getByTestId(TID.Button.AuthSignIn));

    await waitFor(() => {
      expect(mockRequestStayOnSettingsIntent).toHaveBeenCalledWith({
        destination: '/lucid/(tabs)/settings',
      });
    });
    expect(mockRequestStayOnSettingsIntent.mock.invocationCallOrder[0]).toBeLessThan(
      mockSignInWithEmailPassword.mock.invocationCallOrder[0]
    );
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

  it('hides Google sign-in and its divider when the companion credentials are unavailable', () => {
    render(<EmailAuthCard showGoogleSignIn={false} />);

    expect(screen.queryByTestId('google-sign-in')).toBeNull();
    expect(screen.queryByText('common.or')).toBeNull();
  });

  it('shows Apple sign-in on iOS when third-party login is shown', () => {
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    Platform.OS = 'ios';
    try {
      render(<EmailAuthCard />);
      expect(screen.getByTestId('apple-sign-in')).toBeDefined();
    } finally {
      Platform.OS = 'web';
    }
  });

  it('hides Apple sign-in on iOS when third-party login is hidden', () => {
    const { Platform } = require('react-native') as { Platform: { OS: string } };
    Platform.OS = 'ios';
    try {
      render(<EmailAuthCard showGoogleSignIn={false} />);
      expect(screen.queryByTestId('apple-sign-in')).toBeNull();
    } finally {
      Platform.OS = 'web';
    }
  });

  it('keeps the embedded guest summary concise', () => {
    render(<EmailAuthCard presentation="embedded" />);

    expect(screen.getByText('settings.account.status.guest')).toBeDefined();
    expect(screen.queryByText('settings.account.local_hint')).toBeNull();
    expect(screen.getByTestId('settings-account-open-signup')).toBeDefined();
    expect(screen.getByTestId('settings-account-open-signin')).toBeDefined();
  });

  it('opens the account form in a full-height keyboard-scrollable sheet', () => {
    render(<EmailAuthCard presentation="embedded" />);

    fireEvent.click(screen.getByTestId('settings-account-open-signin'));

    expect(screen.getByTestId('settings-account-sheet').getAttribute('data-snap-points')).toBe(
      '["full"]'
    );
    expect(screen.getByTestId('account-sheet-scroll').getAttribute('data-keyboard-dismiss-mode'))
      .toBe('on-drag');
    expect(screen.getByTestId('account-sheet-scroll').getAttribute('data-keyboard-taps'))
      .toBe('handled');
    expect(screen.getByTestId('account-sheet-scroll').getAttribute('data-nested-scroll'))
      .toBe('true');
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
