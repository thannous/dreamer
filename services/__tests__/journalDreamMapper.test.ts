import {
  mapDreamToRow,
  mapDreamToSyncPayload,
  mapRowToDream,
  mapRowToDreamListItem,
  parseSyncResult,
  type SupabaseDreamRow,
} from '../journalDreamMapper';
import type { DreamAnalysis } from '@/lib/types';

const NOW = 1_735_689_600_000;
const CREATED_AT = '2026-01-01T08:00:00.000Z';

const row = (overrides: Partial<SupabaseDreamRow> = {}): SupabaseDreamRow => ({
  id: 17,
  created_at: CREATED_AT,
  updated_at: '2026-01-01T08:01:00.000Z',
  client_updated_at: '2026-01-01T08:00:30.000Z',
  revision_id: 'rev-17',
  user_id: 'user-a',
  transcript: 'A long transcript',
  title: 'A dream',
  interpretation: 'An interpretation',
  shareable_quote: 'A quote',
  image_url: 'supabase-storage://dream-images/user-a/dream-17.webp',
  chat_history: [],
  theme: 'calm',
  dream_type: 'Symbolic Dream',
  is_favorite: true,
  image_generation_failed: true,
  is_analyzed: true,
  analyzed_at: '2026-01-01T08:02:00.000Z',
  analysis_status: 'done',
  analysis_request_id: 'analysis-17',
  exploration_started_at: '2026-01-01T08:03:00.000Z',
  client_request_id: 'client-17',
  has_person: null,
  has_animal: false,
  memory: { version: 1, origin: 'remembered', recurring: true, unknown: 'discard' },
  analysis_details: {
    symbols: [{ name: 'river', meaning: 'change', ignored: true }],
    emotions: [{ name: 'calm', insight: 'safe' }],
    reflectionQuestions: ['What changed?'],
    promptVersion: 'v2',
    analysisTranscriptHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    unknown: 'discard',
  },
  ...overrides,
});

const dream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: NOW,
  remoteId: 17,
  revisionId: 'rev-17',
  clientRequestId: 'client-17',
  clientUpdatedAt: NOW + 30_000,
  transcript: 'A long transcript',
  title: 'A dream',
  interpretation: 'An interpretation',
  shareableQuote: 'A quote',
  imageUrl: 'https://example.test/storage/v1/object/public/dream-images/user-a/dream-17.webp',
  thumbnailUrl: 'thumb-not-persisted',
  chatHistory: [],
  theme: 'calm',
  dreamType: 'Symbolic Dream',
  isFavorite: true,
  imageGenerationFailed: true,
  isAnalyzed: true,
  analysisStatus: 'done',
  analysisRequestId: 'analysis-17',
  analyzedAt: NOW + 120_000,
  explorationStartedAt: NOW + 180_000,
  hasPerson: false,
  hasAnimal: undefined,
  memory: { version: 1, origin: 'remembered', recurring: true },
  symbols: [{ name: 'river', meaning: 'change' }],
  emotions: [{ name: 'calm', insight: 'safe' }],
  reflectionQuestions: ['What changed?'],
  promptVersion: 'v2',
  analysisTranscriptHash: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  ...overrides,
});

