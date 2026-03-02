/* @jest-environment jsdom */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const {
  mockGetMockMode,
  mockSetMockMode,
  mockSetCurrentUser,
  mockSetAccountCreated,
  mockSetStayOnSettings,
  mockGetAuthChangeHandler,
  mockGetCurrentUser,
  mockWasAccountCreatedOnDevice,
  mockOnAuthChange,
  mockClearRemoteDreamStorage,
  mockConsumeStayOnSettingsIntent,
  mockRouterReplace,
  mockCreateCircuitBreaker,
  mockGetSession,
  mockRefreshSession,
} = ((factory: any) => factory())(() => {
  let mockMode = true;
  let currentUser: any = null;
  let accountCreated = false;
  let stayOnSettings = false;
  let authChangeHandler:
    | ((nextUser: any, session?: { access_token?: string | null }) => Promise<void> | void)
    | null = null;

  const mockGetCurrentUser = jest.fn(() => Promise.resolve(currentUser));
  const mockWasAccountCreatedOnDevice = jest.fn(() => Promise.resolve(accountCreated));
  const mockOnAuthChange = jest.fn((handler) => {
    authChangeHandler = handler;
    return () => {};
  });

  const mockClearRemoteDreamStorage = jest.fn();
  const mockConsumeStayOnSettingsIntent = jest.fn(() => stayOnSettings);
  const mockRouterReplace = jest.fn();

  const mockCreateCircuitBreaker = jest.fn(() => ({
    shouldBlock: () => false,
    record: jest.fn(),
  }));

  const mockGetSession = jest.fn().mockResolvedValue({ data: { session: null } });
  const mockRefreshSession = jest.fn().mockResolvedValue(undefined);

  return {
    mockGetMockMode: () => mockMode,
    mockSetMockMode: (value: boolean) => {
      mockMode = value;
    },
    mockSetCurrentUser: (user: any) => {
      currentUser = user;
    },
    mockSetAccountCreated: (value: boolean) => {
      accountCreated = value;
    },
    mockSetStayOnSettings: (value: boolean) => {
      stayOnSettings = value;
    },
    mockGetAuthChangeHandler: () => authChangeHandler,
    mockGetCurrentUser,
    mockWasAccountCreatedOnDevice,
    mockOnAuthChange,
    mockClearRemoteDreamStorage,
    mockConsumeStayOnSettingsIntent,
    mockRouterReplace,
    mockCreateCircuitBreaker,
    mockGetSession,
    mockRefreshSession,
  };
});

jest.mock('@/lib/env', () => ({
  isMockModeEnabled: () => mockGetMockMode(),
}));

jest.mock('@/lib/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
  onAuthChange: mockOnAuthChange,
  wasAccountCreatedOnDevice: mockWasAccountCreatedOnDevice,
}));

jest.mock('@/lib/circuitBreaker', () => ({
  createCircuitBreaker: mockCreateCircuitBreaker,
}));

jest.mock('@/lib/navigationIntents', () => ({
  consumeStayOnSettingsIntent: mockConsumeStayOnSettingsIntent,
}));

jest.mock('@/services/storageService', () => ({
  clearRemoteDreamStorage: mockClearRemoteDreamStorage,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}));

jest.mock('expo-router', () => ({
  router: {
    replace: mockRouterReplace,
  },
}));

const { AuthProvider, useAuth } = require('../AuthContext');

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetMockMode(true);
    mockSetCurrentUser(null);
    mockSetAccountCreated(false);
    mockSetStayOnSettings(false);
  });

  it('given mock mode with user__when provider mounts__then exposes user and session ready', async () => {
    mockSetMockMode(true);
    mockSetCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user?.id).toBe('user-1');
    expect(result.current.sessionReady).toBe(true);
    expect(result.current.returningGuestBlocked).toBe(false);
    expect(mockRouterReplace).not.toHaveBeenCalled();
  });

  it('given mock mode without user and returning guest__when provider mounts__then blocks guest', async () => {
    mockSetMockMode(true);
    mockSetCurrentUser(null);
    mockSetAccountCreated(true);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.sessionReady).toBe(false);
    expect(result.current.returningGuestBlocked).toBe(true);
  });

  it('given stay-on-settings intent__when user loads__then navigates to settings', async () => {
    mockSetCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });
    mockSetStayOnSettings(true);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(mockRouterReplace).toHaveBeenCalledWith('/(tabs)/settings');
  });

  it('given user tier update__when setUserTierLocally called__then updates metadata', async () => {
    mockSetCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      result.current.setUserTierLocally('premium');
    });

    expect(result.current.user?.app_metadata?.tier).toBe('premium');
    expect(result.current.user?.user_metadata?.tier).toBe('premium');
  });

  it('given auth change to new user__when onAuthChange fires__then clears remote storage and updates state', async () => {
    mockSetCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider>{children}</AuthProvider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await waitFor(() => {
      expect(mockOnAuthChange).toHaveBeenCalled();
    });

    const handler = mockGetAuthChangeHandler();
    expect(typeof handler).toBe('function');

    await act(async () => {
      await handler?.({ id: 'user-2', email: 'next@example.com', app_metadata: {}, user_metadata: {} }, { access_token: 'token' });
    });

    expect(mockClearRemoteDreamStorage).toHaveBeenCalled();
    expect(result.current.user?.id).toBe('user-2');
    expect(result.current.sessionReady).toBe(true);
  });

  it('given missing provider__when using hook__then throws', () => {
    expect(() => renderHook(() => useAuth())).toThrow('useAuth must be used within AuthProvider');
  });
});
