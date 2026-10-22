import { HttpError } from '@/lib/http';
import { analysisPreviewRefusal, fetchAnalysisPreview } from '@/services/analysisPreviewService';

const mockFetch = jest.fn();
let mockMode = false;
jest.mock('@/lib/apiSession', () => ({ fetchJSONWithSession: (...args: unknown[]) => mockFetch(...args) }));
jest.mock('@/lib/config', () => ({ getApiBaseUrl: () => 'https://api.test/functions/v1/api' }));
jest.mock('@/lib/env', () => ({ isMockModeEnabled: () => mockMode }));
jest.mock('@/mock-data/assets', () => ({ getMockDreamImage: () => 'http://localhost/frozen-lake.webp' }));

const preview = {
  title: 'La rivière de verre',
  opening: 'Ton rêve fait de la rivière un passage.',
  symbols: ['Rivière', 'Maison'],
  image: { state: 'ready', bandUrl: 'https://project.supabase.co/storage/v1/object/sign/dream-images/previews/u1/7-a-band.jpg?token=t' },
};
const ready = (extra: Record<string, unknown> = {}) => ({
  state: 'ready', preview, preparedAt: '2026-10-22T07:00:00.000Z', retryAt: null, ...extra,
});

beforeEach(() => {
  mockFetch.mockReset();
  mockMode = false;
});

it('reads a dream’s preview, and prepares one only when asked', async () => {
  mockFetch.mockResolvedValue(ready());
  expect((await fetchAnalysisPreview({ remoteDreamId: 7, lang: 'fr' })).preview?.opening).toBe(preview.opening);
  expect(mockFetch).toHaveBeenLastCalledWith('https://api.test/functions/v1/api/analysis-preview', expect.objectContaining({
    method: 'POST', body: { dreamId: 7, lang: 'fr' }, timeoutMs: 10000,
  }));
  await fetchAnalysisPreview({ remoteDreamId: 7, lang: 'fr', prepare: true });
  // Preparing waits for the reading and is never retried: a retry would pay twice.
  expect(mockFetch.mock.calls[1][1]).toEqual(expect.objectContaining({ body: { dreamId: 7, lang: 'fr', prepare: true }, retries: 0, timeoutMs: 70000 }));
});

it('accepts a preview only in the shape a free account may see', async () => {
  mockFetch.mockResolvedValueOnce({ state: 'weekly_limit', preview: null, preparedAt: null, retryAt: '2026-10-29T07:00:00.000Z' });
  expect((await fetchAnalysisPreview({ remoteDreamId: 7, lang: 'fr' })).retryAt).toBe('2026-10-29T07:00:00.000Z');
  mockFetch.mockResolvedValueOnce(ready({ preview: { ...preview, image: { state: 'painting', bandUrl: null } } }));
  expect((await fetchAnalysisPreview({ remoteDreamId: 7, lang: 'fr' })).preview?.image.state).toBe('painting');
  for (const broken of [
    ready({ preview: null }),
    ready({ state: 'available' }),
    ready({ preview: { ...preview, symbols: ['1', '2', '3', '4', '5', '6', '7'] } }),
    ready({ preview: { ...preview, opening: '' } }),
    ready({ preview: { ...preview, image: { state: 'ready', bandUrl: null } } }),
    ready({ preview: { ...preview, image: { state: 'ready', bandUrl: 'http://insecure.test/band.jpg' } } }),
    ready({ preview: { ...preview, image: { state: 'none', bandUrl: 'https://x.test/band.jpg' } } }),
    { state: 'weekly_limit', preview: null, preparedAt: null, retryAt: null },
    { state: 'later', preview: null, preparedAt: null, retryAt: null },
    null,
  ]) {
    mockFetch.mockResolvedValueOnce(broken);
    await expect(fetchAnalysisPreview({ remoteDreamId: 7, lang: 'fr' })).rejects.toThrow('Invalid analysis preview response');
  }
});

it('tells a refused dream from a failed request', () => {
  const failure = (status: number, body?: unknown) => new HttpError({ status, statusText: '', url: '', bodyText: '', body });
  expect(analysisPreviewRefusal(failure(409, { code: 'CAN_ANALYZE' }))).toBe('CAN_ANALYZE');
  expect(analysisPreviewRefusal(failure(409, { code: 'PLUS_ANALYZES' }))).toBe('PLUS_ANALYZES');
  expect(analysisPreviewRefusal(failure(502, { code: 'PREVIEW_FAILED' }))).toBeNull();
  expect(analysisPreviewRefusal(failure(429))).toBeNull();
  expect(analysisPreviewRefusal(new Error('offline'))).toBeNull();
});

it('mock mode prepares a fixed preview whose band arrives after the reading', async () => {
  mockMode = true;
  jest.useFakeTimers({ now: Date.parse('2026-10-22T07:00:00Z') });
  try {
    expect((await fetchAnalysisPreview({ remoteDreamId: 9, lang: 'fr' })).state).toBe('available');
    const prepared = await fetchAnalysisPreview({ remoteDreamId: 9, lang: 'fr', prepare: true });
    expect(prepared.preview?.image).toEqual({ state: 'painting', bandUrl: null });
    jest.setSystemTime(Date.parse('2026-10-22T07:00:05Z'));
    expect((await fetchAnalysisPreview({ remoteDreamId: 9, lang: 'fr' })).preview?.image.state).toBe('ready');
    expect(mockFetch).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
