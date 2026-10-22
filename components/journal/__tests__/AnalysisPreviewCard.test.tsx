import React from 'react';
import { act, fireEvent, render, waitFor } from '@testing-library/react-native-legacy';

import { HttpError } from '@/lib/http';
import { AnalysisPreviewCard } from '../AnalysisPreviewCard';

const mockFetchPreview = jest.fn();
const mockConsent = jest.fn();
let mockLang = 'fr';
jest.mock('@/services/analysisPreviewService', () => ({
  ...jest.requireActual('@/services/analysisPreviewService'),
  fetchAnalysisPreview: (...args: unknown[]) => mockFetchPreview(...args),
}));
jest.mock('@/lib/aiConsent', () => ({ requestAiConsent: () => mockConsent() }));
jest.mock('@/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params?.date ? `${key}:${params.date}` : key),
    currentLang: mockLang,
  }),
}));
jest.mock('@/hooks/useLocaleFormatting', () => ({
  useLocaleFormatting: () => ({ locale: 'fr-FR', formatDate: (time: number) => new Date(time).toISOString().slice(0, 10) }),
}));
jest.mock('@/lib/quotaReset', () => ({ formatQuotaResetDate: () => '1er novembre', withFirstDayOrdinal: (text: string) => text }));
jest.mock('@/context/ThemeContext', () => ({ useTheme: () => ({ colors: {}, mode: 'dark' }) }));
jest.mock('@/constants/noctaliaDesign', () => ({
  getNoctaliaDesignTokens: () => ({
    surface: { base: '#14131A' }, accent: { text: '#EAD4B4' }, text: { tertiary: '#888888' }, action: { primaryText: '#03040D' },
  }),
}));
jest.mock('@/components/ui/icon-symbol', () => ({ IconSymbol: () => null }));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('expo-image', () => ({ Image: () => null }));
jest.mock('../JournalBook', () => {
  const { Text } = require('react-native');
  return {
    BookSectionMark: ({ label }: { label: string }) => <Text>{label}</Text>,
    BookSubheading: ({ children }: { children: string }) => <Text>{children}</Text>,
    useBookBody: () => ({}),
  };
});

const preview = (image: Record<string, unknown> = { state: 'ready', bandUrl: 'https://x.test/sign/band.jpg?token=t' }) => ({
  state: 'ready',
  preview: { title: 'La rivière de verre', opening: 'Ton rêve fait de la rivière un passage.', symbols: ['Rivière', 'Maison'], image },
  preparedAt: '2026-10-22T07:00:00.000Z',
  retryAt: null,
});

beforeEach(() => {
  mockLang = 'fr';
  mockFetchPreview.mockReset();
  mockConsent.mockReset().mockResolvedValue(true);
});

const card = (onOpenPlus = jest.fn()) => <AnalysisPreviewCard remoteDreamId={7} transcript="Je marchais." onOpenPlus={onOpenPlus} />;
const renderCard = (onOpenPlus = jest.fn()) => render(card(onOpenPlus));

it('invites to prepare the analysis, with consent, then shows its start and locked rest', async () => {
  mockFetchPreview.mockResolvedValueOnce({ state: 'available', preview: null, preparedAt: null, retryAt: null });
  const onOpenPlus = jest.fn();
  const screen = renderCard(onOpenPlus);
  await waitFor(() => expect(screen.getByText('journal.detail.preview.invite')).toBeTruthy());
  expect(mockFetchPreview).toHaveBeenLastCalledWith(expect.objectContaining({ remoteDreamId: 7, lang: 'fr', prepare: false }));

  mockFetchPreview.mockResolvedValueOnce(preview());
  fireEvent.press(screen.getByTestId('btn.analysisPreview.prepare'));
  await waitFor(() => expect(screen.getByText('Ton rêve fait de la rivière un passage.')).toBeTruthy());
  expect(mockConsent).toHaveBeenCalledTimes(1);
  expect(mockFetchPreview).toHaveBeenLastCalledWith(expect.objectContaining({ prepare: true }));
  expect(screen.getByText('La rivière de verre')).toBeTruthy();
  expect(screen.getByText('Rivière')).toBeTruthy();
  expect(screen.getByTestId('component.analysisPreview.band')).toBeTruthy();
  expect(screen.getByText('journal.detail.preview.or_free:1er novembre')).toBeTruthy();
  fireEvent.press(screen.getByTestId('btn.analysisPreview.plus'));
  expect(onOpenPlus).toHaveBeenCalledWith(true);
});

