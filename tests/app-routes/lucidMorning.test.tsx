/* @jest-environment jsdom */

import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockAddExperiment = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(false);
const mockRequestRecordingPermissionsAsync = jest.fn();

const mockState = {
  progress: [] as {
    technique: 'mild' | 'ssild' | 'wbtb';
    practiceDates: string[];
    updatedAt: number;
  }[],
  preferences: { timeZone: 'UTC' },
};

jest.mock('react-native', () => {
  const React = require('react');
  const native = jest.requireActual('../react-native-stub');
  return {
    ...native,
    Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
    Pressable: ({
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
      accessibilityState?: { checked?: boolean; selected?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => React.createElement(
      'button',
      {
        'aria-checked': accessibilityState?.checked,
        'aria-label': accessibilityLabel,
        'aria-pressed': accessibilityState?.selected,
        'data-testid': testID,
        disabled,
        onClick: onPress,
        role: accessibilityRole,
      },
      typeof children === 'function' ? children({ pressed: false }) : children
    ),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      testID,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      testID?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        'data-testid': testID,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText?.(event.target.value),
        value,
      }),
  };
});

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

jest.mock('expo-router', () => ({
  router: {
    back: mockBack,
    canGoBack: mockCanGoBack,
    replace: mockReplace,
  },
}));

jest.mock('expo-audio', () => ({
  requestRecordingPermissionsAsync: (...args: unknown[]) =>
    mockRequestRecordingPermissionsAsync(...args),
}));

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentOn: '#3b2a14',
    accentSoft: '#eee8ff',
    amber: '#9a6200',
    amberSoft: '#fff2ce',
    backgroundDeep: '#fff',
    border: '#ccc',
    borderInteractive: '#999',
    cyan: '#087f8c',
    surface: '#fff',
    surfaceRaised: '#f4f4f4',
    text: '#111',
    textMuted: '#777',
    textSecondary: '#555',
  }),
}));

jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));

jest.mock('@/hooks/useLucidNow', () => ({
  useLucidNow: () => Date.UTC(2026, 7, 27, 8, 0, 0),
}));

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      content: getLucidContent('en'),
      addExperiment: mockAddExperiment,
      state: mockState,
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({
    children,
    testID,
    title,
    trailing,
  }: {
    children: React.ReactNode;
    testID?: string;
    title?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
      {title ? <h1>{title}</h1> : null}
      {trailing}
      {children}
    </main>
  ),
  LucidIconAction: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button aria-label={label} onClick={onPress} />
  ),
  LucidButton: ({
    disabled,
    disabledReason,
    label,
    onPress,
    testID,
  }: {
    disabled?: boolean;
    disabledReason?: string;
    label: string;
    onPress: () => void;
    testID?: string;
  }) => (
    <button
      aria-label={label}
      aria-disabled={disabled}
      data-testid={testID}
      disabled={disabled}
      title={disabledReason}
      onClick={onPress}
    >
      {label}
    </button>
  ),
  LucidCard: ({
    children,
    testID,
  }: {
    children: React.ReactNode;
    testID?: string;
  }) => <section data-testid={testID}>{children}</section>,
  LucidChoiceCard: ({
    onPress,
    selected,
    testID,
    title,
  }: {
    onPress: () => void;
    selected: boolean;
    testID?: string;
    title: string;
  }) => (
    <button aria-pressed={selected} data-testid={testID} onClick={onPress}>
      {title}
    </button>
  ),
  LucidIconTile: () => null,
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
}));

const { default: LucidMorningScreen } = require('@/app/lucid/morning');

async function completeNothingPath(cueLabel = 'Unsure') {
  fireEvent.click(screen.getByTestId('lucid-morning-nothing'));
  fireEvent.click(screen.getByRole('button', { name: cueLabel }));
  fireEvent.click(screen.getByTestId('lucid-morning-next'));
}

