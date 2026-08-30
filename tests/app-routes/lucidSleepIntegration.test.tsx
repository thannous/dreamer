/* @jest-environment jsdom */

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockBack = jest.fn();
const mockRequestAuth = jest.fn();
const mockQuery = jest.fn();
const mockLoadSnapshot = jest.fn();
const mockImportSnapshot = jest.fn();
const mockRecordEmpty = jest.fn();
const mockDisable = jest.fn();
const mockDelete = jest.fn();

const start = Date.UTC(2026, 7, 21, 22, 0, 0);
const readySnapshot = {
  version: 1,
  status: 'imported',
  importedAt: start,
  rangeStartMs: start,
  rangeEndMs: start + 7 * 24 * 60 * 60 * 1000,
  emptyReason: null,
  normalization: {
    samples: [
      {
        id: 'watch',
        startMs: start,
        endMs: start + 60 * 60 * 1000,
        categoryValue: 5,
        category: 'asleepREM',
        sourceName: 'Zebra Sleep',
        sourceBundleId: 'com.zebra.sleep',
      },
      {
        id: 'phone',
        startMs: start + 60 * 60 * 1000,
        endMs: start + 2 * 60 * 60 * 1000,
        categoryValue: 0,
        category: 'inBed',
        sourceName: 'Apple Watch',
        sourceBundleId: 'com.apple.NanoSleep',
      },
      {
        id: 'unknown',
        startMs: start + 2 * 60 * 60 * 1000,
        endMs: start + 3 * 60 * 60 * 1000,
        categoryValue: 1,
        category: 'asleepUnspecified',
        sourceName: null,
        sourceBundleId: null,
      },
    ],
    rejected: [{ kind: 'malformed', detail: 'bad' }],
    issues: [
      { kind: 'overlap', detail: 'overlap' },
      { kind: 'coarse', detail: 'coarse' },
    ],
    granularity: 'mixed',
    sourceNames: ['Zebra Sleep', 'Apple Watch'],
    sourceBundleIds: ['com.apple.NanoSleep', 'com.zebra.sleep'],
    hasOverlaps: true,
    hasContradictions: false,
    hasCoarseSamples: true,
    hasAbsentData: false,
  },
};

jest.mock('expo-router', () => ({
  router: { back: mockBack, canGoBack: () => true },
}));
jest.mock('react-native', () => {
  const native = jest.requireActual('../react-native-stub');
  return { ...native, Alert: { alert: jest.fn() } };
});
jest.mock('@/context/ThemeContext', () => ({
  useTheme: () => ({ colors: {}, mode: 'light' }),
}));
jest.mock('@/constants/lucidTheme', () => ({
  ...jest.requireActual('@/constants/lucidTheme'),
  getLucidPalette: () => ({
    accent: '#7654d4',
    background: '#fff',
    border: '#ccc',
    surface: '#fff',
    text: '#111',
    textSecondary: '#555',
  }),
}));
jest.mock('@/context/LucidTrainerContext', () => ({
  useLucidTrainer: () => ({
    userScope: 'guest',
    content: { locale: 'en' },
  }),
}));
jest.mock('@/components/lucid/LucidUI', () => ({
  LucidScreen: ({ children, testID, title, trailing }: any) => (
    <main data-testid={testID}><h1>{title}</h1>{trailing}{children}</main>
  ),
  LucidSectionHeader: ({ title }: { title: string }) => <h2>{title}</h2>,
  LucidButton: ({ label, disabled, disabledReason, onPress, testID }: any) => (
    <button data-testid={testID} disabled={disabled} onClick={onPress}>
      {label}
      {disabled && disabledReason ? <span>{disabledReason}</span> : null}
    </button>
  ),
  LucidIconAction: ({ label, onPress }: any) => (
    <button onClick={onPress}>{label}</button>
  ),
}));
jest.mock('@/services/lucidHealthKit', () => ({
  requestLucidHealthKitSleepReadAuthorization: (...args: unknown[]) => mockRequestAuth(...args),
  queryLucidHealthKitSleepAnalysis: (...args: unknown[]) => mockQuery(...args),
}));
jest.mock('@/services/lucidHealthKitStorage', () => ({
  loadLucidHealthKitSnapshot: (...args: unknown[]) => mockLoadSnapshot(...args),
  importLucidHealthKitSnapshot: (...args: unknown[]) => mockImportSnapshot(...args),
  recordLucidHealthKitEmptySnapshot: (...args: unknown[]) => mockRecordEmpty(...args),
  disableLucidHealthKitSnapshot: (...args: unknown[]) => mockDisable(...args),
  deleteLucidHealthKitSnapshot: (...args: unknown[]) => mockDelete(...args),
}));

