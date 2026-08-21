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
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      disabled?: boolean;
      onPress?: () => void;
      testID?: string;
    }) => (
      <button aria-label={accessibilityLabel} data-testid={testID} disabled={disabled} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
  };
});
jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-icon={name} />,
}));
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
jest.mock('@/hooks/useReminderOptIn', () => ({
  useReminderOptIn: () => mockController,
}));

const { ReminderOptInCard } = require('@/components/reminders/ReminderOptInCard');

describe('ReminderOptInCard', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
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
