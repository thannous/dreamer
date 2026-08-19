/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { TID } from '@/lib/testIDs';

const mockPush = jest.fn();

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.default ?? options.web },
    StyleSheet: { create: (d: Record<string, unknown>) => d, flatten: (s: unknown) => s, hairlineWidth: 1 },
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => <div data-testid={testID}>{children}</div>,
    Text: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => <span data-testid={testID}>{children}</span>,
    Pressable: ({ children, onPress, testID }: any) => (
      <button data-testid={testID} onClick={onPress}>{typeof children === 'function' ? children({ pressed: false }) : children}</button>
    ),
  };
});
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => <div data-testid={testID}>{children}</div>,
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: ({ name }: { name: string }) => <span data-icon={name} /> }));
jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return { useTheme: () => ({ colors: LightTheme, mode: 'light' }) };
});
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, replacements?: Record<string, string | number>) =>
      replacements ? `${key}|${Object.values(replacements).join(',')}` : key,
  }),
}));

const { PersonalReadingCard } = require('@/components/inspiration/PersonalReadingCard');

const baseReading = {
  windowDreamCount: 3,
  analyzedInWindow: 2,
  recurringSymbol: { name: 'Water', count: 2 },
  recurringTheme: null,
  dreamToExplore: { id: 42, title: 'Quiet shore' },
  dreamToAnalyze: null,
};

describe('PersonalReadingCard', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('shows the recurring symbol, the next dream to explore and the next reminder', () => {
    render(<PersonalReadingCard reading={baseReading} nextReminderText="Tomorrow at 07:00" />);

    expect(screen.getByTestId(TID.Text.PersonalReadingRecurring).textContent).toBe('inspiration.reading.recurring_symbol|Water,2');
    expect(screen.getByTestId(TID.Text.PersonalReadingNext).textContent).toBe('inspiration.reading.next_explore|Quiet shore');
    expect(screen.getByTestId(TID.Text.PersonalReadingReminder).textContent).toBe('Tomorrow at 07:00');

    fireEvent.click(screen.getByTestId(TID.Button.PersonalReadingNext));
    expect(mockPush).toHaveBeenCalledWith('/journal/42');
    fireEvent.click(screen.getByTestId(TID.Button.PersonalReadingRecap));
    expect(mockPush).toHaveBeenCalledWith('/weekly-recap');
  });

  it('falls back to capture and the reminders-off hint', () => {
    render(
      <PersonalReadingCard
        reading={{ ...baseReading, recurringSymbol: null, analyzedInWindow: 0, dreamToExplore: null }}
        nextReminderText={null}
      />
    );

    expect(screen.getByTestId(TID.Text.PersonalReadingRecurring).textContent).toBe('inspiration.reading.recurring_needs_analysis');
    expect(screen.getByTestId(TID.Text.PersonalReadingNext).textContent).toBe('inspiration.reading.next_capture');
    expect(screen.getByTestId(TID.Text.PersonalReadingReminder).textContent).toBe('inspiration.reading.reminder_off');
    fireEvent.click(screen.getByTestId(TID.Button.PersonalReadingNext));
    expect(mockPush).toHaveBeenCalledWith('/recording');
  });
});
