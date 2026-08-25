/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

type MildProgress = {
  technique: 'mild';
  status: 'active' | 'paused' | 'completed';
  currentDay: number;
  completedExerciseIds: string[];
  startedAt: number;
};

const mockPush = jest.fn();
const mockStartProgram = jest.fn().mockResolvedValue(undefined);
const mockPauseProgram = jest.fn().mockResolvedValue(undefined);
const DEFAULT_WINDOW_DIMENSIONS = { width: 390, height: 844, scale: 3, fontScale: 1 };
let mockProgress: MildProgress | undefined;
let mockProgramId = 'mild';
let mockWindowDimensions = DEFAULT_WINDOW_DIMENSIONS;

jest.mock('expo-router', () => ({
  router: {
    back: jest.fn(),
    canGoBack: jest.fn(() => false),
    push: mockPush,
    replace: jest.fn(),
  },
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = require('react');
    React.useEffect(callback, [callback]);
  },
  useLocalSearchParams: () => ({ id: mockProgramId }),
}));

jest.mock('expo-image', () => ({
  Image: ({ testID }: { testID?: string }) => <img alt="" data-testid={testID} />,
}));

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');

  return {
    ...native,
    Pressable: ({
      accessibilityHint,
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
      testID,
    }: {
      accessibilityHint?: string;
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { busy?: boolean; disabled?: boolean; expanded?: boolean; selected?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button
        aria-busy={accessibilityState?.busy}
        aria-disabled={accessibilityState?.disabled}
        aria-expanded={accessibilityState?.expanded}
        aria-label={accessibilityLabel}
        aria-selected={accessibilityState?.selected}
        data-accessibility-hint={accessibilityHint}
        data-testid={testID}
        disabled={disabled}
        onClick={onPress}
        role={accessibilityRole}
      >
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
    Text: ({
      accessibilityRole,
      children,
      numberOfLines,
      testID,
    }: {
      accessibilityRole?: string;
      children?: React.ReactNode;
      numberOfLines?: number;
      testID?: string;
    }) =>
      React.createElement(
        accessibilityRole === 'header' ? 'h2' : 'span',
        {
          'data-number-of-lines': numberOfLines,
          'data-testid': testID,
        },
        children
      ),
    useWindowDimensions: () => mockWindowDimensions,
    View: ({
      accessibilityHint,
      accessibilityLabel,
      accessibilityRole,
      accessibilityValue,
      children,
      style,
      testID,
    }: {
      accessibilityHint?: string;
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityValue?: { max?: number; min?: number; now?: number };
      children?: React.ReactNode;
      style?: unknown;
      testID?: string;
    }) => {
      const flattenStyle = (value: unknown): Record<string, unknown> =>
        Array.isArray(value)
          ? Object.assign({}, ...value.filter(Boolean).map(flattenStyle))
          : (value as Record<string, unknown> | undefined) ?? {};
      const flattenedStyle = flattenStyle(style);
      return (
        <div
          aria-label={accessibilityLabel}
          aria-valuemax={accessibilityValue?.max}
          aria-valuemin={accessibilityValue?.min}
          aria-valuenow={accessibilityValue?.now}
          data-accessibility-hint={accessibilityHint}
          data-opacity={flattenedStyle.opacity}
          data-testid={testID}
          role={accessibilityRole}
        >
          {children}
        </div>
      );
    },
  };
});

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7ef7d4',
    accentSoft: '#173f39',
    accentStrong: '#7ef7d4',
    amber: '#ffd37e',
    backgroundDeep: '#031015',
    border: '#34505a',
    borderInteractive: '#7ef7d4',
    overlay: '#071820',
    success: '#7ef7d4',
    successSoft: '#173f39',
    surfaceMuted: '#14252d',
    text: '#f7f4e9',
    textMuted: '#7f9298',
    textSecondary: '#afbec2',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'dark' }),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      state: {
        onboarding: {
          weeklyTarget: 3,
          accessibility: { reduceMotion: true },
        },
        progress: mockProgress ? [mockProgress] : [],
      },
      content: getLucidContent('en'),
      pauseProgram: mockPauseProgram,
      startProgram: mockStartProgram,
    }),
  };
});

jest.mock('@/hooks/useLucidNow', () => ({
  useLucidNow: () => Date.UTC(2026, 7, 20, 8),
}));

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button onClick={onPress}>{label}</button>
  ),
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidOverline: ({ text }: { text: string }) => <span>{text}</span>,
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
  LucidScreen: ({
    children,
    subtitle,
    testID,
    title,
    trailing,
  }: {
    children: React.ReactNode;
    subtitle?: string;
    testID?: string;
    title?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      {title ? <h1>{title}</h1> : null}
      {subtitle ? <p>{subtitle}</p> : null}
      {trailing}
      {children}
    </main>
  ),
  LucidSectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
}));

