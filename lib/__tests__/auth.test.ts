import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockLogger = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const mockSupabaseAuth = {
  getSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  setSession: vi.fn(),
  resend: vi.fn(),
  signInWithIdToken: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
};

const mockSupabase = { auth: mockSupabaseAuth };

const mockMockAuth = {
  getAccessToken: vi.fn(),
  onAuthChange: vi.fn(),
  getCurrentUser: vi.fn(),
  signInWithEmailPassword: vi.fn(),
  signUpWithEmailPassword: vi.fn(),
  resendVerificationEmail: vi.fn(),
  signInWithGoogle: vi.fn(),
  signInWithGoogleWeb: vi.fn(),
  signOut: vi.fn(),
  signInWithProfile: vi.fn(),
  updateUserTier: vi.fn(),
};

const mockFetchJSON = vi.fn();
const mockGetDeviceFingerprint = vi.fn(async () => 'device-1');

const defaultGoogleModule = {
  GoogleSignin: {
    configure: vi.fn(),
    hasPlayServices: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
};

const loadAuth = async (options?: {
  mockMode?: boolean;
  platformOS?: 'ios' | 'web';
  googleModule?: typeof defaultGoogleModule | null;
}) => {
  const { mockMode = false, platformOS = 'ios', googleModule = defaultGoogleModule } = options ?? {};

  vi.resetModules();

  vi.doMock('react-native', () => ({
    Platform: { OS: platformOS },
  }));

  vi.doMock('../env', () => ({
    isMockModeEnabled: () => mockMode,
  }));

  vi.doMock('../logger', () => ({
    createScopedLogger: () => mockLogger,
  }));

  vi.doMock('../supabase', () => ({
    supabase: mockSupabase,
  }));

  vi.doMock('../mockAuth', () => mockMockAuth);

  vi.doMock('../deviceFingerprint', () => ({
    getDeviceFingerprint: mockGetDeviceFingerprint,
  }));

  vi.doMock('../config', () => ({
    getApiBaseUrl: () => 'https://api.example.com',
  }));

  vi.doMock('../http', () => ({
    fetchJSON: mockFetchJSON,
  }));

  if (googleModule) {
    vi.doMock('@react-native-google-signin/google-signin', () => googleModule);
  }

  return import('../auth');
};

describe('auth helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = '';

    const unsubscribe = vi.fn();
    mockSupabaseAuth.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe } },
    });

    mockSupabaseAuth.getSession.mockResolvedValue({
      data: { session: { access_token: 'access-token', user: { id: 'user-1' } } },
    });

    mockSupabaseAuth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    mockSupabaseAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    mockSupabaseAuth.signUp.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });

    mockSupabaseAuth.resend.mockResolvedValue({ error: null });

    mockSupabaseAuth.signInWithIdToken.mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });

    mockSupabaseAuth.setSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    mockSupabaseAuth.signOut.mockResolvedValue({ error: null });
    mockSupabaseAuth.signInWithOAuth.mockResolvedValue({ error: null });
    mockFetchJSON.mockResolvedValue({ ok: true });
  });

  it('initializes Google Sign-In when configured', async () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'client-id';
    const auth = await loadAuth();
    const { Platform } = await import('react-native');
    expect(Platform.OS).toBe('ios');

    auth.initializeGoogleSignIn();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(defaultGoogleModule.GoogleSignin.configure).toHaveBeenCalledWith(
      expect.objectContaining({
        webClientId: 'client-id',
        scopes: ['openid', 'email', 'profile'],
        offlineAccess: false,
      })
    );
  });

  it('warns when Google Sign-In client id is missing', async () => {
    const auth = await loadAuth();

    auth.initializeGoogleSignIn();

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID not configured')
    );
  });

  it('returns access token when available', async () => {
    const auth = await loadAuth();
    await expect(auth.getAccessToken()).resolves.toBe('access-token');
  });

  it('returns null when access token cannot be loaded', async () => {
    mockSupabaseAuth.getSession.mockRejectedValueOnce(new Error('boom'));
    const auth = await loadAuth();

    await expect(auth.getAccessToken()).resolves.toBeNull();
  });

  it('signs in with email and surfaces errors', async () => {
    const auth = await loadAuth();
    const user = await auth.signInWithEmailPassword('user@example.com', 'pass');

    expect(user?.id).toBe('user-1');

    mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: new Error('bad creds'),
    });

    await expect(auth.signInWithEmailPassword('user@example.com', 'pass')).rejects.toThrow('bad creds');
  });

  it('persists session after email sign-in when session is returned', async () => {
    mockSupabaseAuth.signInWithPassword.mockResolvedValueOnce({
      data: {
        user: { id: 'user-1' },
        session: { access_token: 'access-token', refresh_token: 'refresh-token' },
      },
      error: null,
    });
    const auth = await loadAuth();

    await auth.signInWithEmailPassword('user@example.com', 'pass');

    expect(mockSupabaseAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('falls back to session when getUser fails', async () => {
    mockSupabaseAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'fail' },
    });
    mockSupabaseAuth.getSession.mockResolvedValueOnce({
      data: { session: { user: { id: 'user-2' } } },
    });

    const auth = await loadAuth();
    const user = await auth.getCurrentUser();

    expect(user?.id).toBe('user-2');
  });

  it('returns null when getUser throws', async () => {
    mockSupabaseAuth.getUser.mockRejectedValueOnce(new Error('boom'));
    const auth = await loadAuth();

    await expect(auth.getCurrentUser()).resolves.toBeNull();
  });

  it('marks fingerprint after signup', async () => {
    const auth = await loadAuth();

    await auth.signUpWithEmailPassword('user@example.com', 'pass', 'en');

    expect(mockSupabaseAuth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'user@example.com',
        password: 'pass',
        options: expect.objectContaining({
          emailRedirectTo: expect.any(String),
          data: { lang: 'en' },
        }),
      })
    );

    expect(mockFetchJSON).toHaveBeenCalledWith(
      'https://api.example.com/auth/mark-upgrade',
      expect.objectContaining({
        method: 'POST',
        headers: { Authorization: 'Bearer access-token' },
        body: { fingerprint: 'device-1' },
      })
    );
  });

  it('persists session after signup when session is returned', async () => {
    mockSupabaseAuth.signUp.mockResolvedValueOnce({
      data: {
        user: { id: 'user-1' },
        session: { access_token: 'access-token', refresh_token: 'refresh-token' },
      },
      error: null,
    });
    const auth = await loadAuth();

    await auth.signUpWithEmailPassword('user@example.com', 'pass', 'en');

    expect(mockSupabaseAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('waits briefly for access token before marking fingerprint', async () => {
    vi.useFakeTimers();
    try {
      mockSupabaseAuth.getSession
        .mockResolvedValueOnce({ data: { session: null } })
        .mockResolvedValueOnce({ data: { session: null } })
        .mockResolvedValueOnce({
          data: { session: { access_token: 'access-token', user: { id: 'user-1' } } },
        });

      const auth = await loadAuth();
      const signUpPromise = auth.signUpWithEmailPassword('user@example.com', 'pass', 'en');

      await vi.runAllTimersAsync();
      await signUpPromise;

      expect(mockFetchJSON).toHaveBeenCalledWith(
        'https://api.example.com/auth/mark-upgrade',
        expect.objectContaining({
          method: 'POST',
          headers: { Authorization: 'Bearer access-token' },
          body: { fingerprint: 'device-1' },
        })
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('resends verification email and throws on failure', async () => {
    const auth = await loadAuth();

    await auth.resendVerificationEmail('user@example.com');
    expect(mockSupabaseAuth.resend).toHaveBeenCalled();

    mockSupabaseAuth.resend.mockResolvedValueOnce({ error: new Error('fail') });
    await expect(auth.resendVerificationEmail('user@example.com')).rejects.toThrow('fail');
  });

  it('signs in with Google and returns user', async () => {
    mockSupabaseAuth.signInWithIdToken.mockResolvedValueOnce({
      data: {
        user: { id: 'user-1', email: 'user@example.com' },
        session: { access_token: 'access-token', refresh_token: 'refresh-token' },
      },
      error: null,
    });
    defaultGoogleModule.GoogleSignin.signIn.mockResolvedValueOnce({ idToken: 'token-123' });
    const auth = await loadAuth();

    const user = await auth.signInWithGoogle();

    expect(defaultGoogleModule.GoogleSignin.hasPlayServices).toHaveBeenCalled();
    expect(mockSupabaseAuth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'google',
      token: 'token-123',
    });
    expect(mockSupabaseAuth.setSession).toHaveBeenCalledWith({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
    expect(user.id).toBe('user-1');
  });

  it('throws when Google sign-in is cancelled', async () => {
    defaultGoogleModule.GoogleSignin.signIn.mockResolvedValueOnce({ type: 'cancelled' });
    const auth = await loadAuth();

    await expect(auth.signInWithGoogle()).rejects.toThrow('SIGN_IN_CANCELLED');
  });

  it('maps Google sign-in errors to friendly messages', async () => {
    defaultGoogleModule.GoogleSignin.signIn.mockRejectedValueOnce({
      code: defaultGoogleModule.statusCodes.IN_PROGRESS,
      message: 'busy',
    });
    const auth = await loadAuth();

    await expect(auth.signInWithGoogle()).rejects.toThrow('Sign-in already in progress');
  });

  it('signs in with Google on web using OAuth', async () => {
    const auth = await loadAuth({ platformOS: 'web' });

    await auth.signInWithGoogleWeb();

    expect(mockSupabaseAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { scopes: 'openid email profile' },
    });
  });

  it('signs out from Google and Supabase', async () => {
    const auth = await loadAuth();

    await auth.signOut();

    expect(defaultGoogleModule.GoogleSignin.signOut).toHaveBeenCalled();
    expect(mockSupabaseAuth.signOut).toHaveBeenCalled();
  });

  it('propagates sign-out errors', async () => {
    mockSupabaseAuth.signOut.mockResolvedValueOnce({ error: new Error('fail') });
    const auth = await loadAuth();

    await expect(auth.signOut()).rejects.toThrow('fail');
  });

  it('returns mock access when mock mode is enabled', async () => {
    mockMockAuth.getAccessToken.mockResolvedValueOnce('mock-token');
    const auth = await loadAuth({ mockMode: true });

    await expect(auth.getAccessToken()).resolves.toBe('mock-token');
  });

  it('delegates to mock auth helpers in mock mode', async () => {
    const unsubscribe = vi.fn();
    mockMockAuth.onAuthChange.mockReturnValueOnce(unsubscribe);
    mockMockAuth.signInWithProfile.mockResolvedValueOnce({ id: 'mock-user' });
    mockMockAuth.updateUserTier.mockResolvedValueOnce({ id: 'mock-user' });

    const auth = await loadAuth({ mockMode: true });

    const unsubscriber = auth.onAuthChange(vi.fn());
    const mockUser = await auth.signInMock({ id: 'mock-user' } as any);
    const tierUser = await auth.updateUserTier('pro' as any);

    expect(unsubscriber).toBe(unsubscribe);
    expect(mockUser?.id).toBe('mock-user');
    expect(tierUser?.id).toBe('mock-user');
  });

  it('exposes auth change subscription in real mode', async () => {
    const auth = await loadAuth();
    const callback = vi.fn();

    const unsubscribe = auth.onAuthChange(callback);

    expect(mockSupabaseAuth.onAuthStateChange).toHaveBeenCalled();
    expect(unsubscribe).toEqual(expect.any(Function));
  });

  it('blocks tier updates outside mock mode', async () => {
    const auth = await loadAuth();

    await expect(auth.updateUserTier('pro' as any)).rejects.toThrow('updateUserTier() is disabled');
  });
});
