/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockCompleteProgramSession = jest.fn().mockResolvedValue(undefined);
const mockUpdateGuidedRitual = jest.fn();
const mockCompleteGuidedRitualSession = jest.fn().mockResolvedValue(undefined);
const mockPlayTransition = jest.fn().mockResolvedValue(true);
const mockStopSound = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
let mockRouteParams = { program: 'mild', session: '1' };
let mockAudioSafetyAccepted = false;
let mockWakeSensitivity: 'sensitive' | 'not_sensitive' | null = 'not_sensitive';
let mockReduceMotion = false;
let mockDreams: { id: number; title: string; transcript: string }[] = [];
let mockActiveDreamSigns: {
  id: string;
  label: string;
  category: null;
  distinctDreamCount: number;
  sourceDreamIds: string[];
}[] = [];
let mockProgress: {
  technique: 'mild' | 'ssild' | 'wbtb';
  status: 'active' | 'paused';
  currentDay: number;
  completedExerciseIds: string[];
  guidedRitual?: GuidedProgress;
}[] = [];

type GuidedProgress = {
  version: 1;
  sessionId: string;
  technique: 'mild' | 'ssild';
  status: 'in_progress' | 'abandoned' | 'completed';
  stepIndex: number;
  stepCount: number;
  mode: 'full' | 'reduced' | 'replacement';
  startedAt: number;
  stepStartedAt: number;
  completedAt: number | null;
  updatedAt: number;
};

function guidedProgress(overrides: Partial<GuidedProgress> = {}): GuidedProgress {
  const now = Date.now();
  return {
    version: 1,
    sessionId: 'mild:mild-01',
    technique: 'mild',
    status: 'in_progress',
    stepIndex: 0,
    stepCount: 5,
    mode: 'full',
    startedAt: now,
    stepStartedAt: now,
    completedAt: null,
    updatedAt: now,
    ...overrides,
  };
}

function addMildSource() {
  mockDreams = [{ id: 42, title: 'The glass station', transcript: 'A mirror floated above the platform.' }];
  mockActiveDreamSigns = [{
    id: 'sign:mirror',
    label: 'Floating mirror',
    category: null,
    distinctDreamCount: 2,
    sourceDreamIds: ['42'],
  }];
}

jest.mock('expo-router', () => ({
  router: { back: mockBack, canGoBack: mockCanGoBack, replace: mockReplace, push: jest.fn() },
  useLocalSearchParams: () => mockRouteParams,
}));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => <span aria-hidden="true" /> }));
jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => <img alt="" data-testid={testID} />,
}));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
jest.mock('expo-haptics', () => ({
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success' },
  impactAsync: jest.fn().mockResolvedValue(undefined),
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('react-native-reanimated', () => ({
  __esModule: true,
  default: { View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => <div data-testid={testID}>{children}</div> },
}));

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    AccessibilityInfo: { announceForAccessibility: jest.fn() },
    Alert: { alert: jest.fn() },
    Text: ({ accessibilityLiveRegion, accessibilityRole, children }: { accessibilityLiveRegion?: string; accessibilityRole?: string; children?: React.ReactNode }) =>
      React.createElement(accessibilityRole === 'header' ? 'h1' : 'span', { 'aria-live': accessibilityLiveRegion }, children),
    View: ({ accessibilityLabel, accessibilityRole, accessibilityValue, children, testID }: { accessibilityLabel?: string; accessibilityRole?: string; accessibilityValue?: { min?: number; max?: number; now?: number }; children?: React.ReactNode; testID?: string }) => (
      <div
        aria-label={accessibilityLabel}
        aria-valuemax={accessibilityValue?.max}
        aria-valuemin={accessibilityValue?.min}
        aria-valuenow={accessibilityValue?.now}
        data-testid={testID}
        role={accessibilityRole}
      >
        {children}
      </div>
    ),
  };
});

