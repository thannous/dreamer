import React from 'react';
import { Alert, FlatList } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { LucidScreen } from '@/components/lucid/LucidUI';
import LucidJournalImportScreen from '@/app/lucid/journal-import';
import type { LucidJournalImportRuntimeState } from '@/services/lucidJournalImportRuntime';
// Keep the real VirtualizedList; only replace its native scroll host in Jest.
jest.mock('react-native/Libraries/Components/ScrollView/ScrollView', () => {
  const React = require('react');
  const { View } = require('react-native');
  const ScrollView = React.forwardRef((props: any, ref: any) => <View {...props} ref={ref} />);
  ScrollView.displayName = 'MockNativeScrollView';
  ScrollView.Context = React.createContext(null);
  return { __esModule: true, default: ScrollView };
});
const mockPrepare = jest.fn();
const mockConfirm = jest.fn();
const mockCancel = jest.fn();
const mockDeleteAll = jest.fn();
const mockUpdateCopy = jest.fn();
let mockUserScope = 'guest';
let mockRemoteAvailable = true;
let mockState: LucidJournalImportRuntimeState;
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/context/LucidTrainerContext', () => ({ useLucidTrainer: () => ({ content: { locale: 'en' }, userScope: mockUserScope }) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/lucidTheme', () => ({ LucidSpace: { md: 16 }, LucidType: { caption: [14,20] }, getLucidPalette: () => ({ text: '#fff', textSecondary: '#ddd' }) }));
jest.mock('@/components/lucid/LucidUI', () => {
  const { View, Text, Pressable } = require('react-native');
  return { LucidScreen: ({ children }: any) => <View>{children}</View>, LucidCard: View,
    LucidSectionHeader: ({ title }: any) => <Text>{title}</Text>,
    LucidScreenHeader: ({ title, trailing }: any) => <View><Text accessibilityRole="header">{title}</Text>{trailing}</View>,
    LucidIconAction: ({ label, onPress }: any) => <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} />,
    LucidButton: ({ label, onPress, disabled }: any) => <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button"><Text>{label}</Text></Pressable> };
});
jest.mock('@/hooks/useLucidJournalImport', () => ({ useLucidJournalImport: () => ({
  state: mockState, available: true, remoteAvailable: mockRemoteAvailable, signedIn: true, prepare: mockPrepare, confirmStart: mockConfirm,
  cancel: mockCancel, updateCopy: mockUpdateCopy, deleteAll: mockDeleteAll,
}) }));
beforeEach(() => {
  jest.clearAllMocks();
  mockRemoteAvailable = true;
  mockUserScope = 'guest';
  mockUpdateCopy.mockResolvedValue(true);
  mockState = { status: 'idle', preparation: null, snapshot: null, progress: null, errorCode: null };
});
it('requires separate preparation and explicit confirmation, including empty imports', () => {
  const { getByText, queryByText, rerender } = render(<LucidJournalImportScreen />);
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(queryByText('Confirm import')).toBeNull();
  fireEvent.press(getByText('Last 30 dreams'));
  fireEvent.press(getByText('Authorize reading in Journal'));
  expect(mockPrepare).toHaveBeenCalledWith('recent30');
  expect(mockConfirm).not.toHaveBeenCalled();
  mockState = { ...mockState, status: 'ready', preparation: { sourceAccount: 'A', perimeter: 'recent30', knownCount: 0 } };
  rerender(<LucidJournalImportScreen />);
  expect(getByText('Local copies: 0')).toBeTruthy();
  expect(getByText('Selected scope: Last 30 dreams')).toBeTruthy();
  fireEvent.press(getByText('Confirm import'));
  expect(mockConfirm).toHaveBeenCalledTimes(1);
});
it('shows durable progress and allows cancellation', () => {
  mockState = { ...mockState, status: 'importing', progress: { persistedPages: 2, availableCopies: 10, done: false } };
  const { getByText } = render(<LucidJournalImportScreen />);
  expect(getByText('Pages saved: 2 · Copies available: 10')).toBeTruthy();
  fireEvent.press(getByText('Cancel'));
  expect(mockCancel).toHaveBeenCalledTimes(1);
});

it('keeps local copies visible when remote import is unavailable and confirms bulk deletion', () => {
  const alert = jest.spyOn(Alert, 'alert');
  mockState = { ...mockState, status: 'error', errorCode: 'unavailable', snapshot: { version: 1, checkpoint: null, copies: {
    copy: { identity: 'copy', sourceProduct: 'journal', sourceAccount: 'A', sourceId: '1', sourceRevision: 'v1',
      createdAt: null, importedAt: '2026-09-09', text: 'My local narrative', edited: false, deleted: false },
  } } };
  const { getByText } = render(<LucidJournalImportScreen />);
  expect(getByText('My local narrative')).toBeTruthy();
  expect(getByText('Date unavailable · Local only')).toBeTruthy();
  fireEvent.press(getByText('Delete all copies'));
  expect(alert).toHaveBeenCalled();
  expect(mockDeleteAll).not.toHaveBeenCalled();
  alert.mockRestore();
});

