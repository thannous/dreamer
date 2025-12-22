/* @vitest-environment happy-dom */
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  getMockMode,
  setMockMode,
  setCurrentUser,
  setAccountCreated,
  setStayOnSettings,
  getAuthChangeHandler,
  mockGetCurrentUser,
  mockWasAccountCreatedOnDevice,
  mockOnAuthChange,
  mockClearRemoteDreamStorage,
  mockConsumeStayOnSettingsIntent,
  mockRouterReplace,
  mockCreateCircuitBreaker,
  mockGetSession,
  mockRefreshSession,
} = vi.hoisted(() => {
  let mockMode = true;
  let currentUser: any = null;
  let accountCreated = false;
  let stayOnSettings = false;
  let authChangeHandler:
    | ((nextUser: any, session?: { access_token?: string | null }) => Promise<void> | void)
    | null = null;

  const mockGetCurrentUser = vi.fn(() => Promise.resolve(currentUser));
  const mockWasAccountCreatedOnDevice = vi.fn(() => Promise.resolve(accountCreated));
  const mockOnAuthChange = vi.fn((handler) => {
    authChangeHandler = handler;
    return () => {};
  });

  const mockClearRemoteDreamStorage = vi.fn();
  const mockConsumeStayOnSettingsIntent = vi.fn(() => stayOnSettings);
  const mockRouterReplace = vi.fn();

  const mockCreateCircuitBreaker = vi.fn(() => ({
    shouldBlock: () => false,
    record: vi.fn(),
  }));

  const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
  const mockRefreshSession = vi.fn().mockResolvedValue(undefined);

  return {
    getMockMode: () => mockMode,
    setMockMode: (value: boolean) => {
      mockMode = value;
    },
    setCurrentUser: (user: any) => {
      currentUser = user;
    },
    setAccountCreated: (value: boolean) => {
      accountCreated = value;
    },
    setStayOnSettings: (value: boolean) => {
      stayOnSettings = value;
    },
    getAuthChangeHandler: () => authChangeHandler,
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

vi.mock('@/lib/env', () => ({
  isMockModeEnabled: () => getMockMode(),
}));

vi.mock('@/lib/auth', () => ({
  getCurrentUser: mockGetCurrentUser,
  onAuthChange: mockOnAuthChange,
  wasAccountCreatedOnDevice: mockWasAccountCreatedOnDevice,
}));

vi.mock('@/lib/circuitBreaker', () => ({
  createCircuitBreaker: mockCreateCircuitBreaker,
}));

vi.mock('@/lib/navigationIntents', () => ({
  consumeStayOnSettingsIntent: mockConsumeStayOnSettingsIntent,
}));

vi.mock('@/services/storageService', () => ({
  clearRemoteDreamStorage: mockClearRemoteDreamStorage,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      refreshSession: mockRefreshSession,
    },
  },
}));

vi.mock('expo-router', () => ({
  router: {
    replace: mockRouterReplace,
  },
}));

const { AuthProvider, useAuth } = await import('../AuthContext');

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockMode(true);
    setCurrentUser(null);
    setAccountCreated(false);
    setStayOnSettings(false);
  });

  it('given mock mode with user__when provider mounts__then exposes user and session ready', async () => {
    setMockMode(true);
    setCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });

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
    setMockMode(true);
    setCurrentUser(null);
    setAccountCreated(true);

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
    setCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });
    setStayOnSettings(true);

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
    setCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });

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
    setCurrentUser({ id: 'user-1', email: 'test@example.com', app_metadata: {}, user_metadata: {} });

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

    const handler = getAuthChangeHandler();
    expect(handler).toBeTypeOf('function');

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
