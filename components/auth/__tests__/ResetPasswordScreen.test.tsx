/* @jest-environment jsdom */
import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

type RecoveryListener = (event: string, session: unknown) => void;

const mockReplace = jest.fn();
const mockUpdatePassword = jest.fn();
const mockUnsubscribe = jest.fn();
let mockRecoveryListeners: RecoveryListener[] = [];
let mockCurrentUser: { id: string } | null = null;
let mockAuthLoading = false;

((key: string, value: unknown) => {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
})('__DEV__', false);

jest.mock('react-native', () => jest.requireActual('../../../tests/react-native-stub'));

jest.mock('expo-router', () => ({
  router: { replace: mockReplace },
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@supabase/auth-js', () => ({
  isAuthApiError: (error: unknown) =>
    Boolean(error && typeof error === 'object' && 'status' in error && 'code' in error),
}));

jest.mock('@/components/inspiration/AtmosphericBackground', () => ({
  AtmosphericBackground: () => <div data-testid="atmosphere" />,
}));

jest.mock('@/components/icons/DreamIcons', () => ({
  EyeIcon: () => <div data-testid="eye-icon" />,
  EyeOffIcon: () => <div data-testid="eye-off-icon" />,
}));

jest.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: mockCurrentUser, loading: mockAuthLoading }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      accent: '#f58c8c',
      accentText: '#f58c8c',
      backgroundCard: '#111',
      backgroundDark: '#000',
      backgroundSecondary: '#222',
      divider: '#333',
      textPrimary: '#fff',
      textSecondary: '#ccc',
    },
    mode: 'dark',
  }),
}));

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock('@/lib/appVariant', () => ({
  isLucidTrainer: false,
}));

jest.mock('@/lib/auth', () => ({
  onPasswordRecovery: (cb: RecoveryListener) => {
    mockRecoveryListeners.push(cb);
    return mockUnsubscribe;
  },
  updatePassword: mockUpdatePassword,
}));

jest.mock('@/constants/journalTheme', () => ({
  ThemeLayout: {
    borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
    spacing: { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 },
  },
}));

jest.mock('@/constants/theme', () => ({
  Fonts: {
    spaceGrotesk: {
      regular: 'SpaceGrotesk-Regular',
      medium: 'SpaceGrotesk-Medium',
      bold: 'SpaceGrotesk-Bold',
    },
  },
}));

const { default: ResetPasswordScreen } = require('../ResetPasswordScreen');

const emitRecovery = (event: string, session: unknown = null) => {
  act(() => {
    mockRecoveryListeners.forEach((listener) => listener(event, session));
  });
};

