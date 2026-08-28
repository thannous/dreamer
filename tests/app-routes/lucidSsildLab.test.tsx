/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { createLucidGuidedRitualPlan } from '@/lib/lucid/guidedRitual';
import type { LucidSafetyPolicy } from '@/lib/lucid/safety';
import {
  createLucidSsildSensoryLabSession,
  startLucidSsildSensoryLabSession,
  tickLucidSsildSensoryLabSession,
  type LucidSsildSensoryLabSession,
} from '@/lib/lucid/ssildSensoryLab';

const NOW = 1_700_000_000_000;
const mockBack = jest.fn();
const mockReplace = jest.fn();
let mockCanGoBack = false;
const mockStartNew = jest.fn();
const mockTick = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockExit = jest.fn();
const mockComplete = jest.fn();
const mockRefresh = jest.fn();
const mockPlayTransition = jest.fn().mockResolvedValue(true);
const mockStopSound = jest.fn().mockResolvedValue(undefined);
const mockSelectionAsync = jest.fn().mockResolvedValue(undefined);
const mockUseGuidedRitualSound = jest.fn((enabled: boolean) => ({
  playTransition: mockPlayTransition,
  stop: mockStopSound,
  enabled,
}));

let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'fr';
let mockAudioEnabled = false;
let mockReduceMotion = false;
let mockSleepQuality: number | null = 4;
let mockWakeSensitive = false;
const mockWindow = { width: 390, fontScale: 1 };
let appStateListener: ((state: 'active' | 'background' | 'inactive') => void) | undefined;
let mockAppState: 'active' | 'background' | 'inactive' = 'active';
let mockLab = {
  currentSession: null as LucidSsildSensoryLabSession | null,
  plan: null as ReturnType<typeof createLucidSsildPlan> | null,
  phase: null as ReturnType<typeof currentPhase> | null,
  progression: 0,
  remainingMs: 0,
  isLoading: false,
  isMutating: false,
  error: null as string | null,
};

function policy(mode: LucidSafetyPolicy['mode']): LucidSafetyPolicy {
  return {
    mode,
    allowWbtb: mode === 'normal',
    allowNightSignals: mode === 'normal',
    nightSignalIntensity: mode === 'normal' ? 'normal' : 'blocked',
    emergencyStopAllowed: true,
    reasons: [],
  };
}

function readyPlan(mode: LucidSafetyPolicy['mode'] = 'normal') {
  const plan = createLucidGuidedRitualPlan('ssild', policy(mode));
  if (plan.status !== 'ready') throw new Error('Expected a ready SSILD plan');
  return plan;
}

function idle(plan = readyPlan()): LucidSsildSensoryLabSession {
  return createLucidSsildSensoryLabSession({
    plan,
    sessionId: 'ssild_ui',
    now: NOW,
  });
}

function running(plan = readyPlan(), elapsedMs = 0): LucidSsildSensoryLabSession {
  const started = startLucidSsildSensoryLabSession(idle(plan), NOW + 1);
  if (elapsedMs <= 0) return started;
  return tickLucidSsildSensoryLabSession(started, started.startedAt! + elapsedMs).session;
}

function createLucidSsildPlan(plan = readyPlan()) {
  const session = idle(plan);
  return {
    mode: session.planMode,
    soundAllowed: session.soundAllowed,
    totalDurationMs: plan.totalDurationSeconds * 1000,
    phases: Array.from({ length: session.phaseCount }),
  };
}

function currentPhase(session: LucidSsildSensoryLabSession | null) {
  if (!session) return null;
  const { getLucidSsildSensoryLabCurrentPhase } = jest.requireActual('@/lib/lucid/ssildSensoryLab');
  return getLucidSsildSensoryLabCurrentPhase(session);
}