jest.mock('@/components/motion', () => ({
  DURATION: { fast: 200 },
  EASE: { out: 'ease-out' },
  PressableScale: ({
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    children,
    disabled,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { checked?: boolean; disabled?: boolean };
    children: React.ReactNode;
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      aria-checked={accessibilityState?.checked}
      aria-disabled={accessibilityState?.disabled}
      aria-label={accessibilityLabel}
      data-testid={testID}
      disabled={disabled}
      onClick={onPress}
      role={accessibilityRole}
    >
      {children}
    </button>
  ),
}));

jest.mock('@/components/lucid/LucidGuideOrb', () => ({
  LucidGuideOrb: ({ testID }: { testID?: string }) => <div data-testid={testID} />,
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: ({ disabled, label, loading, onPress, testID }: { disabled?: boolean; label: string; loading?: boolean; onPress: () => void; testID?: string }) => (
    <button data-testid={testID} disabled={disabled || loading} onClick={onPress}>{label}</button>
  ),
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => <button aria-label={label} onClick={onPress} />,
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidProgressBar: ({ accessibilityLabel, value }: { accessibilityLabel: string; value: number }) => (
    <div aria-label={accessibilityLabel} aria-valuenow={Math.round(value * 100)} role="progressbar" />
  ),
  LucidScreen: ({ children, eyebrow, footer, testID, title, trailing }: { children: React.ReactNode; eyebrow?: string; footer?: React.ReactNode; testID?: string; title?: string; trailing?: React.ReactNode }) => (
    <main data-testid={testID}>
      {eyebrow ? <span>{eyebrow}</span> : null}
      {title ? <h1>{title}</h1> : null}
      {trailing}
      {children}
      {footer}
    </main>
  ),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/context/DreamsContext', () => ({
  useDreamsData: () => ({ dreams: mockDreams, loaded: true }),
}));

jest.mock('@/hooks/useLucidReducedMotion', () => ({
  useLucidReducedMotion: () => mockReduceMotion,
}));

jest.mock('@/hooks/useLucidGuidedRitualSound', () => ({
  useLucidGuidedRitualSound: () => ({
    playTransition: mockPlayTransition,
    stop: mockStopSound,
  }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: {
        onboarding: {
          audioSafetyAccepted: mockAudioSafetyAccepted,
          wakeSensitivity: mockWakeSensitivity,
        },
        experiments: [],
        preferences: { audioCuesEnabled: true },
        progress: mockProgress,
      },
      content: getLucidContent('en'),
      activeDreamSigns: mockActiveDreamSigns,
      completeProgramSession: mockCompleteProgramSession,
      updateGuidedRitual: mockUpdateGuidedRitual,
      completeGuidedRitualSession: mockCompleteGuidedRitualSession,
    }),
  };
});

const sessionModule = require('@/app/lucid/session/[program]/[session]');
const LucidSessionScreen = sessionModule.default as React.ComponentType;
const getLucidGuidedPhaseMotion = sessionModule.getLucidGuidedPhaseMotion as (reduced: boolean) => {
  animationName: { from: { transform?: unknown }; to: { transform?: unknown } };
};

