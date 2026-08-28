/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import {
  createLucidStabilizationLabSession,
  startLucidStabilizationLabSession,
  type LucidStabilizationLabSession,
} from '@/lib/lucid/stabilizationLab';

const NOW = 1_700_000_000_000;
const mockBack = jest.fn();
const mockStartNew = jest.fn();
const mockAdvance = jest.fn();
const mockRepeat = jest.fn();
const mockPause = jest.fn();
const mockResume = jest.fn();
const mockInterrupt = jest.fn();
const mockComplete = jest.fn();
const mockRefresh = jest.fn();
const mockPlayTransition = jest.fn().mockResolvedValue(true);
const mockNotificationAsync = jest.fn().mockResolvedValue(undefined);
const mockSelectionAsync = jest.fn().mockResolvedValue(undefined);
const mockUseGuidedRitualSound = jest.fn((enabled: boolean) => ({
  playTransition: mockPlayTransition,
  stop: jest.fn(),
  enabled,
}));

let mockLocale: 'en' | 'fr' | 'es' | 'de' | 'it' = 'fr';
let mockAudioEnabled = false;
let mockLab = {
  sessions: [] as LucidStabilizationLabSession[],
  currentSession: null as LucidStabilizationLabSession | null,
  insights: {
    completionCount: 0,
    practiceCount: 0,
    repeatCount: 0,
    lastPracticedAt: null as number | null,
    recentCompletedAt: null as number | null,
  },
  isLoading: false,
  isMutating: false,
  error: null as string | null,
};

function idle(): LucidStabilizationLabSession {
  return createLucidStabilizationLabSession({ now: NOW, sessionId: 'stab_one' });
}

function active(overrides: Partial<LucidStabilizationLabSession> = {}): LucidStabilizationLabSession {
  return { ...startLucidStabilizationLabSession(idle(), NOW + 1), ...overrides };
}

jest.mock('expo-router', () => ({ router: { back: mockBack } }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
const mockWindow = { width: 390, fontScale: 1 };
jest.mock('react-native', () => {
  const actual = jest.requireActual('../react-native-stub');
  return {
    ...actual,
    Platform: { ...actual.Platform, OS: 'ios' },
    useWindowDimensions: () => mockWindow,
  };
});
jest.mock('expo-haptics', () => ({
  NotificationFeedbackType: { Success: 'success' },
  notificationAsync: (...args: unknown[]) => mockNotificationAsync(...args),
  selectionAsync: (...args: unknown[]) => mockSelectionAsync(...args),
}));

jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    content: { locale: mockLocale, chrome: { common: { loading: 'Chargement…', retry: 'Réessayer' } } },
    state: { preferences: { audioCuesEnabled: mockAudioEnabled } },
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
  }),
}));

