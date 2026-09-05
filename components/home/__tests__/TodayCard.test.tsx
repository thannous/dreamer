/* @jest-environment jsdom */

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';

import { TodayCard } from '@/components/home/TodayCard';
import { TID } from '@/lib/testIDs';
import type { TodayState } from '@/lib/todayState';

jest.mock('react-native', () => {
  const React = require('react');

  return {
    Platform: {
      OS: 'web',
      select: (options: Record<string, unknown>) => options.default ?? options.web,
    },
    StyleSheet: {
      create: (definitions: Record<string, unknown>) => definitions,
      flatten: (style: unknown) => style,
      hairlineWidth: 1,
    },
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) => (
      <div data-testid={testID}>{children}</div>
    ),
    Text: ({ children, testID, className, numberOfLines }: {
      children?: React.ReactNode;
      testID?: string;
      className?: string;
      numberOfLines?: number;
    }) => (
      <span data-testid={testID} data-native-class={className} data-number-of-lines={numberOfLines}>{children}</span>
    ),
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
      testID,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode | ((state: { pressed: boolean }) => React.ReactNode);
      onPress?: () => void;
      testID?: string;
    }) => (
      <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress}>
        {typeof children === 'function' ? children({ pressed: false }) : children}
      </button>
    ),
  };
});

jest.mock('@/components/inspiration/GlassCard', () => ({
  FlatGlassCard: ({
    accessibilityLabel,
    children,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    testID?: string;
  }) => (
    <div aria-label={accessibilityLabel} data-testid={testID}>
      {children}
    </div>
  ),
}));

jest.mock('@/components/motion', () => ({
  PressableScale: ({
    accessibilityLabel,
    children,
    onPress,
    testID,
  }: {
    accessibilityLabel?: string;
    children?: React.ReactNode;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button aria-label={accessibilityLabel} data-testid={testID} onClick={onPress} type="button">
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/icon-symbol', () => ({
  IconSymbol: ({ name }: { name: string }) => <span data-icon={name} />,
}));

jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return {
    useTheme: () => ({ colors: LightTheme, mode: 'light' }),
  };
});

jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const STATES: TodayState[] = [
  { id: 'draft_resume', action: { kind: 'resume_recording' }, reason: 'saved_draft' },
  { id: 'empty', action: { kind: 'start_capture' }, reason: 'first_use' },
  { id: 'capture_due', action: { kind: 'start_capture' }, reason: 'no_dream_today' },
  { id: 'continue_today', action: { kind: 'open_dream', dreamId: 28 }, reason: 'today_dream_unanalyzed' },
  { id: 'optional_deepen', action: { kind: 'open_dream', dreamId: 29 }, reason: 'today_dream_unexplored' },
  { id: 'rest', action: { kind: 'open_journal' }, reason: 'today_complete' },
];

describe('TodayCard', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it.each(STATES)('renders a single primary CTA for $id', (state) => {
    const onPressCta = jest.fn();
    render(<TodayCard state={state} onPressCta={onPressCta} />);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe(state.id);
    expect(screen.getByText(`home.today.${state.id}.title`)).toBeTruthy();
    expect(screen.getByText(`home.today.${state.id}.body`)).toBeTruthy();
    expect(screen.getAllByTestId(TID.Button.HomeTodayCta)).toHaveLength(1);
    expect(screen.getByLabelText(`home.today.${state.id}.cta`)).toBeTruthy();
    const ctaLabel = screen.getByText(`home.today.${state.id}.cta`);
    expect(ctaLabel.getAttribute('data-number-of-lines')).toBeNull();
    expect(ctaLabel.getAttribute('data-native-class')?.split(' ')).toEqual(
      expect.arrayContaining(['flex-1', 'min-w-0', 'text-center'])
    );
    expect(screen.getByText('→').getAttribute('data-native-class')?.split(' ')).toContain('shrink-0');
    expect(screen.queryByTestId(TID.Button.InspirationLastDreamChat)).toBeNull();
    expect(screen.queryByTestId(TID.Button.InspirationPulseCta)).toBeNull();

    fireEvent.click(screen.getByTestId(TID.Button.HomeTodayCta));
    expect(onPressCta).toHaveBeenCalledTimes(1);
  });

  it('hides the CTA while today is still loading', () => {
    render(<TodayCard state={null} onPressCta={jest.fn()} />);

    expect(screen.getByTestId(TID.Text.HomeTodayState).textContent).toBe('loading');
    expect(screen.getByText('home.today.loading.title')).toBeTruthy();
    expect(screen.queryByTestId(TID.Button.HomeTodayCta)).toBeNull();
  });
});