const { default: LucidProgramDetailScreen } = require('@/app/lucid/program/[id]');
const mildSessions = require('@/lib/lucid/content').getLucidContent('en').programs.mild.sessions;

function expectBefore(left: HTMLElement, right: HTMLElement) {
  expect(left.compareDocumentPosition(right) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
}

function expectCurrentDockImmediatelyAfter(currentSession: number) {
  const path = screen.getByTestId('lucid-journey-path');
  const orderedJourneyItems = within(path).getAllByTestId(
    /^lucid-journey-(?:session-\d+|current-dock)$/
  );
  const expectedOrder = [7, 6, 5, 4, 3, 2, 1].map(
    (session) => `lucid-journey-session-${session}`
  );
  expectedOrder.splice(
    expectedOrder.indexOf(`lucid-journey-session-${currentSession}`) + 1,
    0,
    'lucid-journey-current-dock'
  );

  expect(orderedJourneyItems.map((node) => node.getAttribute('data-testid'))).toEqual(
    expectedOrder
  );
  expect(
    screen
      .getByTestId('lucid-journey-current-dock')
      .contains(screen.getByTestId('lucid-journey-continue'))
  ).toBe(true);
}

describe('Lucid MILD journey behavior', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockProgress = undefined;
    mockProgramId = 'mild';
    mockWindowDimensions = DEFAULT_WINDOW_DIMENSIONS;
  });

  it('keeps 0/7 honest and distinguishes discovery from a started first session', async () => {
    render(<LucidProgramDetailScreen />);

    expect(screen.getByTestId('lucid-journey-map').getAttribute('aria-label')).toContain(
      'Progress 0 / 7'
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemin')).toBe('0');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('7');
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    expect(screen.getAllByTestId('lucid-journey-background')).toHaveLength(1);
    expect(screen.getByTestId('lucid-journey-current-card')).not.toBeNull();
    expect(screen.getByTestId('lucid-journey-current-art')).not.toBeNull();
    expect(screen.getByTestId('lucid-journey-safety')).not.toBeNull();

    const map = screen.getByTestId('lucid-journey-map');
    const progressHeader = screen.getByTestId('lucid-journey-progress-header');
    const scene = screen.getByTestId('lucid-journey-scene');
    const path = screen.getByTestId('lucid-journey-path');
    const currentCard = screen.getByTestId('lucid-journey-current-card');
    const safety = screen.getByTestId('lucid-journey-safety');
    const details = screen.getByTestId('lucid-program-details');

    expect(map.contains(progressHeader)).toBe(true);
    expect(within(progressHeader).getByText('Journey MILD')).not.toBeNull();
    expect(within(progressHeader).queryByText('Progress')).toBeNull();
    const accessibleProgress = within(progressHeader).getByRole('progressbar');
    expect(accessibleProgress.getAttribute('aria-label')).toBe('Progress 0 / 7');
    expect(accessibleProgress.getAttribute('aria-valuenow')).toBe('0');
    expect(scene.contains(progressHeader)).toBe(true);
    expect(scene.contains(path)).toBe(true);
    expect(scene.contains(currentCard)).toBe(true);
    expect(path.getAttribute('role')).toBe('list');
    expect(screen.getAllByTestId('lucid-journey-continue')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Start program' })).toBe(
      screen.getByTestId('lucid-journey-continue')
    );
    expectBefore(progressHeader, path);
    expectBefore(currentCard, safety);
    expectBefore(map, details);

    const journeySessionNodes = within(path).getAllByTestId(/^lucid-journey-session-/);
    const journeySessionIds = journeySessionNodes.map((node) =>
      node.getAttribute('data-testid')
    );
    expect(journeySessionIds).toEqual(
      [7, 6, 5, 4, 3, 2, 1].map((session) => `lucid-journey-session-${session}`)
    );
    for (const sessionNode of journeySessionNodes) {
      expect(sessionNode.getAttribute('role')).toBe('button');
    }
    expectCurrentDockImmediatelyAfter(1);

    for (let session = 1; session <= 7; session += 1) {
      expect(
        screen.getByTestId(`lucid-journey-session-${session}`).hasAttribute('disabled')
      ).toBe(true);
    }

    const current = screen.getByTestId('lucid-journey-session-1');
    expect(current.getAttribute('aria-selected')).toBe('true');
    expect(current.getAttribute('aria-label')).toContain('Session 1');
    expect(current.getAttribute('aria-label')).toContain('Current session');
    expect(current.getAttribute('data-accessibility-hint')).toBe('Start program');
    expect(
      screen
        .getByTestId('lucid-journey-session-2')
        .getAttribute('data-accessibility-hint')
    ).toBe('Complete the previous session to unlock this one.');

    fireEvent.click(current);
    fireEvent.click(screen.getByTestId('lucid-journey-session-2'));
    expect(mockStartProgram).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('lucid-journey-continue'));

    await waitFor(() => {
      expect(mockStartProgram).toHaveBeenCalledTimes(1);
      expect(mockStartProgram).toHaveBeenCalledWith('mild');
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/lucid/session/mild/1');
    });

    cleanup();
    jest.clearAllMocks();
    mockProgress = {
      technique: 'mild',
      status: 'active',
      currentDay: 1,
      completedExerciseIds: [],
      startedAt: Date.UTC(2026, 7, 20, 8),
    };

    render(<LucidProgramDetailScreen />);

    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('0');
    const startedCurrent = screen.getByTestId('lucid-journey-session-1');
    expect(startedCurrent.hasAttribute('disabled')).toBe(false);
    fireEvent.click(startedCurrent);
    expect(mockPush).toHaveBeenCalledWith('/lucid/session/mild/1');
    expect(mockStartProgram).not.toHaveBeenCalled();
  });

  it.each([1, 3, 6])(
    'places one complete CTA directly after current session %i in the immersive DOM order',
    (currentDay) => {
      mockProgress = {
        technique: 'mild',
        status: 'active',
        currentDay,
        completedExerciseIds: mildSessions
          .slice(0, currentDay - 1)
          .map((session: { id: string }) => session.id),
        startedAt: Date.UTC(2026, 7, 18, 8),
      };

      render(<LucidProgramDetailScreen />);

      expectCurrentDockImmediatelyAfter(currentDay);
      expect(screen.getAllByTestId('lucid-journey-continue')).toHaveLength(1);
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
        String(currentDay - 1)
      );

      const currentSession = mildSessions[currentDay - 1];
      const currentCard = screen.getByTestId('lucid-journey-current-card');
      const currentTitle = within(currentCard).getByRole('heading', {
        name: currentSession.title,
      });
      expect(currentTitle.getAttribute('data-number-of-lines')).toBeNull();
      expect(within(currentCard).queryByText(currentSession.objective)).toBeNull();
    }
  );

  it('keeps the full current title and objective in the large-text reflow', () => {
    mockWindowDimensions = { width: 390, height: 844, scale: 3, fontScale: 1.3 };
    mockProgress = {
      technique: 'mild',
      status: 'active',
      currentDay: 3,
      completedExerciseIds: ['mild-01', 'mild-02'],
      startedAt: Date.UTC(2026, 7, 18, 8),
    };

    render(<LucidProgramDetailScreen />);

    expectCurrentDockImmediatelyAfter(3);
    const currentSession = mildSessions[2];
    const currentCard = screen.getByTestId('lucid-journey-current-card');
    expect(
      within(currentCard)
        .getByRole('heading', { name: currentSession.title })
        .getAttribute('data-number-of-lines')
    ).toBeNull();
    expect(
      within(currentCard).getByText(currentSession.objective).getAttribute('data-number-of-lines')
    ).toBeNull();
  });

  it('counts non-contiguous completions without lighting intermediate segments', () => {
    mockProgress = {
      technique: 'mild',
      status: 'active',
      currentDay: 4,
      completedExerciseIds: ['mild-01', 'mild-03'],
      startedAt: Date.UTC(2026, 7, 18, 8),
    };

    render(<LucidProgramDetailScreen />);

    expect(screen.getByTestId('lucid-journey-map').getAttribute('aria-label')).toContain(
      'Progress 2 / 7'
    );
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('2');

    for (let session = 1; session <= 7; session += 1) {
      expect(
        screen.getByTestId(`lucid-journey-progress-${session}`).getAttribute('data-opacity')
      ).toBe(session === 1 || session === 3 ? '1' : '0.48');
    }

    const completed = screen.getByTestId('lucid-journey-session-1');
    const available = screen.getByTestId('lucid-journey-session-2');
    const secondCompleted = screen.getByTestId('lucid-journey-session-3');
    const current = screen.getByTestId('lucid-journey-session-4');
    const future = screen.getByTestId('lucid-journey-session-5');

    expect(completed.hasAttribute('disabled')).toBe(false);
    expect(completed.getAttribute('aria-label')).toContain('Completed');
    expect(available.hasAttribute('disabled')).toBe(false);
    expect(available.getAttribute('aria-label')).toContain('Available');
    expect(secondCompleted.hasAttribute('disabled')).toBe(false);
    expect(secondCompleted.getAttribute('aria-label')).toContain('Completed');
    expect(current.hasAttribute('disabled')).toBe(false);
    expect(current.getAttribute('aria-label')).toContain('Current session');
    expect(current.getAttribute('aria-selected')).toBe('true');
    expect(future.hasAttribute('disabled')).toBe(true);
    expect(future.getAttribute('aria-label')).toContain('Planned');

    fireEvent.click(completed);
    fireEvent.click(available);
    fireEvent.click(current);
    fireEvent.click(future);

    expect(mockPush).toHaveBeenNthCalledWith(1, '/lucid/session/mild/1');
    expect(mockPush).toHaveBeenNthCalledWith(2, '/lucid/session/mild/2');
    expect(mockPush).toHaveBeenNthCalledWith(3, '/lucid/session/mild/4');
    expect(mockPush).toHaveBeenCalledTimes(3);
    expect(mockStartProgram).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Pause program' }));
    expect(mockPauseProgram).toHaveBeenCalledTimes(1);
    expect(mockPauseProgram).toHaveBeenCalledWith('mild');
  });

  it('keeps completed history readable while paused and resumes only through the CTA', async () => {
    mockProgress = {
      technique: 'mild',
      status: 'paused',
      currentDay: 3,
      completedExerciseIds: ['mild-01'],
      startedAt: Date.UTC(2026, 7, 18, 8),
    };

    render(<LucidProgramDetailScreen />);

    const completed = screen.getByTestId('lucid-journey-session-1');
    const available = screen.getByTestId('lucid-journey-session-2');
    const current = screen.getByTestId('lucid-journey-session-3');

    expect(completed.hasAttribute('disabled')).toBe(false);
    expect(available.hasAttribute('disabled')).toBe(true);
    expect(available.getAttribute('data-accessibility-hint')).toBe('Resume training');
    expect(current.hasAttribute('disabled')).toBe(true);
    expect(current.getAttribute('data-accessibility-hint')).toBe('Resume training');
    expect(screen.getAllByTestId('lucid-journey-continue')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Resume training' })).toBe(
      screen.getByTestId('lucid-journey-continue')
    );

    fireEvent.click(completed);
    fireEvent.click(available);
    fireEvent.click(current);

    expect(mockPush).toHaveBeenCalledTimes(1);
    expect(mockPush).toHaveBeenCalledWith('/lucid/session/mild/1');
    expect(mockStartProgram).not.toHaveBeenCalled();

    mockPush.mockClear();
    fireEvent.click(screen.getByTestId('lucid-journey-continue'));

    await waitFor(() => {
      expect(mockStartProgram).toHaveBeenCalledTimes(1);
      expect(mockStartProgram).toHaveBeenCalledWith('mild');
      expect(mockPush).toHaveBeenCalledTimes(1);
      expect(mockPush).toHaveBeenCalledWith('/lucid/session/mild/3');
    });
  });

  it('keeps the established contained layout for programs without an immersive map', () => {
    mockProgramId = 'ssild';

    render(<LucidProgramDetailScreen />);

    expect(screen.getByRole('heading', { name: 'SSILD' })).not.toBeNull();
    expect(screen.queryByTestId('lucid-program-details')).toBeNull();

    const map = screen.getByTestId('lucid-journey-map');
    const currentCard = screen.getByTestId('lucid-journey-current-card');
    const safety = screen.getByTestId('lucid-journey-safety');
    const scene = screen.getByTestId('lucid-journey-scene');

    expect(map.contains(currentCard)).toBe(true);
    expect(map.contains(safety)).toBe(true);
    expect(map.contains(scene)).toBe(true);
    expectBefore(currentCard, safety);
    expectBefore(safety, scene);
    expect(screen.getAllByTestId('lucid-journey-continue')).toHaveLength(1);
  });

  it('keeps method evidence and guardrails behind one accessible disclosure', () => {
    render(<LucidProgramDetailScreen />);

    const toggle = screen.getByTestId('lucid-program-about-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('lucid-program-about-content')).toBeNull();
    expect(screen.queryByText(mildSessions[0].caution)).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('lucid-program-about-content')).not.toBeNull();
    expect(screen.getByText('Evidence and limits')).not.toBeNull();
    expect(screen.getByText('Before you begin')).not.toBeNull();
    expect(screen.getByText('When to stop')).not.toBeNull();
  });
});