function syncLab(session: LucidSsildSensoryLabSession | null, extras: Partial<typeof mockLab> = {}) {
  mockLab = {
    currentSession: session,
    plan: session ? createLucidSsildPlan(readyPlan(session.planMode === 'reduced' ? 'reducedIntensity' : 'normal')) : null,
    phase: currentPhase(session),
    progression: session ? session.accumulatedElapsedMs / (session.planMode === 'reduced' ? 180_000 : 300_000) : 0,
    remainingMs: session
      ? (session.planMode === 'reduced' ? 180_000 : 300_000) - session.accumulatedElapsedMs
      : 0,
    isLoading: false,
    isMutating: false,
    error: null,
    ...extras,
  };
}

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    replace: (...args: unknown[]) => mockReplace(...args),
    canGoBack: () => mockCanGoBack,
  },
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native', () => {
  const actual = jest.requireActual('../react-native-stub');
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'ios' },
    useWindowDimensions: () => mockWindow,
    AppState: {
      get currentState() {
        return mockAppState;
      },
      addEventListener: (_event: string, listener: (state: 'active' | 'background' | 'inactive') => void) => {
        appStateListener = (state) => {
          mockAppState = state;
          listener(state);
        };
        return { remove: () => { appStateListener = undefined; } };
      },
    },
  };
});
jest.mock('expo-haptics', () => ({
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: mockLocale, chrome: { common: { loading: 'Chargement…', retry: 'Réessayer' } } },
    state: {
      onboarding: {
        audioSafetyAccepted: true,
        wakeSensitivity: mockWakeSensitive ? 'sensitive' : 'not_sensitive',
      },
      experiments: mockSleepQuality == null ? [] : [
        { id: 'obs', occurredAt: NOW, updatedAt: NOW, sleepQuality: mockSleepQuality, recallLevel: 3, result: 'none' },
      ],
      preferences: { audioCuesEnabled: mockAudioEnabled },
    },
    userScope: 'guest',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
    surfaceRaised: '#eee',
    borderInteractive: '#ccc',
  }),
}));

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => mockReduceMotion,
}));

jest.mock('@/hooks/useLucidSsildSensoryLab', () => ({
  useLucidSsildSensoryLab: () => ({
    ...mockLab,
    startNew: mockStartNew,
    tick: mockTick,
    pause: mockPause,
    resume: mockResume,
    interruptAudio: jest.fn(),
    exit: mockExit,
    complete: mockComplete,
    refresh: mockRefresh,
    clear: jest.fn(),
  }),
}));

jest.mock('@/hooks/useLucidGuidedRitualSound', () => ({
  useLucidGuidedRitualSound: (enabled: boolean) => mockUseGuidedRitualSound(enabled),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, footer, testID, title, trailing }: any) => (
    <main data-testid={testID}>
      <h1>{title}</h1>
      {trailing}
      {children}
      <footer>{footer}</footer>
    </main>
  ),
  LucidButton: ({ disabled, label, loading, onPress, testID, variant }: any) => (
    <button data-testid={testID} data-loading={loading ? 'true' : 'false'} data-variant={variant} disabled={disabled || loading} onClick={onPress}>
      {label}
    </button>
  ),
  LucidCard: ({ children, testID }: any) => <section data-testid={testID}>{children}</section>,
  LucidIconAction: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
  LucidProgressBar: ({ accessibilityLabel }: any) => <div role="progressbar" aria-label={accessibilityLabel} />,
}));

const { default: LucidSsildSensoryLabScreen } = require('@/app/lucid/ssild-lab');