const { default: LucidSleepIntegrationScreen } = require('@/app/lucid/sleep-integration');
const { Alert } = require('react-native');

describe('Lucid sleep integration prototype', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequestAuth.mockResolvedValue({ status: 'prompted', authorized: true });
    mockQuery.mockResolvedValue({ status: 'ready', normalization: readySnapshot.normalization });
    mockLoadSnapshot.mockResolvedValue({
      version: 1,
      status: 'empty',
      importedAt: null,
      rangeStartMs: null,
      rangeEndMs: null,
      normalization: null,
      emptyReason: null,
    });
    mockImportSnapshot.mockResolvedValue(readySnapshot);
    mockRecordEmpty.mockResolvedValue({
      ...readySnapshot,
      status: 'empty',
      normalization: null,
      emptyReason: 'ambiguous_empty',
    });
    mockDisable.mockResolvedValue({ ...readySnapshot, status: 'disabled' });
    mockDelete.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('does not prompt or query HealthKit on render', async () => {
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() => expect(mockLoadSnapshot).toHaveBeenCalledWith('guest'));
    expect(mockRequestAuth).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
    expect(screen.getByText(/does not detect REM in real time/)).not.toBeNull();
  });

  it('connects only after the explicit CTA, then saves a local snapshot', async () => {
    render(<LucidSleepIntegrationScreen />);
    fireEvent.click(screen.getByTestId('lucid-sleep-connect'));
    await waitFor(() => expect(mockImportSnapshot).toHaveBeenCalled());
    expect(mockRequestAuth.mock.invocationCallOrder[0]).toBeLessThan(mockQuery.mock.invocationCallOrder[0]);
    expect(mockQuery.mock.invocationCallOrder[0]).toBeLessThan(mockImportSnapshot.mock.invocationCallOrder[0]);
    expect(screen.getByText('Apple Watch · com.apple.NanoSleep')).not.toBeNull();
    expect(screen.getByText(/Granularity: Mixed/)).not.toBeNull();
    expect(screen.getByText(/Asleep, REM label: 1/)).not.toBeNull();
    expect(screen.getByText(/Some intervals overlap/)).not.toBeNull();
  });

  it('describes an empty native query as no data or access not granted, never denied', async () => {
    mockQuery.mockResolvedValue({ status: 'empty', reason: 'ambiguous_empty' });
    render(<LucidSleepIntegrationScreen />);
    fireEvent.click(screen.getByTestId('lucid-sleep-connect'));
    await waitFor(() => expect(mockRecordEmpty).toHaveBeenCalled());
    expect(screen.getByText(/no data or access not granted/i)).not.toBeNull();
    expect(screen.queryByText(/denied/i)).toBeNull();
  });

  it('pairs source names with their own bundles even when sorted arrays disagree', async () => {
    mockLoadSnapshot.mockResolvedValue(readySnapshot);
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() => expect(screen.getByText('Imported')).not.toBeNull());
    expect(screen.getByText('Apple Watch · com.apple.NanoSleep')).not.toBeNull();
    expect(screen.getByText('Zebra Sleep · com.zebra.sleep')).not.toBeNull();
    expect(screen.queryByText('Zebra Sleep · com.apple.NanoSleep')).toBeNull();
    expect(screen.getByText('A local snapshot is available.')).not.toBeNull();
    expect(screen.getByText('No source name recorded')).not.toBeNull();
  });

  it('shows persisted ambiguous empty instead of idle on load', async () => {
    mockLoadSnapshot.mockResolvedValue({
      ...readySnapshot,
      status: 'empty',
      normalization: null,
      emptyReason: 'ambiguous_empty',
    });
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() =>
      expect(screen.getByText(/no data or access not granted/i)).not.toBeNull()
    );
    expect(screen.queryByText(/No Health query has run yet/)).toBeNull();
    expect(screen.queryByText(/denied/i)).toBeNull();
    expect((screen.getByTestId('lucid-sleep-disable') as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByTestId('lucid-sleep-delete') as HTMLButtonElement).disabled).toBe(false);
  });

  it('disables and deletes only the local snapshot and reports those outcomes', async () => {
    mockLoadSnapshot.mockResolvedValue(readySnapshot);
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() => expect(screen.getByText('Imported')).not.toBeNull());
    fireEvent.click(screen.getByTestId('lucid-sleep-disable'));
    await waitFor(() => expect(mockDisable).toHaveBeenCalledWith('guest'));
    expect(screen.getByText(/Import is disabled/)).not.toBeNull();
    fireEvent.click(screen.getByTestId('lucid-sleep-delete'));
    expect(Alert.alert).toHaveBeenCalled();
    const confirm = Alert.alert.mock.calls[0][2].find((action: { style?: string }) => action.style === 'destructive');
    mockLoadSnapshot.mockResolvedValue({
      version: 1,
      status: 'empty',
      importedAt: null,
      rangeStartMs: null,
      rangeEndMs: null,
      normalization: null,
      emptyReason: null,
    });
    const loadCount = mockLoadSnapshot.mock.calls.length;
    confirm.onPress();
    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith('guest'));
    await waitFor(() =>
      expect(screen.getByText(/local imported copy was deleted/i)).not.toBeNull()
    );
    expect(mockLoadSnapshot.mock.calls.length).toBe(loadCount);
    expect((screen.getByTestId('lucid-sleep-delete') as HTMLButtonElement).disabled).toBe(true);
    expect(mockRequestAuth).not.toHaveBeenCalled();
  });

  it('keeps the previous snapshot when disable storage fails', async () => {
    mockLoadSnapshot.mockResolvedValue(readySnapshot);
    mockDisable.mockRejectedValue(new Error('kv down'));
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() => expect(screen.getByText('Imported')).not.toBeNull());
    fireEvent.click(screen.getByTestId('lucid-sleep-disable'));
    await waitFor(() =>
      expect(screen.getByText(/The local copy could not be changed. The previous snapshot was kept./)).not.toBeNull()
    );
    expect(screen.getByText('Imported')).not.toBeNull();
    expect(screen.getByText('Apple Watch · com.apple.NanoSleep')).not.toBeNull();
    expect(screen.queryByText(/Health query failed/)).toBeNull();
  });

  it('keeps the previous snapshot when initial load fails', async () => {
    mockLoadSnapshot.mockRejectedValue(new Error('kv down'));
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() =>
      expect(screen.getByText(/The local snapshot could not be loaded. The previous view remains./)).not.toBeNull()
    );
    expect(screen.queryByText('Imported')).toBeNull();
    expect(screen.queryByText(/Health query failed/)).toBeNull();
  });

  it('keeps the previous snapshot when import persistence fails', async () => {
    mockImportSnapshot.mockRejectedValue(new Error('kv down'));
    render(<LucidSleepIntegrationScreen />);
    fireEvent.click(screen.getByTestId('lucid-sleep-connect'));
    await waitFor(() =>
      expect(screen.getByText(/The local copy could not be changed. The previous snapshot was kept./)).not.toBeNull()
    );
    expect(screen.queryByText('Imported')).toBeNull();
    expect(screen.queryByText(/Health query failed/)).toBeNull();
  });

  it('keeps the previous snapshot when delete storage fails', async () => {
    mockLoadSnapshot.mockResolvedValue(readySnapshot);
    mockDelete.mockRejectedValue(new Error('kv down'));
    render(<LucidSleepIntegrationScreen />);
    await waitFor(() => expect(screen.getByText('Imported')).not.toBeNull());
    fireEvent.click(screen.getByTestId('lucid-sleep-delete'));
    const confirm = Alert.alert.mock.calls[0][2].find((action: { style?: string }) => action.style === 'destructive');
    confirm.onPress();
    await waitFor(() =>
      expect(screen.getByText(/The local copy could not be changed. The previous snapshot was kept./)).not.toBeNull()
    );
    expect(screen.getByText('Imported')).not.toBeNull();
    expect(screen.getByText('Apple Watch · com.apple.NanoSleep')).not.toBeNull();
    expect(screen.queryByText(/Health query failed/)).toBeNull();
  });
});