const fillPasswords = (password: string, confirm: string) => {
  fireEvent.change(screen.getByTestId(TID.Input.AuthNewPassword), { target: { value: password } });
  fireEvent.change(screen.getByTestId(TID.Input.AuthConfirmPassword), { target: { value: confirm } });
};

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRecoveryListeners = [];
    mockCurrentUser = null;
    mockAuthLoading = false;
    mockUpdatePassword.mockResolvedValue({ id: 'user-1' });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a checking state while auth is still loading', () => {
    mockAuthLoading = true;

    render(<ResetPasswordScreen />);

    expect(screen.getByText('auth.reset_password.checking')).toBeDefined();
    expect(screen.queryByTestId(TID.Input.AuthNewPassword)).toBeNull();
    expect(screen.queryByText('auth.reset_password.expired_title')).toBeNull();
  });

  it('shows the expired state with a way back to sign-in when no recovery session exists', () => {
    render(<ResetPasswordScreen />);

    expect(screen.getByText('auth.reset_password.expired_title')).toBeDefined();
    expect(screen.getByText('auth.reset_password.expired_message')).toBeDefined();
    expect(screen.queryByTestId(TID.Input.AuthNewPassword)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.AuthResetBackToSignIn));

    expect(mockReplace).toHaveBeenCalledWith('/(tabs)/settings');
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('unlocks the form when supabase emits PASSWORD_RECOVERY', () => {
    render(<ResetPasswordScreen />);
    expect(screen.getByText('auth.reset_password.expired_title')).toBeDefined();

    emitRecovery('PASSWORD_RECOVERY', { access_token: 'token' });

    expect(screen.getByText('auth.reset_password.title')).toBeDefined();
    expect(screen.getByTestId(TID.Input.AuthNewPassword)).toBeDefined();
    expect(screen.getByTestId(TID.Input.AuthConfirmPassword)).toBeDefined();
  });

  it('unlocks the form from an existing session delivered as INITIAL_SESSION', () => {
    render(<ResetPasswordScreen />);

    emitRecovery('INITIAL_SESSION', null);
    expect(screen.getByText('auth.reset_password.expired_title')).toBeDefined();

    emitRecovery('INITIAL_SESSION', { access_token: 'token' });
    expect(screen.getByTestId(TID.Input.AuthNewPassword)).toBeDefined();
  });

  it('unsubscribes from recovery events on unmount', () => {
    const { unmount } = render(<ResetPasswordScreen />);
    unmount();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('validates the new password length and confirmation before enabling submit', () => {
    mockCurrentUser = { id: 'user-1' };

    render(<ResetPasswordScreen />);

    const submit = () => screen.getByTestId(TID.Button.AuthUpdatePassword) as HTMLButtonElement;
    expect(submit().disabled).toBe(true);

    fillPasswords('123', '123');
    expect(screen.getByText('auth.password.too_short')).toBeDefined();
    expect(submit().disabled).toBe(true);

    fillPasswords('secret123', 'secret124');
    expect(screen.getByText('auth.reset_password.mismatch')).toBeDefined();
    expect(submit().disabled).toBe(true);

    fillPasswords('secret123', 'secret123');
    expect(screen.queryByText('auth.reset_password.mismatch')).toBeNull();
    expect(submit().disabled).toBe(false);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it('updates the password, shows the success state and continues to the app', async () => {
    mockCurrentUser = { id: 'user-1' };

    render(<ResetPasswordScreen />);
    fillPasswords('secret123', 'secret123');
    fireEvent.click(screen.getByTestId(TID.Button.AuthUpdatePassword));

    await waitFor(() => {
      expect(mockUpdatePassword).toHaveBeenCalledWith('secret123');
    });
    await waitFor(() => {
      expect(screen.getByText('auth.reset_password.success_title')).toBeDefined();
    });
    expect(screen.queryByTestId(TID.Input.AuthNewPassword)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.AuthResetContinue));
    expect(mockReplace).toHaveBeenCalledWith('/recording');
  });

  it('shows a generic error and keeps the form when the update fails', async () => {
    mockCurrentUser = { id: 'user-1' };
    mockUpdatePassword.mockRejectedValue(new Error('network'));

    render(<ResetPasswordScreen />);
    fillPasswords('secret123', 'secret123');
    fireEvent.click(screen.getByTestId(TID.Button.AuthUpdatePassword));

    await waitFor(() => {
      expect(screen.getByTestId(TID.Text.AuthResetPasswordError).textContent).toBe(
        'auth.reset_password.error'
      );
    });
    expect(screen.getByTestId(TID.Input.AuthNewPassword)).toBeDefined();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('maps the same_password auth error to its dedicated message', async () => {
    mockCurrentUser = { id: 'user-1' };
    mockUpdatePassword.mockRejectedValue(
      Object.assign(new Error('New password should be different'), { status: 422, code: 'same_password' })
    );

    render(<ResetPasswordScreen />);
    fillPasswords('secret123', 'secret123');
    fireEvent.click(screen.getByTestId(TID.Button.AuthUpdatePassword));

    await waitFor(() => {
      expect(screen.getByTestId(TID.Text.AuthResetPasswordError).textContent).toBe(
        'auth.reset_password.same_password'
      );
    });
  });
});