describe('Lucid SSILD sensory lab screen', () => {
  beforeEach(() => {
    mockLocale = 'fr';
    mockAudioEnabled = false;
    mockReduceMotion = false;
    mockSleepQuality = 4;
    mockWakeSensitive = false;
    mockWindow.width = 390;
    mockWindow.fontScale = 1;
    appStateListener = undefined;
    mockAppState = 'active';
    syncLab(null);
    mockStartNew.mockReset().mockImplementation(async (plan: ReturnType<typeof readyPlan>) => {
      const next = running(plan);
      syncLab(next);
      return next;
    });
    mockTick.mockReset().mockResolvedValue(undefined);
    mockPause.mockReset().mockResolvedValue(undefined);
    mockResume.mockReset().mockResolvedValue(undefined);
    mockExit.mockReset().mockResolvedValue(undefined);
    mockComplete.mockReset().mockResolvedValue(undefined);
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockPlayTransition.mockClear();
    mockStopSound.mockClear();
    mockSelectionAsync.mockClear();
    mockCanGoBack = false;
    mockBack.mockClear();
    mockReplace.mockClear();
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('refuses recovery/replacement and sends the user back to programs', () => {
    mockSleepQuality = 1;
    render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByTestId('lucid-ssild-lab-recovery').textContent).toMatch(/récupération/);
    expect(screen.queryByText('Commencer la pratique')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/programs');
    expect(mockStartNew).not.toHaveBeenCalled();
    expect(screen.queryByText(/premium/i)).toBeNull();
  });

  it('starts a full 300s plan and a reduced 180s plan from current safety', async () => {
    render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByText('Environ 5 min')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    await waitFor(() => expect(mockStartNew).toHaveBeenCalledTimes(1));
    expect(mockStartNew.mock.calls[0][0]).toMatchObject({
      technique: 'ssild',
      mode: 'full',
      totalDurationSeconds: 300,
    });

    cleanup();
    mockWakeSensitive = true;
    syncLab(null);
    render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByText('Environ 3 min')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    await waitFor(() => expect(mockStartNew).toHaveBeenCalledTimes(2));
    expect(mockStartNew.mock.calls[1][0]).toMatchObject({
      technique: 'ssild',
      mode: 'reduced',
      totalDurationSeconds: 180,
      soundAllowed: false,
    });
  });

  it('keeps the lab silent when sound is forbidden and still shows the current sense', () => {
    syncLab(running(readyPlan('reducedIntensity'), 50_000));
    render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByTestId('lucid-ssild-lab-object-state').textContent).toBe('Ouïe');
    expect(screen.getByText(/objet visuel est atténué/)).not.toBeNull();
    expect(screen.getByText(/Silencieux/)).not.toBeNull();
    expect(mockUseGuidedRitualSound).toHaveBeenCalledWith(false);
    expect(mockPlayTransition).not.toHaveBeenCalled();
  });

  it('plays optional sound and redundant body haptics only when the plan and preference allow them', async () => {
    mockAudioEnabled = true;
    syncLab(running(readyPlan('normal'), 160_000));
    render(<LucidSsildSensoryLabScreen />);
    expect(mockUseGuidedRitualSound).toHaveBeenCalledWith(true);
    await waitFor(() => expect(mockPlayTransition).toHaveBeenCalled());
    await waitFor(() => expect(mockSelectionAsync).toHaveBeenCalled());
    expect(screen.getByTestId('lucid-ssild-lab-object-state').textContent).toBe('Corps');
  });

  it('plays the optional cue once per phase across ticks and resets it on a new start', async () => {
    mockAudioEnabled = true;
    const first = running(readyPlan('normal'), 20_000);
    syncLab(first);
    const { rerender } = render(<LucidSsildSensoryLabScreen />);
    await waitFor(() => expect(mockPlayTransition).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/texte reste prioritaire/)).not.toBeNull();

    syncLab({ ...first, accumulatedElapsedMs: 21_000, elapsedInPhaseMs: 21_000, updatedAt: NOW + 22_000 });
    rerender(<LucidSsildSensoryLabScreen />);
    syncLab({ ...first, accumulatedElapsedMs: 22_000, elapsedInPhaseMs: 22_000, updatedAt: NOW + 23_000 });
    rerender(<LucidSsildSensoryLabScreen />);
    expect(mockPlayTransition).toHaveBeenCalledTimes(1);

    const nextPhase = running(readyPlan('normal'), 80_000);
    syncLab(nextPhase);
    rerender(<LucidSsildSensoryLabScreen />);
    await waitFor(() => expect(mockPlayTransition).toHaveBeenCalledTimes(2));

    mockPlayTransition.mockClear();
    const restarted = running();
    mockStartNew.mockResolvedValueOnce(restarted);
    syncLab(null);
    rerender(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    await waitFor(() => expect(mockStartNew).toHaveBeenCalledTimes(1));
    syncLab(restarted);
    rerender(<LucidSsildSensoryLabScreen />);
    await waitFor(() => expect(mockPlayTransition).toHaveBeenCalledTimes(1));
  });

  it('ticks once per second without overlapping and never completes from pause or exit', async () => {
    jest.useFakeTimers();
    let resolveTick!: () => void;
    mockTick.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve;
        })
    );
    syncLab(running());
    render(<LucidSsildSensoryLabScreen />);
    await waitFor(() => expect(appStateListener).toBeDefined());
    jest.advanceTimersByTime(1000);
    jest.advanceTimersByTime(1000);
    expect(mockTick).toHaveBeenCalledTimes(1);
    resolveTick();
    await waitFor(() => expect(mockTick).toHaveBeenCalledTimes(1));
    expect(mockComplete).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('lucid-ssild-lab-pause'));
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('pauses, resumes, exits and background-pauses a running session without inventing completion', async () => {
    syncLab(running());
    const { rerender } = render(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-pause'));
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));

    syncLab({
      ...running(),
      status: 'paused',
      lastResumedAt: null,
      pausedAt: NOW + 20,
      updatedAt: NOW + 20,
    });
    rerender(<LucidSsildSensoryLabScreen />);
    expect(screen.getByTestId('lucid-ssild-lab-primary').textContent).toBe('Reprendre');
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    await waitFor(() => expect(mockResume).toHaveBeenCalledTimes(1));

    syncLab(running());
    rerender(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(mockExit).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/programs');
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();

    syncLab(running());
    rerender(<LucidSsildSensoryLabScreen />);
    appStateListener?.('background');
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(2));
    expect(mockStopSound).toHaveBeenCalled();
  });

  it('still pauses after a background event that lands during an in-flight tick', async () => {
    let resolveTick!: () => void;
    mockTick.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveTick = resolve;
        })
    );
    syncLab(running(), { isMutating: true });
    const { rerender, unmount } = render(<LucidSsildSensoryLabScreen />);
    appStateListener?.('background');
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));
    expect(mockComplete).not.toHaveBeenCalled();

    resolveTick?.();
    syncLab(running(), { isMutating: false });
    rerender(<LucidSsildSensoryLabScreen />);
    await waitFor(() => expect(mockPause).toHaveBeenCalled());
    expect(mockComplete).not.toHaveBeenCalled();
    unmount();
    expect(appStateListener).toBeUndefined();
  });

  it('pauses immediately after a deferred start that finishes in the background', async () => {
    let resolveStart!: (value: LucidSsildSensoryLabSession) => void;
    const started = running();
    mockStartNew.mockImplementationOnce(
      () =>
        new Promise<LucidSsildSensoryLabSession>((resolve) => {
          resolveStart = resolve;
        })
    );
    syncLab(null);
    const { unmount } = render(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    appStateListener?.('background');
    expect(mockPause).not.toHaveBeenCalled();
    resolveStart(started);
    await waitFor(() => expect(mockStartNew).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));
    expect(mockComplete).not.toHaveBeenCalled();
    unmount();
    expect(appStateListener).toBeUndefined();
  });

  it('keeps Reduce Motion content and order without continuous motion', () => {
    mockReduceMotion = true;
    syncLab(running());
    const { container } = render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByTestId('lucid-ssild-lab-static')).not.toBeNull();
    expect(container.innerHTML).not.toMatch(/Animated|Reanimated/);
    expect(screen.getByTestId('lucid-ssild-lab-object-state').textContent).toBe('S’apaiser');
    expect(screen.getByText('Ne cherchez à produire aucune expérience.')).not.toBeNull();
  });

  it('stacks compactly at 320 px and high fontScale while keeping live-region a11y', () => {
    syncLab(running());
    mockWindow.width = 320;
    mockWindow.fontScale = 1.3;
    render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByTestId('lucid-ssild-lab-step-compact')).not.toBeNull();
    expect(screen.getByTestId('lucid-ssild-lab-live').getAttribute('aria-live') || 'polite').toBeTruthy();
    expect(screen.getByRole('progressbar', { name: /Sens 1 sur / })).not.toBeNull();
  });

  it('keeps the same behavior in EN/ES/DE/IT and never shows a paywall', () => {
    for (const locale of ['en', 'es', 'de', 'it'] as const) {
      cleanup();
      mockLocale = locale;
      syncLab(null);
      render(<LucidSsildSensoryLabScreen />);
      expect(screen.getByTestId('lucid-ssild-lab-primary')).not.toBeNull();
      expect(screen.queryByText(/premium/i)).toBeNull();
      expect(screen.queryByText(/paywall/i)).toBeNull();
    }
  });

  it('uses native back after exiting a running SSILD lab when history exists', async () => {
    mockCanGoBack = true;
    syncLab(running());
    render(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(mockExit).toHaveBeenCalledTimes(1));
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('replaces to programs after leaving a running SSILD lab when history is empty', async () => {
    syncLab(running());
    render(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-leave'));
    await waitFor(() => expect(mockExit).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/(tabs)/programs');
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockComplete).not.toHaveBeenCalled();
  });

  it('does not close after a failed SSILD exit', async () => {
    mockExit.mockRejectedValueOnce(new Error('persist failed'));
    syncLab(running());
    render(<LucidSsildSensoryLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-leave'));
    await waitFor(() => expect(mockExit).toHaveBeenCalledTimes(1));
    expect(mockBack).not.toHaveBeenCalled();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('retries a failed load and never exposes a no-op Start', async () => {
    syncLab(null, { error: 'persistence_failed' });
    render(<LucidSsildSensoryLabScreen />);
    expect(screen.getByTestId('lucid-ssild-lab-error').textContent).toMatch(/n’a pas pu être enregistré/);
    expect(screen.getByTestId('lucid-ssild-lab-primary').textContent).toBe('Réessayer');
    fireEvent.click(screen.getByTestId('lucid-ssild-lab-primary'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockStartNew).not.toHaveBeenCalled();
  });
});