jest.mock('@/hooks/useLucidStabilizationLab', () => ({
  useLucidStabilizationLab: () => ({
    ...mockLab,
    startNew: mockStartNew,
    advance: mockAdvance,
    repeat: mockRepeat,
    pause: mockPause,
    resume: mockResume,
    interrupt: mockInterrupt,
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
  LucidMetric: ({ label, style, value }: any) => (
    <div data-flex-basis={style?.flexBasis} data-testid={`metric-${label}`}>{label}: {value}</div>
  ),
  LucidProgressBar: ({ accessibilityLabel }: any) => <div role="progressbar" aria-label={accessibilityLabel} />,
}));

const { default: LucidStabilizationLabScreen } = require('@/app/lucid/stabilization-lab');

describe('Lucid stabilization lab screen', () => {
  beforeEach(() => {
    mockLocale = 'fr';
    mockAudioEnabled = false;
    mockLab = {
      sessions: [],
      currentSession: null,
      insights: {
        completionCount: 2,
        practiceCount: 3,
        repeatCount: 4,
        lastPracticedAt: NOW,
        recentCompletedAt: NOW,
      },
      isLoading: false,
      isMutating: false,
      error: null,
    };
    mockStartNew.mockReset().mockResolvedValue(active());
    mockAdvance.mockReset().mockResolvedValue(undefined);
    mockRepeat.mockReset().mockResolvedValue(undefined);
    mockPause.mockReset().mockResolvedValue(undefined);
    mockResume.mockReset().mockResolvedValue(undefined);
    mockInterrupt.mockReset().mockResolvedValue(undefined);
    mockComplete.mockReset().mockResolvedValue(undefined);
    mockRefresh.mockReset().mockResolvedValue(undefined);
    mockPlayTransition.mockClear();
    mockNotificationAsync.mockClear();
    mockSelectionAsync.mockClear();
    mockBack.mockClear();
    mockWindow.width = 390;
    mockWindow.fontScale = 1;
  });

  afterEach(() => {
    cleanup();
  });

  it('shows disclaimer, duration, Insights and a start CTA without inventing dream data', () => {
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByText('Laboratoire de stabilisation')).not.toBeNull();
    expect(screen.getByText(/ne garantit ni lucidité/)).not.toBeNull();
    expect(screen.getByText('Environ 4 min 30 s')).not.toBeNull();
    expect(screen.getByText('Pratiques: 3')).not.toBeNull();
    expect(screen.getByText('Complétions: 2')).not.toBeNull();
    expect(screen.getByText('Répétitions: 4')).not.toBeNull();
    expect(screen.getByTestId('lucid-stabilization-lab-primary').textContent).toBe('Recommencer');
    expect(screen.queryByText(/premium/i)).toBeNull();
    expect(screen.queryByText(/rêve source/i)).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    expect(mockStartNew).toHaveBeenCalledTimes(1);
  });

  it('exposes one current step, accessible progress and concrete copy', () => {
    mockLab.currentSession = active();
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByRole('progressbar', { name: 'Étape 1 sur 5' })).not.toBeNull();
    expect(screen.getByText('Regarde tes mains')).not.toBeNull();
    expect(screen.queryByText(/Ne les saisis pas et ne les enregistre pas/)).toBeNull();
    expect(screen.getByText('Regarde tes mains jusqu’à ce qu’elles te semblent stables.')).not.toBeNull();
    expect(screen.getByText(/0 répétition/)).not.toBeNull();
    expect(screen.getByTestId('lucid-stabilization-lab-primary').textContent).toBe('Terminer cette étape');
  });

  it('keeps three-details copy from asking for typed or persisted content', () => {
    mockLab.currentSession = active({
      stepIndex: 2,
      completedStepIds: ['hands', 'surface'],
    });
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByText('Nomme trois détails')).not.toBeNull();
    expect(screen.getByText(/Ne les saisis pas et ne les enregistre pas/)).not.toBeNull();
  });

  it('plays visual and haptic advance feedback without treating repeat as advance', async () => {
    mockLab.currentSession = active();
    render(<LucidStabilizationLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    await waitFor(() => expect(mockAdvance).toHaveBeenCalledTimes(1));
    expect(screen.getByTestId('lucid-stabilization-lab-live').textContent).toBe('Étape terminée.');
    expect(mockNotificationAsync).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-repeat'));
    await waitFor(() => expect(mockRepeat).toHaveBeenCalledTimes(1));
    expect(mockAdvance).toHaveBeenCalledTimes(1);
    expect(mockSelectionAsync).toHaveBeenCalled();
  });

  it('locks a double tap so the primary action runs once', async () => {
    let resolveAdvance!: () => void;
    const pending = new Promise<void>((resolve) => {
      resolveAdvance = resolve;
    });
    mockAdvance.mockReturnValueOnce(pending);
    mockLab.currentSession = active();
    render(<LucidStabilizationLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-repeat'));
    expect(mockAdvance).toHaveBeenCalledTimes(1);
    expect(mockRepeat).not.toHaveBeenCalled();
    expect(screen.getByTestId('lucid-stabilization-lab-repeat')).toHaveProperty('disabled', true);
    resolveAdvance();
    await waitFor(() => expect(screen.getByTestId('lucid-stabilization-lab-live').textContent).toBe('Étape terminée.'));
  });

  it('keeps only the primary action in the footer', () => {
    mockLab.currentSession = active();
    render(<LucidStabilizationLabScreen />);
    const footer = screen.getByTestId('lucid-stabilization-lab').querySelector('footer');
    expect(footer?.querySelectorAll('button')).toHaveLength(1);
    expect(footer?.textContent).toBe('Terminer cette étape');
    expect(screen.getByTestId('lucid-stabilization-lab-repeat')).not.toBeNull();
    expect(screen.getByTestId('lucid-stabilization-lab-pause')).not.toBeNull();
    expect(screen.getByTestId('lucid-stabilization-lab-leave')).not.toBeNull();
  });

  it('pauses, resumes and interrupts before closing an active session', async () => {
    mockLab.currentSession = active();
    const { rerender } = render(<LucidStabilizationLabScreen />);
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-pause'));
    await waitFor(() => expect(mockPause).toHaveBeenCalledTimes(1));

    mockLab.currentSession = { ...active(), status: 'paused' };
    rerender(<LucidStabilizationLabScreen />);
    expect(screen.getByTestId('lucid-stabilization-lab-primary').textContent).toBe('Reprendre');
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    await waitFor(() => expect(mockResume).toHaveBeenCalledTimes(1));

    mockLab.currentSession = active();
    rerender(<LucidStabilizationLabScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    await waitFor(() => expect(mockInterrupt).toHaveBeenCalledTimes(1));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('completes only when the last step is already marked', async () => {
    mockLab.currentSession = active({
      stepIndex: 4,
      completedStepIds: ['hands', 'surface', 'three_details', 'intention', 'slow_before_control'],
    });
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByTestId('lucid-stabilization-lab-primary').textContent).toBe('Terminer le laboratoire');
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    await waitFor(() => expect(mockComplete).toHaveBeenCalledTimes(1));
    expect(mockAdvance).not.toHaveBeenCalled();
  });

  it('retries a failed load from the footer and never exposes a no-op Start', async () => {
    mockLab.error = 'persistence_failed';
    mockLab.currentSession = null;
    mockLab.isLoading = false;
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByTestId('lucid-stabilization-lab-error').textContent).toMatch(/n’a pas pu être enregistré/);
    expect(screen.getByTestId('lucid-stabilization-lab-primary').textContent).toBe('Réessayer');
    expect(screen.queryByText('Commencer la pratique')).toBeNull();
    expect(screen.queryByText('Recommencer')).toBeNull();
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(mockStartNew).not.toHaveBeenCalled();
    expect(mockUseGuidedRitualSound).toHaveBeenCalledWith(false);
  });

  it('keeps session actions after a mutation error and uses optional sound when audio cues are enabled', async () => {
    mockLab.error = 'persistence_failed';
    mockLab.currentSession = active();
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByTestId('lucid-stabilization-lab-error').textContent).toMatch(/n’a pas pu être enregistré/);
    expect(screen.getByTestId('lucid-stabilization-lab-primary').textContent).toBe('Terminer cette étape');
    expect(screen.getByText('Regarde tes mains')).not.toBeNull();

    cleanup();
    mockLab.error = null;
    mockLab.currentSession = active();
    mockAudioEnabled = true;
    render(<LucidStabilizationLabScreen />);
    expect(mockUseGuidedRitualSound).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByTestId('lucid-stabilization-lab-primary'));
    await waitFor(() => expect(mockPlayTransition).toHaveBeenCalled());
  });

  it('stacks metrics in a compact column at 320 px and high fontScale', () => {
    mockLab.currentSession = active();
    const wide = render(<LucidStabilizationLabScreen />);
    expect(screen.getByTestId('metric-Pratiques').getAttribute('data-flex-basis')).toBeNull();
    wide.unmount();

    mockWindow.width = 320;
    mockWindow.fontScale = 1.3;
    render(<LucidStabilizationLabScreen />);
    expect(screen.getByTestId('metric-Pratiques').getAttribute('data-flex-basis')).toBe('100%');
    expect(screen.getByTestId('metric-Complétions').getAttribute('data-flex-basis')).toBe('100%');
    expect(screen.getByTestId('metric-Répétitions').getAttribute('data-flex-basis')).toBe('100%');
  });

  it('stays fully static with no Animated tree and the same copy when motion is reduced', () => {
    mockLab.currentSession = active();
    const { container } = render(<LucidStabilizationLabScreen />);
    expect(container.innerHTML).not.toMatch(/Animated|Reanimated/);
    expect(screen.getByText('Regarde tes mains')).not.toBeNull();
    expect(screen.getByTestId('lucid-stabilization-lab-primary')).not.toBeNull();
  });

  it('goes back without interrupting a paused session', () => {
    mockLab.currentSession = { ...active(), status: 'paused' };
    render(<LucidStabilizationLabScreen />);
    fireEvent.click(screen.getByLabelText('Fermer'));
    expect(mockInterrupt).not.toHaveBeenCalled();
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
