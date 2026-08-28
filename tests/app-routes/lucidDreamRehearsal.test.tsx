/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  completeLucidDreamRehearsalSession,
  confirmLucidDreamRehearsalIntention,
  createLucidDreamRehearsalSession,
  recognizeLucidDreamRehearsalSign,
  selectLucidDreamRehearsalScene,
  type LucidDreamRehearsalSession,
} from '@/lib/lucid/dreamRehearsal';

const NOW = 1_700_000_000_000;
const DREAM_ID = '1700000000000';
const SIGN_ID = 'sign:mirror';

const mockBack = jest.fn();
const mockReplace = jest.fn();
const mockStart = jest.fn();
const mockRecognize = jest.fn();
const mockConfirmIntention = jest.fn();
const mockInterrupt = jest.fn();
const mockResume = jest.fn();
const mockComplete = jest.fn();
const mockRefresh = jest.fn();
const mockPlayTransition = jest.fn().mockResolvedValue(true);
const mockSelectionAsync = jest.fn().mockResolvedValue(undefined);
const mockUseGuidedRitualSound = jest.fn((enabled: boolean) => ({
  playTransition: mockPlayTransition,
  stop: jest.fn(),
  enabled,
}));

let mockParams: { dreamId?: string; signId?: string } = { dreamId: DREAM_ID, signId: SIGN_ID };
let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'fr';
const mockRefreshSubscription = jest.fn().mockResolvedValue({ tier: 'free', isActive: false });
let mockSubscription: {
  status: { tier: 'guest' | 'free' | 'plus'; isActive: boolean } | null;
  loading: boolean;
  requiresAuth: boolean;
  refreshSubscription: typeof mockRefreshSubscription;
} = {
  status: { tier: 'free', isActive: false },
  loading: false,
  requiresAuth: true,
  refreshSubscription: mockRefreshSubscription,
};
let mockAudioEnabled = false;
let mockReduceMotion = false;
const mockWindow = { width: 390, fontScale: 1 };
let mockRehearsal = {
  currentSession: null as LucidDreamRehearsalSession | null,
  completions: [] as { sessionId: string }[],
  isLoading: false,
  isMutating: false,
  error: null as string | null,
};

const mockDreams = [
  { id: Number(DREAM_ID), title: 'The hallway', transcript: 'I saw a hallway mirror.' },
];
const mockSigns = [
  {
    id: SIGN_ID,
    label: 'Hallway mirror',
    category: 'object' as const,
    distinctDreamCount: 2,
    sourceDreamIds: [DREAM_ID],
    evidence: [],
  },
];

function scene() {
  const result = selectLucidDreamRehearsalScene(mockDreams, mockSigns, DREAM_ID, SIGN_ID);
  if (result.status !== 'ready') throw new Error('Expected a ready scene');
  return result.scene;
}

function started(now = NOW): LucidDreamRehearsalSession {
  return createLucidDreamRehearsalSession({
    scene: scene(),
    sessionId: 'rehearse_live',
    sourceProgram: { kind: 'atlas' },
    presentation: 'motion',
    now,
  });
}

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  router: { back: mockBack, replace: mockReplace, push: mockPush },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('react-native', () => {
  const actual = jest.requireActual('../react-native-stub');
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'ios' },
    useWindowDimensions: () => mockWindow,
  };
});
jest.mock('expo-haptics', () => ({
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: mockLocale, chrome: { common: { loading: 'Chargement…', retry: 'Réessayer' } } },
    state: {
      preferences: { audioCuesEnabled: mockAudioEnabled },
      dreamSignDecisions: [{ id: SIGN_ID, decision: 'confirmed' }],
    },
    userScope: 'guest',
    dreamSignCandidates: mockSigns,
  }),
}));

jest.mock('@/hooks/useSubscription', () => ({
  useSubscription: () => mockSubscription,
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
  }),
}));

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => mockReduceMotion,
}));

