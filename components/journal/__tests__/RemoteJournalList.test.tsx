import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RemoteJournalList } from '../RemoteJournalList';
import { useRemoteJournalList } from '@/hooks/useRemoteJournalList';
jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: ({ data, renderItem, ListFooterComponent, ListHeaderComponent }: any) =>
    React.createElement(View, null, ListHeaderComponent, data.map((item: any) => React.createElement(View, { key: item.id }, renderItem({ item }))), ListFooterComponent) };
});
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
jest.mock('@/hooks/useRemoteJournalList');
jest.mock('@/hooks/useTranslation', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('@/hooks/useLocaleFormatting', () => ({ useLocaleFormatting: () => ({ formatShortDate: () => 'Today' }) }));
const loadMore = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useRemoteJournalList).mockReturnValue({ userId: 'a', items: [{ id: 1, remoteId: 1, title: 'Night', transcript: 'A forest' } as any], loading: false, complete: false, error: false, loadMore });
});
it('keeps pagination available when loaded previews do not match search', () => {
  const screen = render(<RemoteJournalList userId="a" searchQuery="ocean" onOpenDream={jest.fn()} />);
  expect(screen.queryByText('Night')).toBeNull();
  fireEvent.press(screen.getByText('journal.pagination.more'));
  expect(loadMore).toHaveBeenCalledTimes(1);
});
it('shows detail failure and permits opening the same row again', async () => {
  const open = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
  const screen = render(<RemoteJournalList userId="a" searchQuery="forest" onOpenDream={open} />);
  fireEvent.press(screen.getByText('Night'));
  await waitFor(() => expect(screen.getByText('journal.preview.open_failed')).toBeTruthy());
  fireEvent.press(screen.getByText('Night'));
  await waitFor(() => expect(open).toHaveBeenCalledTimes(2));
});
it('allows only one pending detail read', async () => {
  let resolve!: () => void;
  const open = jest.fn(() => new Promise<void>(done => { resolve = done; }));
  const screen = render(<RemoteJournalList userId="a" searchQuery="" onOpenDream={open} />);
  fireEvent.press(screen.getByText('Night'));
  fireEvent.press(screen.getByText('Night'));
  expect(open).toHaveBeenCalledTimes(1);
  resolve();
  await waitFor(() => expect(screen.queryByText('journal.preview.loading')).toBeNull());
});
