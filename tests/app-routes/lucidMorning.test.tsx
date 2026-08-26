/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockAddExperiment = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(false);

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
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean; selected?: boolean };
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
    }) => React.createElement(
      'button',
      {
        'aria-checked': accessibilityState?.checked,
        'aria-label': accessibilityLabel,
        'aria-pressed': accessibilityState?.selected,
        disabled,
        onClick: onPress,
        role: accessibilityRole,
      },
      typeof children === 'function' ? children({ pressed: false }) : children
    ),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
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

jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    accentSoft: '#eee8ff',
    amber: '#9a6200',
    amberSoft: '#fff2ce',
    backgroundDeep: '#fff',
    border: '#ccc',
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

jest.mock('@/context/LucidTrainerContext', () => {
  const { getLucidContent } = jest.requireActual('@/lib/lucid/content');
  return {
    useLucidTrainer: () => ({
      content: getLucidContent('en'),
      addExperiment: mockAddExperiment,
    }),
  };
});

jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({
    children,
    testID,
    trailing,
  }: {
    children: React.ReactNode;
    testID?: string;
    trailing?: React.ReactNode;
  }) => (
    <main data-testid={testID}>
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
  LucidCard: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  LucidChoiceCard: ({
    onPress,
    selected,
    title,
  }: {
    onPress: () => void;
    selected: boolean;
    title: string;
  }) => (
    <button aria-pressed={selected} onClick={onPress}>
      {title}
    </button>
  ),
  LucidIconTile: () => null,
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
}));

const { default: LucidMorningScreen } = require('@/app/lucid/morning');

function chooseAndContinue(label: string) {
  fireEvent.click(screen.getByRole('button', { name: label }));
  fireEvent.click(screen.getByTestId('lucid-morning-next'));
}

function chooseScore(title: string, value: number) {
  fireEvent.click(screen.getByRole('radio', { name: `${title}, ${value} out of 5` }));
  fireEvent.click(screen.getByTestId('lucid-morning-next'));
}

describe('Lucid morning review form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  it('starts without selected coaching values and keeps save disabled until required fields are chosen', async () => {
    render(<LucidMorningScreen />);

    expect(screen.getByTestId('lucid-morning')).toBeTruthy();
    const next = screen.getByTestId('lucid-morning-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(next.title).toBe('Choose an answer to continue.');
    fireEvent.click(next);
    expect(mockAddExperiment).not.toHaveBeenCalled();

    chooseAndContinue('MILD');
    chooseAndContinue('10 minutes');
    chooseAndContinue('No lucidity');
    chooseScore('How much of the dream remains?', 2);
    chooseScore('How did your sleep feel?', 4);
    fireEvent.change(screen.getByRole('textbox', { name: 'A few neutral details' }), {
      target: { value: '  fragments only  ' },
    });
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    const save = screen.getByTestId('lucid-morning-save') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: 'mild',
      preparationMinutes: 10,
      result: 'none',
      lucidityLevel: 0,
      recallLevel: 2,
      sleepQuality: 4,
      factors: [],
      notes: 'fragments only',
    });
  });

  it('requires an explicit lucidity score after a lucid result and never auto-fills it', async () => {
    render(<LucidMorningScreen />);

    chooseAndContinue('SSILD');
    chooseAndContinue('5 minutes');
    chooseAndContinue('Lucid');
    chooseScore('How much of the dream remains?', 1);

    const next = screen.getByTestId('lucid-morning-next') as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    expect(next.title).toBe('Choose an answer to continue.');
    expect(screen.getByText('—')).toBeTruthy();

    chooseScore('How aware did you feel?', 4);
    chooseScore('How did your sleep feel?', 0);
    fireEvent.click(screen.getByTestId('lucid-morning-next'));
    const save = screen.getByTestId('lucid-morning-save') as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(mockAddExperiment).toHaveBeenCalledTimes(1));
    expect(mockAddExperiment).toHaveBeenCalledWith({
      technique: 'ssild',
      preparationMinutes: 5,
      result: 'lucid',
      lucidityLevel: 4,
      recallLevel: 1,
      sleepQuality: 0,
      factors: [],
      notes: undefined,
    });
  });
});
