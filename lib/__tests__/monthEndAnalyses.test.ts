import { getMonthEndAnalyses } from '@/lib/monthEndAnalyses';
import type { DreamAnalysis, QuotaUsage } from '@/lib/types';

const dream = (id: number, extra: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id,
  transcript: 'A house by the sea',
  title: `Dream ${id}`,
  interpretation: '',
  shareableQuote: '',
  imageUrl: '',
  chatHistory: [],
  dreamType: 'Symbolic Dream',
  ...extra,
});
const usage = (remaining: number | null, limit: number | null = 3): QuotaUsage => ({
  analysis: { used: 0, limit, remaining },
  exploration: { used: 0, limit: null, remaining: null },
  messages: { used: 0, limit: null, remaining: null },
});
// The period turns over at midnight UTC on the 1st.
const OCT_27 = Date.parse('2026-10-27T08:00:00Z');
const OCT_25 = Date.parse('2026-10-25T08:00:00Z');
const unread = dream(Date.parse('2026-10-20T07:00:00Z'));
const older = dream(Date.parse('2026-10-02T07:00:00Z'));
const base = { tier: 'free' as const, signedIn: true, loading: false, error: null, usage: usage(2), dreams: [older, unread], now: OCT_27 };

it('names the analyses left and the newest dream still to read in the month’s last five days', () => {
  expect(getMonthEndAnalyses(base)).toEqual({ remaining: 2, dream: unread });
  expect(getMonthEndAnalyses({ ...base, now: OCT_25 })).toBeNull();
});

it('passes over dreams already read or whose reading is on its way', () => {
  const read = dream(Date.parse('2026-10-26T07:00:00Z'), { isAnalyzed: true, analyzedAt: Date.parse('2026-10-26T08:00:00Z'), interpretation: 'A reading' });
  const pending = dream(Date.parse('2026-10-26T09:00:00Z'), {
    analysisStatus: 'pending', analysisRequestId: '3f2c9b1e-8a4d-4c2b-9e1f-0a1b2c3d4e5f',
  });
  expect(getMonthEndAnalyses({ ...base, dreams: [older, unread, read, pending] })?.dream).toBe(unread);
  expect(getMonthEndAnalyses({ ...base, dreams: [read, pending] })).toBeNull();
});

it('says nothing to guests, Plus, used-up or unknown quotas', () => {
  expect(getMonthEndAnalyses({ ...base, signedIn: false })).toBeNull();
  expect(getMonthEndAnalyses({ ...base, tier: 'plus' })).toBeNull();
  expect(getMonthEndAnalyses({ ...base, usage: usage(0) })).toBeNull();
  expect(getMonthEndAnalyses({ ...base, usage: usage(null, null) })).toBeNull();
  expect(getMonthEndAnalyses({ ...base, loading: true })).toBeNull();
  expect(getMonthEndAnalyses({ ...base, error: new Error('offline') })).toBeNull();
});
