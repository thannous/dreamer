/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, jest } from '@jest/globals';

import { TID } from '@/lib/testIDs';

jest.mock('react-native', () => {
  const React = require('react');
  return {
    Platform: { OS: 'web', select: (options: Record<string, unknown>) => options.web ?? options.default },
    Pressable: ({ children, onPress, testID }: any) =>
      React.createElement('button', { type: 'button', onClick: onPress, 'data-testid': testID }, children),
    ScrollView: ({ children }: { children?: React.ReactNode }) => React.createElement('div', null, children),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles, flatten: (style: unknown) => style },
    Text: ({ children }: { children?: React.ReactNode }) => React.createElement('span', null, children),
    View: ({ children, testID }: { children?: React.ReactNode; testID?: string }) =>
      React.createElement('div', { 'data-testid': testID }, children),
  };
});
jest.mock('@/components/ui/BottomSheet', () => {
  const React = require('react');
  return {
    BottomSheet: ({ children, visible }: { children?: React.ReactNode; visible: boolean }) =>
      visible ? React.createElement('div', null, children) : null,
  };
});
jest.mock('@/components/journal/DateRangePicker', () => {
  const React = require('react');
  return {
    DateRangePicker: ({ onClose }: { onClose: () => void }) =>
      React.createElement(
        'button',
        { type: 'button', onClick: onClose, 'data-testid': 'date-range-cancel' },
        'common.cancel',
      ),
  };
});
jest.mock('@/components/ui/icon-symbol', () => {
  const React = require('react');
  return { IconSymbol: ({ name }: { name: string }) => React.createElement('span', { 'data-icon': name }) };
});
jest.mock('@/context/ThemeContext', () => {
  const { LightTheme } = require('@/constants/journalTheme');
  return { useTheme: () => ({ colors: LightTheme, mode: 'light' }) };
});
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const { AdvancedFilterSheet } = require('../AdvancedFilterSheet');

const baseProps = {
  visible: true,
  onClose: jest.fn(),
  onClear: jest.fn(),
  maxHeight: 600,
  availableThemes: [],
  availableDreamTypes: [],
  selectedTheme: null,
  selectedDreamType: null,
  dateRange: { start: null, end: null },
  rememberedOnly: false,
  recurringOnly: false,
  analysisStatus: null,
  onThemeSelect: jest.fn(),
  onDreamTypeSelect: jest.fn(),
  onDateRangeChange: jest.fn(),
  onRememberedToggle: jest.fn(),
  onRecurringToggle: jest.fn(),
  onAnalysisStatusChange: jest.fn(),
};

describe('AdvancedFilterSheet sort order', () => {
  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('hides the sort section when no handler is provided', () => {
    render(<AdvancedFilterSheet {...baseProps} />);
    expect(screen.queryByTestId(TID.Component.JournalSortOptions)).toBeNull();
  });

  it('offers newest/oldest and forwards the selection', () => {
    const onSortOrderChange = jest.fn();
    render(<AdvancedFilterSheet {...baseProps} sortOrder="newest" onSortOrderChange={onSortOrderChange} />);

    expect(screen.getByTestId(TID.Component.JournalSortOptions)).toBeTruthy();
    fireEvent.click(screen.getByText('journal.filter_sheet.sort.oldest'));
    expect(onSortOrderChange).toHaveBeenCalledWith('oldest');
  });

  it('keeps Recurring Dream out of the type section and still offers a dedicated recurrence toggle', () => {
    render(
      <AdvancedFilterSheet
        {...baseProps}
        availableDreamTypes={['Symbolic Dream', 'Recurring Dream']}
      />
    );

    expect(screen.getByText('journal.filter.recurring')).toBeTruthy();
    expect(screen.queryByText('Recurring Dream')).toBeNull();
    expect(screen.getByText('dream.type.symbolic')).toBeTruthy();
  });

  it('forwards DateRangePicker cancel to onClose', () => {
    const onClose = jest.fn();
    render(<AdvancedFilterSheet {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('common.cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes memory, recurrence and status filters', () => {
    const onRememberedToggle = jest.fn();
    const onRecurringToggle = jest.fn();
    const onAnalysisStatusChange = jest.fn();
    render(
      <AdvancedFilterSheet
        {...baseProps}
        onRememberedToggle={onRememberedToggle}
        onRecurringToggle={onRecurringToggle}
        onAnalysisStatusChange={onAnalysisStatusChange}
      />
    );

    fireEvent.click(screen.getByText('journal.filter.remembered'));
    fireEvent.click(screen.getByText('journal.filter.recurring'));
    fireEvent.click(screen.getByTestId(TID.Button.FilterStatusUnanalyzed));

    expect(onRememberedToggle).toHaveBeenCalledTimes(1);
    expect(onRecurringToggle).toHaveBeenCalledTimes(1);
    expect(onAnalysisStatusChange).toHaveBeenCalledWith('unanalyzed');
  });
});
