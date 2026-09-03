/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { TID } from '@/lib/testIDs';

const mockEnable = jest.fn();
const mockDismiss = jest.fn();
const mockSelectTime = jest.fn();
let mockController = {
  visible: true,
  presets: ['06:30', '07:00', '07:30', '08:00'],
  selectedTime: '07:00',
  selectTime: mockSelectTime,
  busy: false,
  enabled: false,
  enable: mockEnable,
  dismiss: mockDismiss,
};

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.default ?? options.web },
    StyleSheet: { create: (definitions: Record<string, unknown>) => definitions, flatten: (style: unknown) => style },
    ActivityIndicator: () => <span data-testid="spinner" />,
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
    Text: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
      style,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      style?: unknown;
      testID?: string;
    }) => {
      const resolvedChildren = typeof children === 'function' ? children({ pressed: false }) : children;
      const resolvedStyle = typeof style === 'function' ? style({ pressed: false }) : style;
      const flattenedStyle = Array.isArray(resolvedStyle)
        ? resolvedStyle.reduce((merged: Record<string, unknown>, part) => {
            if (!part || typeof part !== 'object') return merged;
            return { ...merged, ...(part as Record<string, unknown>) };
          }, {})
        : resolvedStyle;
      return (
        <button
          aria-label={accessibilityLabel}
          data-style={JSON.stringify(flattenedStyle)}
          data-testid={testID}
          disabled={disabled}
          onClick={onPress}
        >
          {resolvedChildren}
        </button>
      );
    },
  };
});
jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-icon={name} />,
}));
let mockThemeMode: 'light' | 'dark' = 'light';
jest.mock('@/context/ThemeContext', () => {
  const { LightTheme, DarkTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({
      colors: mockThemeMode === 'dark' ? DarkTheme : LightTheme,
      mode: mockThemeMode,
    }),
  };
});
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, replacements?: Record<string, string | number>) =>
      replacements ? `${key}|${Object.values(replacements).join(',')}` : key,
  }),
}));
jest.mock('@/hooks/useReminderOptIn', () => ({
  useReminderOptIn: () => mockController,
}));

const { ReminderOptInCard } = require('@/components/reminders/ReminderOptInCard');

describe('ReminderOptInCard', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
    mockThemeMode = 'light';
    mockController = { ...mockController, visible: true, enabled: false, busy: false, selectedTime: '07:00' };
  });

  it('renders nothing when the user is not eligible', () => {
    mockController = { ...mockController, visible: false };
    render(<ReminderOptInCard surface="home" />);
    expect(screen.queryByTestId(TID.Component.ReminderOptInCard)).toBeNull();
  });

  it('lets the user pick a wake-up time, enable or dismiss', () => {
    render(<ReminderOptInCard surface="home" />);

    expect(screen.getByText('reminders.opt_in.title')).toBeTruthy();
    // The card enables four families at once, so the list is on screen before
    // the user can tap the CTA.
    expect(screen.getByText('reminders.opt_in.includes')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn.reminderOptIn.time.0730'));
    expect(mockSelectTime).toHaveBeenCalledWith('07:30');

    expect(screen.getByText('reminders.opt_in.cta|07:00')).toBeTruthy();
    fireEvent.click(screen.getByTestId('btn.reminderOptIn.enable'));
    expect(mockEnable).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('btn.reminderOptIn.dismiss'));
    expect(mockDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps the home enable action secondary to Today without shrinking the tap target', () => {
    const { LightTheme } = require('@/constants/journalTheme');
    const { getNoctaliaDesignTokens } = require('@/constants/noctaliaDesign');
    const tokens = getNoctaliaDesignTokens(LightTheme, 'light');

    const { rerender } = render(<ReminderOptInCard surface="home" />);
    const homeEnable = screen.getByTestId('btn.reminderOptIn.enable');
    const homeStyle = JSON.parse(homeEnable.getAttribute('data-style') ?? 'null');

    expect(homeEnable).toBeTruthy();
    expect(homeEnable.getAttribute('disabled')).toBeNull();
    expect(homeStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(homeStyle.backgroundColor).toBe(tokens.surface.raised);
    expect(homeStyle.backgroundColor).not.toBe(tokens.action.primary);
    expect(homeStyle.borderColor).toBe(tokens.surface.borderStrong);
    expect(homeStyle.borderColor).not.toBe(tokens.action.primaryBorder);

    rerender(<ReminderOptInCard surface="journal_detail" />);
    const journalEnable = screen.getByTestId('btn.reminderOptIn.enable');
    const journalStyle = JSON.parse(journalEnable.getAttribute('data-style') ?? 'null');

    expect(journalStyle.minHeight).toBeGreaterThanOrEqual(homeStyle.minHeight);
    expect(journalStyle.backgroundColor).toBe(tokens.action.primary);
    expect(journalStyle.borderColor).toBe(tokens.action.primaryBorder);
    expect(journalStyle.backgroundColor).not.toBe(homeStyle.backgroundColor);
  });

  it('keeps the home enable action off the filled champagne surface in dark mode', () => {
    mockThemeMode = 'dark';
    const { DarkTheme } = require('@/constants/journalTheme');
    const { getNoctaliaDesignTokens } = require('@/constants/noctaliaDesign');
    const tokens = getNoctaliaDesignTokens(DarkTheme, 'dark');

    const { rerender } = render(<ReminderOptInCard surface="home" />);
    const homeStyle = JSON.parse(screen.getByTestId('btn.reminderOptIn.enable').getAttribute('data-style') ?? 'null');
    expect(homeStyle.backgroundColor).toBe(tokens.surface.raised);
    expect(homeStyle.backgroundColor).not.toBe(tokens.surface.active);
    expect(homeStyle.backgroundColor).not.toBe(tokens.action.primary);

    rerender(<ReminderOptInCard surface="journal_detail" />);
    const journalStyle = JSON.parse(screen.getByTestId('btn.reminderOptIn.enable').getAttribute('data-style') ?? 'null');
    expect(journalStyle.backgroundColor).toBe(tokens.surface.active);
  });

  it('shows the confirmation state after the reminder is scheduled', () => {
    mockController = { ...mockController, enabled: true, selectedTime: '06:30' };
    render(<ReminderOptInCard surface="journal_detail" />);

    expect(screen.getByText('reminders.opt_in.enabled_title')).toBeTruthy();
    expect(screen.getByText('reminders.opt_in.enabled_body|06:30')).toBeTruthy();
    // Still listed after opting in, so the evening reminders are never a surprise.
    expect(screen.getByText('reminders.opt_in.includes')).toBeTruthy();
    expect(screen.queryByTestId('btn.reminderOptIn.enable')).toBeNull();
  });
});
