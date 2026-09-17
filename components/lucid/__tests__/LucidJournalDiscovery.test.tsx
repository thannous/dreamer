/** @jest-environment jsdom */
import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Linking, Platform } from 'react-native';
import { LucidJournalDiscovery } from '../LucidJournalDiscovery';
import { openJournalDiscovery, isJournalDiscoveryVisible, JOURNAL_APP_URL, JOURNAL_WEBSITE_URL } from '@/services/lucidJournalDiscovery';

const memory = new Map<string, string>();
const mockGet = jest.fn(async (key: string) => memory.get(key) ?? null);
const mockSet = jest.fn(async (key: string, value: string) => { memory.set(key, value); });
jest.mock('@/services/lucidKeyValueStorage', () => ({ getLucidKeyValueStorage: () => ({ getItem: mockGet, setItem: mockSet }) }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/lucidTheme', () => ({ ...jest.requireActual('@/constants/lucidTheme'), getLucidPalette: () => ({}) }));
jest.mock('@/components/lucid/LucidUI', () => ({
  LucidCard: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LucidButton: ({ label, onPress, loading }: { label: string; onPress: () => void; loading: boolean }) => <button disabled={loading} onClick={onPress}>{label}</button>,
}));

beforeEach(() => { memory.clear(); jest.clearAllMocks(); Platform.OS = 'android'; });
afterEach(cleanup);

it('waits for storage, hides durably across remount, without reading account or Journal data', async () => {
  const view = render(<LucidJournalDiscovery locale="en" />);
  expect(screen.queryByText('Discover the Noctalia journal')).toBeNull();
  fireEvent.click(await screen.findByText('Hide this recommendation'));
  await waitFor(() => expect(screen.queryByText('Discover the Noctalia journal')).toBeNull());
  view.unmount();
  render(<LucidJournalDiscovery locale="en" />);
  await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
  expect(await isJournalDiscoveryVisible()).toBe(false);
  expect(screen.queryByText('Discover the Noctalia journal')).toBeNull();
  expect(mockGet.mock.calls.every(([key]) => key === 'noctalia_lucid_discovery:journal_hidden_v1')).toBe(true);
});

it('fails closed on storage read errors and unknown values', async () => {
  mockGet.mockRejectedValueOnce(new Error('disk'));
  expect(await isJournalDiscoveryVisible()).toBe(false);
  memory.set('noctalia_lucid_discovery:journal_hidden_v1', 'corrupt');
  expect(await isJournalDiscoveryVisible()).toBe(false);
});

it('keeps hide actionable after a failed write and persists a retry', async () => {
  mockSet.mockRejectedValueOnce(new Error('disk'));
  render(<LucidJournalDiscovery locale="en" />);
  fireEvent.click(await screen.findByText('Hide this recommendation'));
  await screen.findByText('Could not save this choice. Tap Hide again to retry.');
  fireEvent.click(screen.getByText('Hide this recommendation'));
  await waitFor(() => expect(screen.queryByText('Discover the Noctalia journal')).toBeNull());
});

it('opens the installed app with no payload and preserves the mounted context', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  render(<LucidJournalDiscovery locale="en" />);
  fireEvent.click(await screen.findByText('Discover Noctalia'));
  await waitFor(() => expect(open).toHaveBeenCalledWith(JOURNAL_APP_URL));
  expect(open).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Discover the Noctalia journal')).toBeTruthy();
  expect(mockSet).not.toHaveBeenCalled();
});

it('falls back to the official website and leaves an unavailable link retryable', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unavailable'));
  render(<LucidJournalDiscovery locale="fr" />);
  fireEvent.click(await screen.findByText('Découvrir Noctalia'));
  await screen.findByText('Noctalia n’a pas pu être ouvert. Tu peux réessayer plus tard.');
  expect(open.mock.calls.map(([url]) => url)).toEqual([JOURNAL_APP_URL, JOURNAL_WEBSITE_URL]);
  expect(screen.getByText('Masquer cette recommandation')).toBeTruthy();
  open.mockResolvedValue(undefined);
});

it.each(['en', 'fr', 'es', 'de', 'it'] as const)('renders independent discovery copy in %s', async (locale) => {
  render(<LucidJournalDiscovery locale={locale} />);
  await waitFor(() => expect(screen.getAllByRole('button')).toHaveLength(2));
});

it('uses the website alone on web and succeeds when the native app is absent', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  Platform.OS = 'web';
  await openJournalDiscovery();
  expect(open.mock.calls).toEqual([[JOURNAL_WEBSITE_URL]]);
  open.mockClear().mockRejectedValueOnce(new Error('not installed'));
  Platform.OS = 'android';
  await openJournalDiscovery();
  expect(open.mock.calls).toEqual([[JOURNAL_APP_URL], [JOURNAL_WEBSITE_URL]]);
});
