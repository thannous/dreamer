import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mocks = ((factory: any) => factory())(() => {
  const storageUpload = jest.fn();
  const storageRemove = jest.fn().mockResolvedValue({});
  const storageGetPublicUrl = jest.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example.com/${path}` },
  }));

  return {
    from: jest.fn(),
    storageUpload,
    storageRemove,
    storageGetPublicUrl,
    storageFrom: jest.fn(() => ({
      upload: storageUpload,
      remove: storageRemove,
      getPublicUrl: storageGetPublicUrl,
    })),
    authGetUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  };
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mocks.from,
    storage: { from: mocks.storageFrom },
    auth: { getUser: mocks.authGetUser },
  })),
}));

jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { WEBP: 'webp' },
  manipulateAsync: jest.fn(async () => ({
    base64: 'dGVzdA==',
    width: 100,
    height: 100,
  })),
}));

describe('supabaseDreamService', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.com';
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
  });

  it('updateDreamInSupabase throws when remoteId is missing', async () => {
    const { updateDreamInSupabase } = require('../supabaseDreamService');

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
    const singleMock = jest.fn()
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

    const upsertMock = jest.fn((_row: any) => ({
      select: jest.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = require('../supabaseDreamService');

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
    const singleMock = jest.fn().mockResolvedValueOnce({
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

    const upsertMock = jest.fn((_row: any) => ({
      select: jest.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = require('../supabaseDreamService');

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

  it('fetchDreamsFromSupabase maps rows correctly', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      data: [
        {
          id: 9,
          created_at: '2020-01-01T00:00:00.000Z',
          transcript: 't',
          title: 'x',
          interpretation: '',
          shareable_quote: '',
          image_url: null,
          chat_history: null,
          theme: null,
          dream_type: 'Symbolic Dream',
          is_favorite: null,
          image_generation_failed: true,
          is_analyzed: true,
          analyzed_at: null,
          analysis_status: 'done',
          analysis_request_id: null,
          exploration_started_at: null,
          client_request_id: 'req-1',
          has_person: null,
          has_animal: true,
        },
      ],
      error: null,
    });

    mocks.from.mockReturnValue({
      select: jest.fn(() => ({ order: orderMock })),
    });

    const { fetchDreamsFromSupabase } = require('../supabaseDreamService');
    const dreams = await fetchDreamsFromSupabase();

    expect(dreams).toHaveLength(1);
    expect(dreams[0]?.imageGenerationFailed).toBe(true);
    expect(dreams[0]?.hasPerson).toBeUndefined();
    expect(dreams[0]?.hasAnimal).toBe(true);
  });

  it('fetchDreamsFromSupabase throws when supabase returns error', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      data: null,
      error: { code: 'PGRST001', message: 'query failed' },
    });

    mocks.from.mockReturnValue({
      select: jest.fn(() => ({ order: orderMock })),
    });

    const { fetchDreamsFromSupabase } = require('../supabaseDreamService');

    await expect(fetchDreamsFromSupabase()).rejects.toThrow('query failed');
  });

  it('createDreamInSupabase uploads inline images and thumbnails', async () => {
    mocks.storageUpload.mockImplementation(async (path: string) => ({
      data: { path },
      error: null,
    }));

    const singleMock = jest.fn(async () => ({
      data: {
        id: 11,
        created_at: '2020-01-01T00:00:00.000Z',
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareable_quote: '',
        image_url: 'https://cdn.example.com/user-1/dream.webp',
        chat_history: [],
        theme: null,
        dream_type: 'Symbolic Dream',
        is_favorite: false,
        image_generation_failed: false,
        is_analyzed: true,
        analyzed_at: null,
        analysis_status: 'done',
        analysis_request_id: null,
        exploration_started_at: null,
        client_request_id: 'req-inline',
        has_person: null,
        has_animal: null,
      },
      error: null,
    }));

    const upsertMock = jest.fn((_row: any) => ({
      select: jest.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = require('../supabaseDreamService');

    const dream = await createDreamInSupabase(
      {
        id: 1,
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: 'data:image/png;base64,dGVzdA==',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      } as any,
      'user-1',
    );

    expect(mocks.storageUpload).toHaveBeenCalled();
    expect(
      mocks.storageUpload.mock.calls.some((call) => String(call[0]).includes('-thumb'))
    ).toBe(true);

    const firstRow = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    expect(String(firstRow.image_url)).toContain('https://cdn.example.com/');

    expect(dream.imageUrl).toContain('https://cdn.example.com/');
    expect(dream.thumbnailUrl).toContain('https://cdn.example.com/');
  });

  it('updateDreamInSupabase throws NOT_FOUND when no rows are returned', async () => {
    const singleMock = jest.fn().mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });

    const updateMock = jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: singleMock,
        })),
      })),
    }));

    mocks.from.mockReturnValue({
      update: updateMock,
    });

    const { updateDreamInSupabase } = require('../supabaseDreamService');

    await expect(
      updateDreamInSupabase({
        id: 1,
        remoteId: 123,
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: '',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
      } as any),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('deleteDreamFromSupabase throws on error', async () => {
    const deleteMock = jest.fn(() => ({
      eq: jest.fn(() => ({
        error: { message: 'delete failed' },
      })),
    }));

    mocks.from.mockReturnValue({
      delete: deleteMock,
    });

    const { deleteDreamFromSupabase } = require('../supabaseDreamService');

    await expect(deleteDreamFromSupabase(99)).rejects.toThrow('delete failed');
  });

  it('does not remove old thumbnail outside the current user namespace', async () => {
    mocks.storageUpload.mockImplementation(async (path: string) => ({
      data: { path },
      error: null,
    }));

    const singleMock = jest.fn(async () => ({
      data: {
        id: 12,
        created_at: '2020-01-01T00:00:00.000Z',
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareable_quote: '',
        image_url: 'https://cdn.example.com/user-1/new.webp',
        chat_history: [],
        theme: null,
        dream_type: 'Symbolic Dream',
        is_favorite: false,
        image_generation_failed: false,
        is_analyzed: true,
        analyzed_at: null,
        analysis_status: 'done',
        analysis_request_id: null,
        exploration_started_at: null,
        client_request_id: 'req-2',
        has_person: null,
        has_animal: null,
      },
      error: null,
    }));

    const upsertMock = jest.fn((_row: any) => ({
      select: jest.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = require('../supabaseDreamService');

    await createDreamInSupabase(
      {
        id: 2,
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: 'data:image/png;base64,dGVzdA==',
        thumbnailUrl:
          'https://example.com/storage/v1/object/public/dream-images/other/old.webp',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      } as any,
      'user-1',
    );

    expect(mocks.storageRemove).not.toHaveBeenCalled();
  });

  it('marks generation failure when upload fails', async () => {
    mocks.storageUpload.mockResolvedValueOnce({
      data: null,
      error: { message: 'upload failed' },
    });

    const singleMock = jest.fn(async () => ({
      data: {
        id: 13,
        created_at: '2020-01-01T00:00:00.000Z',
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
        client_request_id: 'req-3',
        has_person: null,
        has_animal: null,
      },
      error: null,
    }));

    const upsertMock = jest.fn((_row: any) => ({
      select: jest.fn(() => ({
        single: singleMock,
      })),
    }));

    mocks.from.mockReturnValue({
      upsert: upsertMock,
    });

    const { createDreamInSupabase } = require('../supabaseDreamService');

    const dream = await createDreamInSupabase(
      {
        id: 3,
        transcript: 't',
        title: 'x',
        interpretation: '',
        shareableQuote: '',
        imageUrl: 'data:image/png;base64,dGVzdA==',
        dreamType: 'Symbolic Dream',
        chatHistory: [],
        isFavorite: false,
      } as any,
      'user-1',
    );

    expect(dream.imageGenerationFailed).toBe(true);
  });
});
