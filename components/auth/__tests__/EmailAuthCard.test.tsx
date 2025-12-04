/* @vitest-environment happy-dom */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthApiError } from '@supabase/auth-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    Animated: {
      Value: class {
        constructor(_value: number) {}
        setValue(_value: number) {}
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

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
}));

vi.mock('../EmailVerificationDialog', () => ({
  EmailVerificationDialog: () => <div data-testid="email-verification-dialog" />,
}));

vi.mock('../../../constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { sm: 4, md: 8, lg: 12 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24 },
  },
}));

describe('EmailAuthCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