it('holds the page’s offer while it offers one, and gives it back on a weekly note', async () => {
  const onOfferChange = jest.fn();
  mockFetchPreview.mockResolvedValueOnce({ state: 'available', preview: null, preparedAt: null, retryAt: null });
  const onOpenPlus = jest.fn();
  const screen = render(<AnalysisPreviewCard remoteDreamId={7} transcript="Je marchais." onOpenPlus={onOpenPlus} onOfferChange={onOfferChange} />);
  // Loading already holds it, so the page's own offer never shows and then vanishes.
  expect(onOfferChange).toHaveBeenLastCalledWith(true);
  await waitFor(() => expect(screen.getByText('journal.detail.preview.invite')).toBeTruthy());
  expect(onOfferChange).not.toHaveBeenCalledWith(false);
  // The invitation keeps a way to Plus, for a dream not prepared yet.
  fireEvent.press(screen.getByTestId('btn.analysisPreview.plusNow'));
  expect(onOpenPlus).toHaveBeenCalledWith(false);

  mockFetchPreview.mockResolvedValueOnce({ state: 'weekly_limit', preview: null, preparedAt: null, retryAt: '2026-10-29T07:00:00.000Z' });
  screen.rerender(<AnalysisPreviewCard remoteDreamId={8} transcript="Je volais." onOpenPlus={onOpenPlus} onOfferChange={onOfferChange} />);
  await waitFor(() => expect(onOfferChange).toHaveBeenLastCalledWith(false));
  screen.unmount();
  expect(onOfferChange).toHaveBeenLastCalledWith(false);
});

