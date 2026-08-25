/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockAlert = jest.fn();
const mockAddRealityCheck = jest.fn().mockResolvedValue(undefined);
const mockReplace = jest.fn();
const mockBack = jest.fn();
const mockCanGoBack = jest.fn().mockReturnValue(false);

jest.mock('react-native', () => ({
  ...jest.requireActual('../react-native-stub'),
  Alert: { alert: (...args: unknown[]) => mockAlert(...args) },
}));

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
    border: '#ccc',
    cyan: '#087f8c',
    cyanSoft: '#e4f7f7',
    surfaceRaised: '#f4f4f4',
    text: '#111',
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
      addRealityCheck: mockAddRealityCheck,
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
}));

const { default: LucidRealityCheckScreen } = require('@/app/lucid/reality-check');

describe('Lucid reality check form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  it('starts with no method, context or outcome selected and explains why save is unavailable', () => {
    render(<LucidRealityCheckScreen />);

    expect(screen.getByTestId('lucid-reality-check')).toBeTruthy();
    const save = screen.getByTestId('lucid-reality-save') as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.title).toBe('Choose a reality check first');
    expect(screen.queryByRole('button', { pressed: true })).toBeNull();

    fireEvent.click(save);
    expect(mockAddRealityCheck).not.toHaveBeenCalled();
  });

  it('keeps the mindful confirmation required and only saves explicit choices', async () => {
    render(<LucidRealityCheckScreen />);
    const save = screen.getByTestId('lucid-reality-save') as HTMLButtonElement;

    fireEvent.click(screen.getByText('Count your fingers twice'));
    expect(save.title).toBe('Choose what prompted the check');
    fireEvent.click(screen.getByText('Personal dream sign'));
    expect(save.title).toBe('Choose what you noticed');
    fireEvent.click(screen.getByText('Unsure'));
    expect(save.title).toBe('Confirm you genuinely questioned the moment');
    expect(save.disabled).toBe(true);

    fireEvent.click(screen.getByText('I paused and genuinely questioned the moment'));
    expect(save.disabled).toBe(false);
    expect(save.title).toBe('');
    fireEvent.click(save);

    await waitFor(() => expect(mockAddRealityCheck).toHaveBeenCalledTimes(1));
    expect(mockAddRealityCheck).toHaveBeenCalledWith({
      method: 'finger_count',
      context: 'dream_sign',
      outcome: 'uncertain',
      mindful: true,
    });
  });
});