describe('Lucid morning review form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockState.progress = [];
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: true });
  });

  afterEach(cleanup);

  it('keeps the capture prompt without repeating it as the screen title', () => {
    render(<LucidMorningScreen />);

    expect(screen.getAllByText('Morning check-in')).toHaveLength(1);
    expect(screen.getAllByText('What remains this morning?')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('lucid-morning-write'));
    expect(screen.getAllByText('Morning check-in')).toHaveLength(1);
    expect(screen.queryByText('What remains this morning?')).toBeNull();
    expect(screen.getAllByText('Write what remains')).toHaveLength(1);
  });

  it('does not request the microphone on mount, write, or nothing for now', async () => {
    render(<LucidMorningScreen />);

    expect(screen.getByTestId('lucid-morning')).toBeTruthy();
    expect(mockRequestRecordingPermissionsAsync).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('lucid-morning-write'));
    expect(mockRequestRecordingPermissionsAsync).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    fireEvent.click(screen.getByTestId('lucid-morning-nothing'));
    expect(mockRequestRecordingPermissionsAsync).not.toHaveBeenCalled();
  });

  it('requires non-empty trimmed write text and a cue before save', async () => {
    render(<LucidMorningScreen />);

    fireEvent.click(screen.getByTestId('lucid-morning-write'));
    const next = screen.getByTestId('lucid-morning-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.change(screen.getByTestId('lucid-morning-recall-text'), {
      target: { value: '   ' },
    });
    expect(next.disabled).toBe(true);
    fireEvent.click(next);
    expect(mockAddExperiment).not.toHaveBeenCalled();

    fireEvent.change(screen.getByTestId('lucid-morning-recall-text'), {
      target: { value: '  the hallway  ' },
    });
    fireEvent.click(next);
    expect(screen.getByTestId('lucid-morning-next')).toHaveProperty('disabled', true);
    fireEvent.click(screen.getByTestId('lucid-morning-cue-indeterminate'));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    expect(screen.getAllByText('Your morning capture')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('lucid-morning-save'));

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: null,
      preparationMinutes: null,
      result: null,
      lucidityLevel: null,
      recallLevel: null,
      sleepQuality: null,
      factors: [],
      notes: undefined,
      captureMode: 'write',
      recallText: 'the hallway',
      cueOutcome: 'indeterminate',
    });
  });

  it('saves the shortest nothing-for-now path without claiming no dream or no recall', async () => {
    render(<LucidMorningScreen />);

    await completeNothingPath();
    const recap = screen.getByTestId('lucid-morning').textContent ?? '';
    expect(recap.toLowerCase()).not.toMatch(/did not dream|no dream|no recall|i did not dream/);
    expect(screen.getAllByText('Nothing captured for now')).toHaveLength(1);
    expect(recap).not.toContain('Not answered');
    expect(screen.queryByTestId('lucid-morning-auto-link')).toBeNull();

    fireEvent.click(screen.getByTestId('lucid-morning-save'));
    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: null,
      preparationMinutes: null,
      result: null,
      lucidityLevel: null,
      recallLevel: null,
      sleepQuality: null,
      factors: [],
      notes: undefined,
      captureMode: 'nothing_for_now',
      cueOutcome: 'indeterminate',
    });
  });

  it('requests the microphone once for Speak, shows an honest stub, and stores the matching voice state', async () => {
    render(<LucidMorningScreen />);

    fireEvent.click(screen.getByTestId('lucid-morning-speak'));
    await waitFor(() => expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('lucid-morning-recall-text')).toBeTruthy());
    expect(screen.getByText(/Voice recording is not active yet/)).toBeTruthy();
    expect(screen.getByText(/Nothing was recorded/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByTestId('lucid-morning-write'));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByTestId('lucid-morning-speak'));
    expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('lucid-morning-recall-text')).toBeTruthy());

    fireEvent.change(screen.getByTestId('lucid-morning-recall-text'), {
      target: { value: 'typed after the stub' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-cue-not_heard'));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-save'));

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: null,
      preparationMinutes: null,
      result: null,
      lucidityLevel: null,
      recallLevel: null,
      sleepQuality: null,
      factors: [],
      notes: undefined,
      captureMode: 'speak',
      recallText: 'typed after the stub',
      cueOutcome: 'not_heard',
      voiceCapture: 'stub',
    });
  });

  it('stores permission_denied when Speak is refused and still requires typed fallback', async () => {
    mockRequestRecordingPermissionsAsync.mockResolvedValue({ granted: false });
    render(<LucidMorningScreen />);

    fireEvent.click(screen.getByTestId('lucid-morning-speak'));
    await waitFor(() =>
      expect(screen.getByText(/Microphone access was not granted/)).toBeTruthy()
    );
    await waitFor(() => expect(screen.getByTestId('lucid-morning-recall-text')).toBeTruthy());
    fireEvent.change(screen.getByTestId('lucid-morning-recall-text'), {
      target: { value: 'typed after denial' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-cue-heard_woke'));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-save'));

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment.mock.calls[0][0]).toMatchObject({
      captureMode: 'speak',
      voiceCapture: 'permission_denied',
      recallText: 'typed after denial',
      cueOutcome: 'heard_woke',
    });
  });

  it('does not enter the text step until a shared pending Speak permission resolves once', async () => {
    let resolvePermission: ((value: { granted: boolean }) => void) | undefined;
    mockRequestRecordingPermissionsAsync.mockImplementation(
      () =>
        new Promise<{ granted: boolean }>((resolve) => {
          resolvePermission = resolve;
        })
    );
    render(<LucidMorningScreen />);

    fireEvent.click(screen.getByTestId('lucid-morning-speak'));
    fireEvent.click(screen.getByTestId('lucid-morning-speak'));
    expect(screen.queryByTestId('lucid-morning-recall-text')).toBeNull();
    expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePermission?.({ granted: true });
    });
    await waitFor(() => expect(screen.getByTestId('lucid-morning-recall-text')).toBeTruthy());
    expect(mockRequestRecordingPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Nothing was recorded/)).toBeTruthy();
  });

  it('clears optional technique, preparation and result through explicit unset controls', async () => {
    render(<LucidMorningScreen />);

    fireEvent.click(screen.getByTestId('lucid-morning-write'));
    fireEvent.change(screen.getByTestId('lucid-morning-recall-text'), {
      target: { value: 'a garden path' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-cue-indeterminate'));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-details'));

    fireEvent.click(screen.getByRole('button', { name: 'MILD' }));
    fireEvent.click(screen.getByRole('button', { name: '10 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lucid' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave unset, Which practice did you try?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave unset, How long did you prepare?' }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave unset, What do you remember about lucidity?' }));
    fireEvent.click(screen.getByTestId('lucid-morning-details-done'));
    fireEvent.click(screen.getByTestId('lucid-morning-save'));

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: null,
      preparationMinutes: null,
      result: null,
      lucidityLevel: null,
      recallLevel: null,
      sleepQuality: null,
      factors: [],
      notes: undefined,
      captureMode: 'write',
      recallText: 'a garden path',
      cueOutcome: 'indeterminate',
    });
  });

  it('persists optional details selected before returning to recap', async () => {
    render(<LucidMorningScreen />);

    fireEvent.click(screen.getByTestId('lucid-morning-write'));
    fireEvent.change(screen.getByTestId('lucid-morning-recall-text'), {
      target: { value: 'the staircase' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-cue-heard_in_dream'));
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    fireEvent.click(screen.getByTestId('lucid-morning-details'));

    fireEvent.click(screen.getByRole('button', { name: 'MILD' }));
    fireEvent.click(screen.getByRole('button', { name: '10 minutes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lucid' }));
    fireEvent.click(screen.getByRole('radio', { name: 'How much of the scene remains?, 3 out of 5' }));
    fireEvent.click(screen.getByRole('radio', { name: 'How aware did you feel?, 4 out of 5' }));
    fireEvent.click(screen.getByRole('radio', { name: 'How did your sleep feel?, 2 out of 5' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Stress' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'A few neutral details' }), {
      target: { value: '  quiet morning  ' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-details-done'));
    expect(screen.getByText('MILD')).toBeTruthy();
    expect(screen.getByText('10 minutes')).toBeTruthy();
    fireEvent.click(screen.getByTestId('lucid-morning-save'));

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: 'mild',
      preparationMinutes: 10,
      result: 'lucid',
      lucidityLevel: 4,
      recallLevel: 3,
      sleepQuality: 2,
      factors: ['stress'],
      notes: 'quiet morning',
      captureMode: 'write',
      recallText: 'the staircase',
      cueOutcome: 'heard_in_dream',
    });
  });

  it('shows the auto-link banner only when real previous-night practice exists', async () => {
    mockState.progress = [
      { technique: 'mild', practiceDates: ['2026-08-27'], updatedAt: 1 },
    ];
    render(<LucidMorningScreen />);

    expect(screen.queryByTestId('lucid-morning-auto-link')).toBeNull();
    await completeNothingPath();
    expect(screen.getByTestId('lucid-morning-auto-link').textContent).toContain('Practice linked: MILD');
    expect(screen.getByTestId('lucid-morning-auto-link').textContent).toContain(
      'From a completed program practice'
    );
  });
});