it('offers to try again when a writing never ends', async () => {
  jest.useFakeTimers();
  try {
    mockFetchPreview.mockResolvedValue({ state: 'writing', preview: null, preparedAt: null, retryAt: null });
    const screen = renderCard();
    for (let poll = 0; poll <= 50; poll += 1) {
      await act(async () => { jest.advanceTimersByTime(4000); });
    }
    await waitFor(() => expect(screen.getByTestId('btn.analysisPreview.retry')).toBeTruthy());
    expect(screen.getByTestId('btn.analysisPreview.plusNow')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

it('prepares nothing without consent', async () => {
  mockFetchPreview.mockResolvedValueOnce({ state: 'available', preview: null, preparedAt: null, retryAt: null });
  mockConsent.mockResolvedValue(false);
  const screen = renderCard();
  await waitFor(() => expect(screen.getByTestId('btn.analysisPreview.prepare')).toBeTruthy());
  await act(async () => { fireEvent.press(screen.getByTestId('btn.analysisPreview.prepare')); });
  expect(mockFetchPreview).toHaveBeenCalledTimes(1);
  expect(screen.getByText('journal.detail.preview.invite')).toBeTruthy();
});

it('reads again while the painting is under way, until its band arrives', async () => {
  jest.useFakeTimers();
  try {
    mockFetchPreview.mockResolvedValueOnce(preview({ state: 'painting', bandUrl: null })).mockResolvedValueOnce(preview());
    const screen = renderCard();
    await waitFor(() => expect(screen.getByText('journal.detail.preview.painting')).toBeTruthy());
    await act(async () => { jest.advanceTimersByTime(4000); });
    await waitFor(() => expect(screen.getByTestId('component.analysisPreview.band')).toBeTruthy());
    expect(mockFetchPreview).toHaveBeenLastCalledWith(expect.objectContaining({ prepare: false }));
  } finally {
    jest.useRealTimers();
  }
});

it('keeps the shown preview when a read fails while the painting is under way', async () => {
  jest.useFakeTimers();
  try {
    mockFetchPreview.mockResolvedValueOnce(preview({ state: 'painting', bandUrl: null }))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(preview());
    const screen = renderCard();
    await waitFor(() => expect(screen.getByText('journal.detail.preview.painting')).toBeTruthy());
    await act(async () => { jest.advanceTimersByTime(4000); });
    await waitFor(() => expect(mockFetchPreview).toHaveBeenCalledTimes(2));
    expect(screen.getByText('Ton rêve fait de la rivière un passage.')).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(4000); });
    await waitFor(() => expect(screen.getByTestId('component.analysisPreview.band')).toBeTruthy());
  } finally {
    jest.useRealTimers();
  }
});

it('prepares only for the language and text it was asked for', async () => {
  mockFetchPreview.mockResolvedValueOnce({ state: 'available', preview: null, preparedAt: null, retryAt: null })
    .mockResolvedValueOnce(preview());
  const screen = renderCard();
  await waitFor(() => expect(screen.getByTestId('btn.analysisPreview.prepare')).toBeTruthy());
  fireEvent.press(screen.getByTestId('btn.analysisPreview.prepare'));
  await waitFor(() => expect(screen.getByText('La rivière de verre')).toBeTruthy());
  expect(mockFetchPreview).toHaveBeenLastCalledWith(expect.objectContaining({ lang: 'fr', prepare: true }));

  mockLang = 'en';
  mockFetchPreview.mockResolvedValueOnce({ state: 'weekly_limit', preview: null, preparedAt: null, retryAt: '2026-10-29T07:00:00.000Z' });
  screen.rerender(card());
  await waitFor(() => expect(mockFetchPreview).toHaveBeenCalledTimes(3));
  expect(mockFetchPreview).toHaveBeenLastCalledWith(expect.objectContaining({ lang: 'en', prepare: false }));

  // Back to French: the tap was already sent, the card only reads.
  mockLang = 'fr';
  mockFetchPreview.mockResolvedValueOnce(preview());
  screen.rerender(card());
  await waitFor(() => expect(mockFetchPreview).toHaveBeenCalledTimes(4));
  expect(mockFetchPreview).toHaveBeenLastCalledWith(expect.objectContaining({ lang: 'fr', prepare: false }));
});

it('says when the next prepared analysis comes after this week’s', async () => {
  mockFetchPreview.mockResolvedValueOnce({ state: 'weekly_limit', preview: null, preparedAt: null, retryAt: '2026-10-29T07:00:00.000Z' });
  const screen = renderCard();
  await waitFor(() => expect(screen.getByText('journal.detail.preview.weekly_limit:2026-10-29')).toBeTruthy());
  expect(screen.queryByTestId('btn.analysisPreview.prepare')).toBeNull();
});

it('steps aside for a refused dream, and offers a retry after a failed preparation', async () => {
  mockFetchPreview.mockRejectedValueOnce(new HttpError({ status: 409, statusText: '', url: '', bodyText: '', body: { code: 'CAN_ANALYZE' } }));
  const refused = renderCard();
  await waitFor(() => expect(mockFetchPreview).toHaveBeenCalledTimes(1));
  expect(refused.queryByTestId('component.analysisPreview')).toBeNull();
  refused.unmount();

  mockFetchPreview.mockReset();
  mockFetchPreview.mockResolvedValueOnce({ state: 'available', preview: null, preparedAt: null, retryAt: null })
    .mockRejectedValueOnce(new HttpError({ status: 502, statusText: '', url: '', bodyText: '', body: { code: 'PREVIEW_FAILED' } }));
  const screen = renderCard();
  await waitFor(() => expect(screen.getByTestId('btn.analysisPreview.prepare')).toBeTruthy());
  fireEvent.press(screen.getByTestId('btn.analysisPreview.prepare'));
  await waitFor(() => expect(screen.getByText('journal.detail.preview.failed')).toBeTruthy());
  expect(screen.getByTestId('btn.analysisPreview.retry')).toBeTruthy();
});

it('shows nothing of a former dream while another one loads, and says when a reading can be reported', async () => {
  const onReadingChange = jest.fn();
  mockFetchPreview.mockResolvedValueOnce(preview());
  const screen = render(<AnalysisPreviewCard remoteDreamId={7} transcript="Je marchais." onOpenPlus={jest.fn()} onReadingChange={onReadingChange} />);
  await waitFor(() => expect(screen.getByText('La rivière de verre')).toBeTruthy());
  expect(onReadingChange).toHaveBeenLastCalledWith(true);

  let answer: (value: unknown) => void = () => {};
  mockFetchPreview.mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }));
  screen.rerender(<AnalysisPreviewCard remoteDreamId={8} transcript="Je volais." onOpenPlus={jest.fn()} onReadingChange={onReadingChange} />);
  expect(screen.queryByText('La rivière de verre')).toBeNull();
  expect(onReadingChange).toHaveBeenLastCalledWith(false);
  await act(async () => { answer({ state: 'available', preview: null, preparedAt: null, retryAt: null }); });
  expect(screen.getByText('journal.detail.preview.invite')).toBeTruthy();
});