it('disables authorization without remote configuration and explains availability', () => {
  mockRemoteAvailable = false;
  const { getByText } = render(<LucidJournalImportScreen />);
  fireEvent.press(getByText('Authorize reading in Journal'));
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(getByText('Import is unavailable in this version. Local copies remain accessible.')).toBeTruthy();
});
it.each(['complete', 'cancelled'] as const)('shows failures even after %s', status => {
  mockState = { ...mockState, status, errorCode: 'cleanup_failed' };
  const { getByRole, queryByText } = render(<LucidJournalImportScreen />);
  expect(getByRole('alert')).toBeTruthy();
  expect(queryByText(/Import complete/)).toBeNull();
});

function setCopies(count: number) {
  mockState = { ...mockState, snapshot: { version: 1, checkpoint: null, copies: Object.fromEntries(
    Array.from({ length: count }, (_, i) => [`copy-${i}`, {
      identity: `copy-${i}`, sourceProduct: 'journal' as const, sourceAccount: 'A', sourceId: String(i),
      sourceRevision: 'v1', createdAt: null, importedAt: '2026-09-09', text: `Narrative ${i}`,
      edited: false, deleted: false,
    }]),
  ) } };
}
it.each([0, 1, 2501])('renders a bounded initial collection with %i copies without loading Journal', count => {
  setCopies(count);
  const screen = render(<LucidJournalImportScreen />);
  expect(screen.queryAllByText(/^Narrative /)).toHaveLength(Math.min(count, 4));
  expect(screen.UNSAFE_getByType(FlatList).props.data).toHaveLength(count);
  expect(mockPrepare).not.toHaveBeenCalled();
  expect(screen.queryByText('No local copies yet.') !== null).toBe(count === 0);
});
it('saves the selected copy and isolates an unsaved draft after account changes', async () => {
  setCopies(2501);
  const screen = render(<LucidJournalImportScreen />);
  fireEvent.press(screen.getAllByText('Edit local copy')[1]);
  fireEvent.changeText(screen.getByLabelText('Edit local copy'), 'My corrected narrative');
  await act(async () => { fireEvent.press(screen.getByText('Save locally')); });
  expect(mockUpdateCopy).toHaveBeenCalledWith('copy-1', { type: 'edit', text: 'My corrected narrative' });
  fireEvent.press(screen.getAllByText('Edit local copy')[1]);
  fireEvent.changeText(screen.getByLabelText('Edit local copy'), 'Private guest draft');
  mockUserScope = 'user:B';
  screen.rerender(<LucidJournalImportScreen />);
  expect(screen.queryByDisplayValue('Private guest draft')).toBeNull();
  expect(screen.queryByText('Save locally')).toBeNull();
});
it('retains a draft outside the rendered list window', () => {
  setCopies(2501);
  const screen = render(<LucidJournalImportScreen />);
  fireEvent.press(screen.getAllByText('Edit local copy')[1]);
  fireEvent.changeText(screen.getByLabelText('Edit local copy'), 'Draft survives unmount');
  // Move the selected item outside the initial window, as a refreshed snapshot can do.
  const copies = mockState.snapshot!.copies;
  mockState = { ...mockState, snapshot: { ...mockState.snapshot!, copies: {
    ...Object.fromEntries(Object.entries(copies).filter(([id]) => id !== 'copy-1')), 'copy-1': copies['copy-1'],
  } } };
  screen.rerender(<LucidJournalImportScreen />);
  expect(screen.queryByDisplayValue('Draft survives unmount')).toBeNull();
  mockState = { ...mockState, snapshot: { ...mockState.snapshot!, copies } };
  screen.rerender(<LucidJournalImportScreen />);
  expect(screen.getByDisplayValue('Draft survives unmount')).toBeTruthy();
});

it('keeps the title and close action inside the scrollable list header', () => {
  const screen = render(<LucidJournalImportScreen />);
  const shell = screen.UNSAFE_getByType(LucidScreen);
  expect(shell.props.title).toBeUndefined();
  expect(shell.props.trailing).toBeUndefined();
  expect(shell.props.scroll).toBe(false);
  const listHeader = screen.UNSAFE_getByType(FlatList).props.ListHeaderComponent;
  const header = render(listHeader);
  expect(header.getByRole('header', { name: 'Import from Journal' })).toBeTruthy();
  expect(header.getByRole('button', { name: 'Close' })).toBeTruthy();
});