describe('Lucid Trainer session', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-08-28T20:00:00Z'));
    jest.clearAllMocks();
    mockRouteParams = { program: 'mild', session: '1' };
    mockProgress = [];
    mockAudioSafetyAccepted = false;
    mockWakeSensitivity = 'not_sensitive';
    mockReduceMotion = false;
    mockDreams = [];
    mockActiveDreamSigns = [];
    mockCanGoBack.mockReturnValue(true);
    mockUpdateGuidedRitual.mockImplementation(async (input: { action: string; technique: 'mild' | 'ssild'; exerciseId: string }) => {
      const current = mockProgress.find((item) => item.technique === input.technique)?.guidedRitual;
      if (input.action === 'advance' && current) {
        return { ...current, stepIndex: current.stepIndex + 1, stepStartedAt: Date.now(), updatedAt: Date.now() + 1 };
      }
      if (input.action === 'abandon' && current) {
        return { ...current, status: 'abandoned', updatedAt: Date.now() + 1 };
      }
      if (input.action === 'resume' && current) {
        return { ...current, status: 'in_progress', stepStartedAt: Date.now(), updatedAt: Date.now() + 1 };
      }
      return guidedProgress({
        sessionId: `${input.technique}:${input.exerciseId}`,
        technique: input.technique,
        stepCount: input.technique === 'mild' ? 5 : 6,
      });
    });
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('puts the evening objective before MILD and requires a confirmed journal source', () => {
    render(<LucidSessionScreen />);

    expect(screen.getByRole('heading', { name: 'Recognize a familiar sign inside your next dream.' })).not.toBeNull();
    expect(screen.getByText('Technique · MILD')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Prepare one personal cue first' })).not.toBeNull();
    expect(screen.getByTestId('lucid-guided-open-signs')).not.toBeNull();
    expect(screen.queryByTestId('lucid-guided-start')).toBeNull();
  });

  it('starts MILD with the latest source-linked dream and confirmed sign', async () => {
    addMildSource();
    render(<LucidSessionScreen />);

    expect(screen.getByText('The glass station')).not.toBeNull();
    expect(screen.getByText('Floating mirror')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-guided-start'));

    await waitFor(() => {
      expect(mockUpdateGuidedRitual).toHaveBeenCalledWith({
        technique: 'mild',
        exerciseId: 'mild-01',
        sessionNumber: 1,
        sessionCount: 7,
        action: 'start',
      });
    });
    expect(mockPlayTransition).toHaveBeenCalled();
  });

  it('uses the journal scene and confirmed sign inside active MILD phases', () => {
    addMildSource();
    mockProgress = [{
      technique: 'mild',
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
      guidedRitual: guidedProgress({ stepIndex: 2 }),
    }];

    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-guided-phase-mild_recognize')).not.toBeNull();
    expect(screen.getAllByText(/Floating mirror/)).toHaveLength(2);
    expect(screen.getByTestId('lucid-guided-mild-source')).not.toBeNull();
  });

  it('resumes an abandoned ritual at its persisted phase', async () => {
    addMildSource();
    mockProgress = [{
      technique: 'mild',
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
      guidedRitual: guidedProgress({ status: 'abandoned', stepIndex: 2 }),
    }];
    render(<LucidSessionScreen />);

    expect(screen.getByText('Resume where I stopped')).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-guided-start'));

    await waitFor(() => {
      expect(mockUpdateGuidedRitual).toHaveBeenCalledWith(expect.objectContaining({ action: 'resume' }));
    });
  });

  it('persists abandonment before closing an active ritual', async () => {
    addMildSource();
    const active = guidedProgress({ stepIndex: 1 });
    mockProgress = [{ technique: 'mild', status: 'active', currentDay: 1, completedExerciseIds: [], guidedRitual: active }];
    render(<LucidSessionScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Save progress and close' }));

    await waitFor(() => {
      expect(mockUpdateGuidedRitual).toHaveBeenCalledWith(expect.objectContaining({ action: 'abandon' }));
      expect(mockStopSound).toHaveBeenCalled();
      expect(mockBack).toHaveBeenCalled();
    });
  });

  it('advances automatically and completes the final phase without an alert screen', async () => {
    addMildSource();
    const final = guidedProgress({ stepIndex: 4 });
    mockProgress = [{ technique: 'mild', status: 'active', currentDay: 1, completedExerciseIds: [], guidedRitual: final }];
    render(<LucidSessionScreen />);

    await act(async () => {
      jest.advanceTimersByTime(45_000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockCompleteGuidedRitualSession).toHaveBeenCalledWith('mild', 'mild-01', 1, 7);
      expect(mockBack).toHaveBeenCalled();
    });
    const { Alert } = require('react-native');
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('persists a non-final phase transition when its timer elapses', async () => {
    addMildSource();
    const first = guidedProgress({ stepIndex: 0 });
    mockProgress = [{ technique: 'mild', status: 'active', currentDay: 1, completedExerciseIds: [], guidedRitual: first }];
    render(<LucidSessionScreen />);

    await act(async () => {
      jest.advanceTimersByTime(45_000);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockUpdateGuidedRitual).toHaveBeenCalledWith(expect.objectContaining({ action: 'advance' }));
    });
    expect(mockCompleteGuidedRitualSession).not.toHaveBeenCalled();
  });

  it('shortens the visible ritual when sleep is marked as sensitive', () => {
    addMildSource();
    mockAudioSafetyAccepted = true;
    mockWakeSensitivity = 'sensitive';
    render(<LucidSessionScreen />);

    expect(screen.getByText('Shortened to protect sleep')).not.toBeNull();
    expect(screen.getByText('About 3 minutes')).not.toBeNull();
  });

  it('keeps SSILD concise and independent from dream-sign data', () => {
    mockRouteParams = { program: 'ssild', session: '1' };
    mockProgress = [{
      technique: 'ssild',
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
      guidedRitual: guidedProgress({
        sessionId: 'ssild:ssild-01',
        technique: 'ssild',
        stepCount: 6,
        stepIndex: 1,
      }),
    }];
    render(<LucidSessionScreen />);

    expect(screen.getByRole('heading', { name: 'Sight' })).not.toBeNull();
    expect(screen.getByText('Notice the darkness behind your eyelids.')).not.toBeNull();
    expect(screen.queryByTestId('lucid-guided-mild-source')).toBeNull();
  });

  it('removes translation from phase changes when reduced motion is requested', () => {
    expect(getLucidGuidedPhaseMotion(false).animationName.from.transform).toEqual([{ translateY: 8 }]);
    expect(getLucidGuidedPhaseMotion(true).animationName.from.transform).toBeUndefined();
    expect(getLucidGuidedPhaseMotion(true).animationName.to.transform).toBeUndefined();
  });

  it('blocks a future sequential session opened by URL and returns to the program', () => {
    mockRouteParams = { program: 'mild', session: '3' };
    mockProgress = [{ technique: 'mild', status: 'active', currentDay: 1, completedExerciseIds: [] }];
    mockCanGoBack.mockReturnValue(false);

    render(<LucidSessionScreen />);

    fireEvent.click(screen.getByTestId('lucid-session-unavailable-back'));
    expect(mockReplace).toHaveBeenCalledWith('/lucid/program/mild');
    expect(mockCompleteProgramSession).not.toHaveBeenCalled();
  });

  it('keeps the legacy WBTB checklist when safety consent allows it', () => {
    mockRouteParams = { program: 'wbtb', session: '1' };
    mockAudioSafetyAccepted = true;
    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session')).not.toBeNull();
    expect(screen.getByTestId('lucid-session-complete')).not.toBeNull();
    expect(screen.queryByTestId('lucid-guided-intro')).toBeNull();
  });

  it('still reopens a completed WBTB session when current policy blocks WBTB', () => {
    mockRouteParams = { program: 'wbtb', session: '1' };
    mockProgress = [{ technique: 'wbtb', status: 'active', currentDay: 2, completedExerciseIds: ['wbtb-01'] }];
    render(<LucidSessionScreen />);

    expect(screen.getByTestId('lucid-session-complete')).not.toBeNull();
    expect(screen.queryByTestId('lucid-session-unavailable-back')).toBeNull();
  });
});
