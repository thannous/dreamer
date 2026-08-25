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
  LucidPill: ({ label }: { label: string }) => <span>{label}</span>,
}));

const { default: LucidMorningScreen } = require('@/app/lucid/morning');

function clickScore(title: string, value: string) {
  const heading = screen.getByText(title);
  const block = heading.closest('div')?.parentElement;
  const button = Array.from(block?.querySelectorAll('button') ?? []).find((item) => item.textContent === value);
  if (!button) throw new Error(`Missing score ${value} for ${title}`);
  fireEvent.click(button);
}

describe('Lucid morning review form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  it('starts without selected coaching values and keeps save disabled until required fields are chosen', async () => {
    render(<LucidMorningScreen />);

    expect(screen.getByTestId('lucid-morning')).toBeTruthy();
    expect(screen.getAllByText('- / 5')).toHaveLength(2);
    expect(screen.queryByText('0 / 5')).toBeNull();
    expect(screen.queryByText('3 / 5')).toBeNull();

    const save = screen.getByTestId('lucid-morning-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.title).toBe('Choose last night’s technique first');
    fireEvent.click(save);
    expect(mockAddExperiment).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('MILD'));
    expect(save.title).toBe('Choose how long you prepared');
    fireEvent.click(screen.getByText('10 minutes'));
    expect(save.title).toBe('Choose the result first');
    fireEvent.click(screen.getByText('No lucidity'));
    expect(save.title).toBe('Choose dream recall first');
    clickScore('Dream recall', '2');
    expect(save.title).toBe('Choose sleep quality first');
    clickScore('Sleep quality', '4');

    expect(save.disabled).toBe(false);
    expect(save.title).toBe('');
    fireEvent.change(screen.getByRole('textbox', { name: 'Optional notes' }), {
      target: { value: '  fragments only  ' },
    });
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

    fireEvent.click(screen.getByText('SSILD'));
    fireEvent.click(screen.getByText('5 minutes'));
    fireEvent.click(screen.getByText('Lucid'));
    clickScore('Dream recall', '1');
    clickScore('Sleep quality', '0');

    const save = screen.getByTestId('lucid-morning-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.title).toBe('Choose lucidity first');
    expect(screen.getAllByText('- / 5')).toHaveLength(1);

    clickScore('Lucidity', '4');
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