describe('journal dream mapper', () => {
  it('keeps remote identity distinct when rows share the same creation timestamp', () => {
    const first = mapRowToDream(row({ id: 17 }), () => NOW);
    const second = mapRowToDream(row({ id: 18 }), () => NOW);
    const firstListItem = mapRowToDreamListItem(row({ id: 17 }), () => NOW);
    const secondListItem = mapRowToDreamListItem(row({ id: 18 }), () => NOW);

    expect(first.id).toBe(second.id);
    expect(first.remoteId).toBe(17);
    expect(second.remoteId).toBe(18);
    expect(firstListItem.remoteId).toBe(17);
    expect(secondListItem.remoteId).toBe(18);
  });

  it('preserves a 10,000-character Unicode transcript through list mapping and serialization', () => {
    const transcript = '🌙 rêve\n'.repeat(1_250);
    const source = row({ transcript });
    const mapped = mapRowToDream(source, () => NOW);
    const listItem = mapRowToDreamListItem(source, () => NOW);
    const serialized = mapDreamToRow(dream({ transcript }), 'user-a', true, true, true, () => NOW);

    expect(transcript.length).toBeGreaterThanOrEqual(10_000);
    expect(mapped.transcript).toBe(transcript);
    expect(listItem.transcript).toBe(transcript);
    expect(serialized.transcript).toBe(transcript);
  });

  it('keeps list items lightweight and excludes detail-only fields', () => {
    const listItem = mapRowToDreamListItem(row(), () => NOW);

    expect(listItem).not.toHaveProperty('interpretation');
    expect(listItem).not.toHaveProperty('chatHistory');
    expect(listItem).not.toHaveProperty('analysisDetails');
  });

  it('uses the injected clock for rows without a creation date and sanitizes metadata', () => {
    const mapped = mapRowToDream(
      row({ created_at: null, client_updated_at: null, memory: { origin: 'remembered', unknown: true } }),
      () => NOW
    );

    expect(mapped.id).toBe(NOW);
    expect(mapped.clientUpdatedAt).toBe(NOW);
    expect(mapped.memory).toEqual({ version: 1, origin: 'remembered' });
    expect(mapped.analysisDetails).toEqual({
      symbols: [{ name: 'river', meaning: 'change', ignored: true }],
      emotions: [{ name: 'calm', insight: 'safe' }],
      reflectionQuestions: ['What changed?'],
      promptVersion: 'v2',
      analysisTranscriptHash:
        'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    });
    expect(mapped.hasPerson).toBeUndefined();
  });

  it('serializes stable storage references and omits optional monotonic columns when disabled', () => {
    const mapped = mapDreamToRow(dream(), 'user-a', true, true, true, () => NOW);
    expect(mapped.image_url).toBe('supabase-storage://dream-images/user-a/dream-17.webp');
    expect(mapped.client_updated_at).toBe(new Date(NOW + 30_000).toISOString());
    expect(mapped.analysis_details).toMatchObject({ promptVersion: 'v2' });
    expect(mapped).not.toHaveProperty('thumbnail_url');

    const withoutOptionalColumns = mapDreamToRow(
      dream({
        analyzedAt: undefined,
        analysisRequestId: undefined,
        explorationStartedAt: undefined,
        clientRequestId: undefined,
        hasPerson: undefined,
        hasAnimal: undefined,
        symbols: undefined,
        emotions: undefined,
        reflectionQuestions: undefined,
        promptVersion: undefined,
        analysisTranscriptHash: undefined,
        analysisDetails: undefined,
      }),
      'user-a',
      false,
      false,
      false,
      () => NOW
    );
    expect(withoutOptionalColumns).not.toHaveProperty('image_generation_failed');
    expect(withoutOptionalColumns).not.toHaveProperty('client_updated_at');
    expect(withoutOptionalColumns).not.toHaveProperty('memory');
    expect(withoutOptionalColumns).not.toHaveProperty('analyzed_at');
    expect(withoutOptionalColumns).not.toHaveProperty('client_request_id');
    expect(withoutOptionalColumns).not.toHaveProperty('analysis_details');
  });

  it('adds sync identity fields and maps acknowledgements, conflicts, and malformed entries', () => {
    const payload = mapDreamToSyncPayload(dream(), 'user-a', true, true, () => NOW);
    expect(payload).toMatchObject({ remote_id: 17, revision_id: 'rev-17', user_id: 'user-a' });

    const results = parseSyncResult([
      { mutation_id: 'm1', client_request_id: 'client-17', operation: 'update', status: 'ack', remote_id: '17', dream: row() },
      { mutation_id: 'm2', client_request_id: 'client-18', operation: 'update', status: 'conflict', remote_id: 18 },
      { mutation_id: 'm3', client_request_id: 'client-19', operation: 'delete', status: null },
      { mutation_id: 'm4', client_request_id: 'client-20', operation: 'update', status: 'failed', error: 'offline' },
    ], () => NOW);

    expect(results[0]).toMatchObject({ mutationId: 'm1', status: 'ack', remoteId: 17 });
    expect(results[0].dream?.remoteId).toBe(17);
    expect(results[1]).toMatchObject({ mutationId: 'm2', status: 'conflict', remoteId: 18 });
    expect(results[2]).toMatchObject({ mutationId: 'm3', status: 'failed' });
    expect(results[3]).toMatchObject({ mutationId: 'm4', status: 'failed', error: 'offline' });
    expect(parseSyncResult({ malformed: true }, () => NOW)).toEqual([]);
  });
});

describe('journal mapper import boundary', () => {
  it('has no native or Supabase runtime imports', () => {
    const source = require('node:fs').readFileSync(require.resolve('../journalDreamMapper'), 'utf8');
    expect(source).not.toMatch(/from ['"](?:react-native|expo-|@supabase\/supabase-js)/);
    expect(source).not.toMatch(/require\(['"](?:react-native|expo-|@supabase\/supabase-js)/);
  });
});

it('round-trips an unclassified sparse reflection without fabricating a type or insights', () => {
  const source = row({ dream_type: 'Unknown', analysis_details: {
    symbols: [], emotions: [], reflectionQuestions: [], promptVersion: 'analysis-2026-09-08.1',
  } });
  const dream = mapRowToDream(source);
  expect(dream.dreamType).toBe('Unknown');
  expect(dream.symbols ?? []).toEqual([]);
  expect(dream.emotions ?? []).toEqual([]);
  expect(mapDreamToRow(dream, 'user-a').dream_type).toBe('Unknown');
  expect(mapRowToDreamListItem(source).dreamType).toBe('Unknown');
});
