import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import LucidJournalImportScreen from '@/app/lucid/journal-import';
import type { LucidJournalImportRuntimeState } from '@/services/lucidJournalImportRuntime';
const mockPrepare = jest.fn();
const mockConfirm = jest.fn();
const mockCancel = jest.fn();
const mockDeleteAll = jest.fn();
let mockState: LucidJournalImportRuntimeState;
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/context/LucidTrainerContext', () => ({ useLucidTrainer: () => ({ content: { locale: 'en' }, userScope: 'guest' }) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/lucidTheme', () => ({ LucidSpace: { md: 16 }, LucidType: { caption: [14,20] }, getLucidPalette: () => ({ text: '#fff', textSecondary: '#ddd' }) }));
jest.mock('@/components/lucid/LucidUI', () => {
  const { View, Text, Pressable } = require('react-native');
  return { LucidScreen: ({ children }: any) => <View>{children}</View>, LucidCard: View,
    LucidSectionHeader: ({ title }: any) => <Text>{title}</Text>, LucidIconAction: () => null,
    LucidButton: ({ label, onPress, disabled }: any) => <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button"><Text>{label}</Text></Pressable> };
});
jest.mock('@/hooks/useLucidJournalImport', () => ({ useLucidJournalImport: () => ({
  state: mockState, available: true, signedIn: false, prepare: mockPrepare, confirmStart: mockConfirm,
  cancel: mockCancel, updateCopy: jest.fn(), deleteAll: mockDeleteAll,
}) }));
beforeEach(() => {
  jest.clearAllMocks();
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