jest.mock('@/hooks/useLucidDreamRehearsal', () => ({
  useLucidDreamRehearsal: () => ({
    ...mockRehearsal,
    start: mockStart,
    recognize: mockRecognize,
    confirmIntention: mockConfirmIntention,
    interrupt: mockInterrupt,
    resume: mockResume,
    complete: mockComplete,
    refresh: mockRefresh,
    clearCurrent: jest.fn(),
    clearAll: jest.fn(),
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
  LucidButton: ({ disabled, label, loading, onPress, testID }: any) => (
    <button data-testid={testID} disabled={disabled || loading} onClick={onPress}>
      {label}
    </button>
  ),
  LucidCard: ({ children, testID, style }: any) => (
    <section data-compact={style?.some?.((item: any) => item?.marginBottom === 8) ? 'true' : undefined} data-testid={testID}>
      {children}
    </section>
  ),
  LucidIconAction: ({ label, onPress }: any) => <button aria-label={label} onClick={onPress} />,
  LucidProgressBar: ({ accessibilityLabel }: any) => <div role="progressbar" aria-label={accessibilityLabel} />,
}));

const { default: LucidDreamRehearsalScreen } = require('@/app/lucid/dream-rehearsal');

describe('Lucid dream rehearsal screen', () => {
  beforeEach(() => {
    mockParams = { dreamId: DREAM_ID, signId: SIGN_ID };
    mockLocale = 'fr';
    mockAudioEnabled = false;
    mockReduceMotion = false;
    mockWindow.width = 390;
    mockWindow.fontScale = 1;
    mockRehearsal = {
      currentSession: null,
      completions: [],
      isLoading: false,
      isMutating: false,
      error: null,
    };
    mockRefreshSubscription.mockReset().mockResolvedValue({ tier: 'free', isActive: false });
    mockSubscription = {
      status: { tier: 'free', isActive: false },
      loading: false,
      requiresAuth: true,
      refreshSubscription: mockRefreshSubscription,
    };
    mockStart.mockReset().mockResolvedValue(started());
    mockRecognize.mockReset().mockResolvedValue(undefined);
    mockConfirmIntention.mockReset().mockResolvedValue(undefined);
    mockInterrupt.mockReset().mockResolvedValue(undefined);
    mockResume.mockReset().mockResolvedValue(undefined);
    mockComplete.mockReset().mockResolvedValue(undefined);
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockPlayTransition.mockClear();
    mockSelectionAsync.mockClear();
    mockBack.mockClear();
    mockReplace.mockClear();
    mockPush.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the exact chosen scene without inventing copy', () => {
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-scene').textContent).toMatch(/The hallway/);
    expect(screen.getByTestId('lucid-dream-rehearsal-scene').textContent).toMatch(/hallway mirror/);
    expect(screen.getByRole('button', { name: 'Commencer la scène gratuite' })).not.toBeNull();
    expect(screen.queryByText(/premium/i)).toBeNull();
  });

  it('rejects missing and unmatched params without choosing another dream or sign', () => {
    mockParams = {};
    const missing = render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-selection-error').textContent).toMatch(/Choisis un rêve/);
    expect(screen.queryByTestId('lucid-dream-rehearsal-scene')).toBeNull();
    missing.unmount();

    mockParams = { dreamId: DREAM_ID, signId: 'sign:stairs' };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-selection-error').textContent).toMatch(/ne sont pas liés/);
    expect(screen.queryByRole('button', { name: 'Commencer la scène gratuite' })).toBeNull();
  });

  it('starts, recognizes, confirms intention and completes in order', async () => {
    const { rerender } = render(<LucidDreamRehearsalScreen />);
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith(scene(), { kind: 'atlas' }, 'motion'));

    mockRehearsal = { ...mockRehearsal, currentSession: started() };
    rerender(<LucidDreamRehearsalScreen />);
    expect(screen.getByText(/Cherche exactement ce signe/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockRecognize).toHaveBeenCalledWith(SIGN_ID));

    mockRehearsal = {
      ...mockRehearsal,
      currentSession: recognizeLucidDreamRehearsalSign(started(), SIGN_ID, NOW + 1),
    };
    rerender(<LucidDreamRehearsalScreen />);
    expect(screen.getByText(/intention lucide en silence/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockConfirmIntention).toHaveBeenCalled());

    const intended = confirmLucidDreamRehearsalIntention(
      recognizeLucidDreamRehearsalSign(started(), SIGN_ID, NOW + 1),
      NOW + 2
    );
    mockRehearsal = { ...mockRehearsal, currentSession: intended };
    rerender(<LucidDreamRehearsalScreen />);
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockComplete).toHaveBeenCalled());

    mockRehearsal = {
      ...mockRehearsal,
      currentSession: completeLucidDreamRehearsalSession(intended, NOW + 3),
      completions: [{ sessionId: 'rehearse_live' }],
    };
    rerender(<LucidDreamRehearsalScreen />);
    expect(screen.getByText(/Seul un enregistrement local/)).not.toBeNull();
    expect(screen.getByRole('progressbar').getAttribute('aria-label')).toBe('Étape 2 sur 2');
    expect(JSON.stringify(mockRehearsal.completions)).not.toMatch(/transcript|intention|premium/i);
  });

  it('resumes an interrupted session and interrupts an active one on back', async () => {
    const recognized = recognizeLucidDreamRehearsalSign(started(), SIGN_ID, NOW + 1);
    mockRehearsal = {
      ...mockRehearsal,
      currentSession: { ...recognized, status: 'interrupted', updatedAt: NOW + 2 },
    };
    const { rerender } = render(<LucidDreamRehearsalScreen />);
    expect(screen.getByText(/Laissé pour plus tard/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockResume).toHaveBeenCalled());

    mockRehearsal = { ...mockRehearsal, currentSession: recognized };
    rerender(<LucidDreamRehearsalScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(mockInterrupt).toHaveBeenCalled());
    expect(mockBack).toHaveBeenCalled();
  });

  it('keeps text complete when sound and haptics fail, and uses static presentation with Reduce Motion', async () => {
    mockAudioEnabled = true;
    mockReduceMotion = true;
    mockPlayTransition.mockRejectedValueOnce(new Error('audio failed'));
    mockSelectionAsync.mockRejectedValueOnce(new Error('haptic failed'));
    mockRehearsal = { ...mockRehearsal, currentSession: started() };
    render(<LucidDreamRehearsalScreen />);
    expect(mockUseGuidedRitualSound).toHaveBeenCalledWith(true);
    expect(screen.getByText(/Cherche exactement ce signe/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockRecognize).toHaveBeenCalledWith(SIGN_ID));
    expect(screen.getByText(/Cherche exactement ce signe/)).not.toBeNull();

    cleanup();
    mockRehearsal = { ...mockRehearsal, currentSession: null };
    render(<LucidDreamRehearsalScreen />);
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledWith(scene(), { kind: 'atlas' }, 'static'));
  });

  it('compacts the scene card on a narrow Android width or large fontScale', () => {
    mockWindow.width = 360;
    mockWindow.fontScale = 1;
    const narrow = render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-scene-compact')).not.toBeNull();
    expect(screen.queryByTestId('lucid-dream-rehearsal-scene')).toBeNull();
    narrow.unmount();
    mockWindow.width = 430;
    mockWindow.fontScale = 1.3;
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-scene-compact')).not.toBeNull();
    expect(screen.queryByTestId('lucid-dream-rehearsal-scene')).toBeNull();
  });

  it('opens the exact in-progress session instead of starting over a different scene', () => {
    mockRehearsal = {
      ...mockRehearsal,
      currentSession: {
        ...started(),
        dreamId: '1700000001000',
        signId: 'sign:stairs',
        status: 'active',
      },
    };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-selection-error').textContent).toMatch(
      /Une autre répétition est déjà en cours/
    );
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockReplace).toHaveBeenCalledWith(
      `/lucid/dream-rehearsal?dreamId=${encodeURIComponent('1700000001000')}&signId=${encodeURIComponent('sign:stairs')}`
    );
  });

  it('surfaces a typed storage error without exposing raw reasons', () => {
    mockRehearsal = { ...mockRehearsal, error: 'persistence_failed' };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-error').textContent).toMatch(/n’a pas pu être enregistrée/);
    expect(screen.queryByText('persistence_failed')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('starts the free preview when completionCount is 0', async () => {
    render(<LucidDreamRehearsalScreen />);
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  });

  it('never starts a second free rehearsal after one completion', () => {
    mockRehearsal = {
      ...mockRehearsal,
      completions: [{ sessionId: 'rehearse_done' }],
    };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-gate')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith('/lucid/subscription?source=dream_rehearsal');
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-continue-free'));
    expect(mockBack).toHaveBeenCalled();
  });

  it('lets Plus start another rehearsal after the preview', async () => {
    mockSubscription = {
      ...mockSubscription,
      requiresAuth: false,
      status: { tier: 'plus', isActive: true },
    };
    mockRehearsal = {
      ...mockRehearsal,
      completions: [{ sessionId: 'rehearse_done' }],
    };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.queryByTestId('lucid-dream-rehearsal-gate')).toBeNull();
    expect(screen.getByRole('button', { name: 'Commencer la répétition' })).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
  });

  it('resumes an in-progress free session after the preview is used', async () => {
    const recognized = recognizeLucidDreamRehearsalSign(started(), SIGN_ID, NOW + 1);
    mockRehearsal = {
      ...mockRehearsal,
      completions: [{ sessionId: 'rehearse_done' }],
      currentSession: { ...recognized, status: 'interrupted', updatedAt: NOW + 2 },
    };
    render(<LucidDreamRehearsalScreen />);
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockResume).toHaveBeenCalled());
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('checks instead of assuming Plus when authenticated status is unresolved', async () => {
    mockSubscription = {
      ...mockSubscription,
      requiresAuth: false,
      loading: false,
      status: null,
    };
    mockRehearsal = {
      ...mockRehearsal,
      completions: [{ sessionId: 'rehearse_done' }],
    };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByTestId('lucid-dream-rehearsal-checking')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockRefreshSubscription).toHaveBeenCalledTimes(1));
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('lets a guest complete the free preview without a paywall', async () => {
    mockSubscription = {
      ...mockSubscription,
      requiresAuth: true,
      status: { tier: 'guest', isActive: false },
    };
    render(<LucidDreamRehearsalScreen />);
    expect(screen.getByRole('button', { name: 'Commencer la scène gratuite' })).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-dream-rehearsal-primary'));
    await waitFor(() => expect(mockStart).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('lucid-dream-rehearsal-gate')).toBeNull();
  });
});
