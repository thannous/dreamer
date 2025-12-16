import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  storageFrom: vi.fn(() => ({ remove: vi.fn().mockResolvedValue({}) })),
  authGetUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mocks.from,
    storage: { from: mocks.storageFrom },
    auth: { getUser: mocks.authGetUser },
  })),
}));

describe('supabaseDreamService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.com';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('updateDreamInSupabase throws when remoteId is missing', async () => {
    const { updateDreamInSupabase } = await import('../supabaseDreamService');

    await expect(
      updateDreamInSupabase({
        id: 1,
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
      } as any),
    ).rejects.toThrow('Missing remote id');
  });

  it('createDreamInSupabase retries without image_generation_failed on PGRST204', async () => {
    const singleMock = vi.fn()
      .mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST204', message: 'column dreams.image_generation_failed does not exist' },
      })
      .mockResolvedValueOnce({
        data: {
          id: 42,
          created_at: '2020-01-01T00:00:00.000Z',
          user_id: 'user-1',
          transcript: 't',
          title: 'x',
          interpretation: '',
          shareable_quote: '',
          image_url: null,
          chat_history: [],
          theme: null,
          dream_type: 'Symbolic Dream',
          is_favorite: false,
          image_generation_failed: true,
          is_analyzed: true,
          analyzed_at: null,
          analysis_status: 'done',
          analysis_request_id: null,
          exploration_started_at: null,
          client_request_id: 'req-1',
        },
        error: null,
      });

    const upsertMock = vi.fn((_row: any) => ({
      select: vi.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = await import('../supabaseDreamService');

    const dream = await createDreamInSupabase(
      {
        id: 1,
        clientRequestId: 'req-1',
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      } as any,
      'user-1',
    );

    expect(upsertMock).toHaveBeenCalledTimes(2);

    const firstRow = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const secondRow = (((upsertMock as any).mock.calls[1]?.[0] ?? {}) as unknown) as Record<string, unknown>;

    expect(firstRow).toHaveProperty('image_generation_failed');
    expect(secondRow).not.toHaveProperty('image_generation_failed');

    // Mapping sanity checks from the returned row.
    expect(dream.remoteId).toBe(42);
    expect(dream.thumbnailUrl).toBeUndefined();
    expect(dream.imageGenerationFailed).toBe(true);
  });

  it('mapRowToDream forces imageGenerationFailed=false when image_url is present', async () => {
    const singleMock = vi.fn().mockResolvedValueOnce({
      data: {
        id: 7,
        created_at: '2020-01-01T00:00:00.000Z',
        user_id: 'user-1',
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareable_quote: '',
        image_url: 'https://example.com/dream.webp',
        chat_history: [],
        theme: null,
        dream_type: 'Symbolic Dream',
        is_favorite: false,
        image_generation_failed: true,
        is_analyzed: false,
        analyzed_at: null,
        analysis_status: 'none',
        analysis_request_id: null,
        exploration_started_at: null,
        client_request_id: 'req-1',
      },
      error: null,
    });

    const upsertMock = vi.fn((_row: any) => ({
      select: vi.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = await import('../supabaseDreamService');

    const dream = await createDreamInSupabase(
      {
        id: 1,
        clientRequestId: 'req-1',
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: 'https://example.com/dream.webp',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      } as any,
      'user-1',
    );

    expect(dream.thumbnailUrl).toBe('https://example.com/dream.webp');
    expect(dream.imageGenerationFailed).toBe(false);
  });
});
