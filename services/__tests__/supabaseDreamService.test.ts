import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mocks = ((factory: any) => factory())(() => {
  const storageUpload = jest.fn();
  const storageRemove = jest.fn().mockResolvedValue({});
  const storageGetPublicUrl = jest.fn((path: string) => ({
    data: { publicUrl: `https://cdn.example.com/${path}` },
  }));
  const storageCreateSignedUrl = jest.fn(async (path: string) => ({
    data: { signedUrl: `https://signed.example.com/${path}?token=owner` },
    error: null,
  }));

  return {
    from: jest.fn(),
    rpc: undefined as undefined | jest.Mock,
    storageUpload,
    storageRemove,
    storageGetPublicUrl,
    storageCreateSignedUrl,
    storageFrom: jest.fn(() => ({
      upload: storageUpload,
      remove: storageRemove,
      getPublicUrl: storageGetPublicUrl,
      createSignedUrl: storageCreateSignedUrl,
    })),
    authGetUser: jest.fn(async () => ({ data: { user: { id: 'user-1' } } })),
  };
});

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: mocks.from,
    rpc: mocks.rpc,
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
  const buildDream = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    clientRequestId: 'dream-req-1',
    transcript: 't',
    title: 'x',
    interpretation: '',
    shareableQuote: '',
    imageUrl: '',
    dreamType: 'Symbolic Dream',
    chatHistory: [],
    isFavorite: false,
    ...overrides,
  });

  const buildRow = (overrides: Record<string, unknown> = {}) => ({
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
    image_generation_failed: false,
    is_analyzed: false,
    analyzed_at: null,
    analysis_status: 'none',
    analysis_request_id: null,
    exploration_started_at: null,
    client_request_id: 'dream-req-1',
    has_person: null,
    has_animal: null,
    memory: {},
    ...overrides,
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mocks.rpc = undefined;
    mocks.storageCreateSignedUrl.mockImplementation(async (path: string) => ({
      data: { signedUrl: `https://signed.example.com/${path}?token=owner` },
      error: null,
    }));
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

  it('createDreamInSupabase retries without client_updated_at on schema cache errors', async () => {
    const singleMock = jest.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'client_updated_at' column of 'dreams' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: buildRow({
          client_updated_at: null,
          is_analyzed: true,
          analysis_status: 'done',
        }),
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
        ...buildDream({
          clientUpdatedAt: 1_700_000_000_000,
          isAnalyzed: true,
          analysisStatus: 'done',
        }),
      } as any,
      'user-1',
    );

    expect(upsertMock).toHaveBeenCalledTimes(2);

    const firstRow = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const secondRow = (((upsertMock as any).mock.calls[1]?.[0] ?? {}) as unknown) as Record<string, unknown>;

    expect(firstRow).toHaveProperty('client_updated_at');
    expect(firstRow).toHaveProperty('image_generation_failed');
    expect(secondRow).not.toHaveProperty('client_updated_at');
    expect(secondRow).toHaveProperty('image_generation_failed');
    expect(dream.remoteId).toBe(42);
    expect(dream.analysisStatus).toBe('done');
  });

  it('createDreamInSupabase persists remembered dream memory metadata', async () => {
    const memory = {
      version: 1,
      origin: 'remembered',
      anchorDream: true,
      dejaVu: true,
      rememberedKind: 'old',
      approximatePeriod: 'childhood',
      strongestFragment: 'place',
      createdFrom: 'profile',
    };
    const singleMock = jest.fn().mockResolvedValueOnce({
      data: buildRow({ memory }),
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
      buildDream({ memory }) as any,
      'user-1',
    );

    const row = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    expect(row.memory).toEqual(memory);
    expect(dream.memory).toEqual(memory);
  });

  it('createDreamInSupabase preserves remembered memory when retrying without the memory column', async () => {
    const memory = {
      version: 1,
      origin: 'remembered',
      anchorDream: true,
      dejaVu: true,
      rememberedKind: 'recurring',
      approximatePeriod: 'childhood',
      strongestFragment: 'place',
      createdFrom: 'onboarding',
      createdFromOnboarding: true,
    };
    const expectedMemory = {
      ...memory,
      recurring: true,
    };
    const singleMock = jest.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'memory' column of 'dreams' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: buildRow({ memory: undefined }),
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
      buildDream({ memory }) as any,
      'user-1',
    );

    const firstRow = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const secondRow = (((upsertMock as any).mock.calls[1]?.[0] ?? {}) as unknown) as Record<string, unknown>;

    expect(firstRow.memory).toEqual(expectedMemory);
    expect(secondRow).not.toHaveProperty('memory');
    expect(dream.memory).toEqual(expectedMemory);
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

  it('syncDreamMutationsInSupabase splits dependent create and update mutations', async () => {
    mocks.rpc = jest
      .fn()
      .mockResolvedValueOnce({
        data: [
          {
            mutation_id: 'mut-create',
            client_request_id: 'mutation-create',
            operation: 'create',
            status: 'ack',
            remote_id: 42,
            dream: buildRow(),
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [
          {
            mutation_id: 'mut-update',
            client_request_id: 'mutation-update',
            operation: 'update',
            status: 'ack',
            remote_id: 42,
            dream: buildRow({ title: 'updated title' }),
          },
        ],
        error: null,
      });

    const { syncDreamMutationsInSupabase } = require('../supabaseDreamService');

    const createMutation = {
      version: 1,
      id: 'mut-create',
      userScope: 'user:user-1',
      entityType: 'dream',
      entityKey: 'client:dream-req-1',
      operation: 'create',
      clientRequestId: 'mutation-create',
      clientUpdatedAt: 1,
      payload: {
        dream: buildDream(),
      },
      status: 'pending',
      retryCount: 0,
      createdAt: 1,
    };

    const updateMutation = {
      version: 1,
      id: 'mut-update',
      userScope: 'user:user-1',
      entityType: 'dream',
      entityKey: 'client:dream-req-1',
      operation: 'update',
      clientRequestId: 'mutation-update',
      clientUpdatedAt: 2,
      payload: {
        dream: buildDream({ title: 'updated title' }),
      },
      status: 'pending',
      retryCount: 0,
      createdAt: 2,
    };

    const results = await syncDreamMutationsInSupabase(
      [createMutation, updateMutation],
      'user-1',
    );

    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(mocks.rpc?.mock.calls[0]?.[1]?.mutations).toHaveLength(1);
    expect(mocks.rpc?.mock.calls[1]?.[1]?.mutations).toHaveLength(1);
    expect(mocks.rpc?.mock.calls[1]?.[1]?.mutations[0]?.payload?.remote_id).toBe(42);
    expect(results).toEqual([
      expect.objectContaining({ mutationId: 'mut-create', status: 'ack', remoteId: 42 }),
      expect.objectContaining({ mutationId: 'mut-update', status: 'ack', remoteId: 42 }),
    ]);
  });

  it('syncDreamMutationsInSupabase falls back to direct writes when the RPC is missing', async () => {
    mocks.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST202',
        message: 'Could not find the function public.sync_dream_mutations(mutations) in the schema cache',
      },
    });

    const singleMock = jest.fn().mockResolvedValueOnce({
      data: buildRow(),
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

    const { syncDreamMutationsInSupabase } = require('../supabaseDreamService');

    const [result] = await syncDreamMutationsInSupabase(
      [
        {
          version: 1,
          id: 'mut-create',
          userScope: 'user:user-1',
          entityType: 'dream',
          entityKey: 'client:dream-req-1',
          operation: 'create',
          clientRequestId: 'mutation-create',
          clientUpdatedAt: 1,
          payload: {
            dream: buildDream(),
          },
          status: 'pending',
          retryCount: 0,
          createdAt: 1,
        },
      ],
      'user-1',
    );

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(expect.objectContaining({ status: 'ack', remoteId: 42 }));
  });

  it('syncDreamMutationsInSupabase falls back to direct writes when the RPC schema is missing client_updated_at', async () => {
    mocks.rpc = jest.fn().mockResolvedValue({
      data: null,
      error: {
        code: '42703',
        message: 'column "client_updated_at" of relation "dreams" does not exist',
      },
    });

    const singleMock = jest.fn().mockResolvedValueOnce({
      data: buildRow({ client_updated_at: null }),
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

    const { syncDreamMutationsInSupabase } = require('../supabaseDreamService');

    const [result] = await syncDreamMutationsInSupabase(
      [
        {
          version: 1,
          id: 'mut-create',
          userScope: 'user:user-1',
          entityType: 'dream',
          entityKey: 'client:dream-req-1',
          operation: 'create',
          clientRequestId: 'mutation-create',
          clientUpdatedAt: 1,
          payload: {
            dream: buildDream({ clientUpdatedAt: 1 }),
          },
          status: 'pending',
          retryCount: 0,
          createdAt: 1,
        },
      ],
      'user-1',
    );

    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(upsertMock).toHaveBeenCalledTimes(1);
    const directRow = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    expect(directRow).not.toHaveProperty('client_updated_at');
    expect(result).toEqual(expect.objectContaining({ status: 'ack', remoteId: 42 }));
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
          memory: {
            origin: 'remembered',
            anchorDream: true,
            rememberedKind: 'recurring',
          },
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
    expect(dreams[0]?.memory).toEqual({
      version: 1,
      origin: 'remembered',
      anchorDream: true,
      recurring: true,
      rememberedKind: 'recurring',
    });
  });

  it('fetchDreamsFromSupabase resolves dream-images references to signed URLs', async () => {
    const orderMock = jest.fn().mockResolvedValue({
      data: [
        buildRow({
          id: 10,
          image_url: 'supabase-storage://dream-images/user-1/private.webp',
        }),
        buildRow({
          id: 11,
          image_url: 'https://example.com/storage/v1/object/public/dream-images/user-1/legacy.webp',
        }),
      ],
      error: null,
    });

    mocks.from.mockReturnValue({
      select: jest.fn(() => ({ order: orderMock })),
    });

    const { fetchDreamsFromSupabase } = require('../supabaseDreamService');
    const dreams = await fetchDreamsFromSupabase();

    expect(dreams[0]?.imageUrl).toBe('https://signed.example.com/user-1/private.webp?token=owner');
    expect(dreams[1]?.imageUrl).toBe('https://signed.example.com/user-1/legacy.webp?token=owner');
    expect(mocks.storageCreateSignedUrl).toHaveBeenCalledWith('user-1/private.webp', 86400);
    expect(mocks.storageCreateSignedUrl).toHaveBeenCalledWith('user-1/legacy.webp', 86400);
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
        image_url: 'supabase-storage://dream-images/user-1/dream.webp',
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
      mocks.storageUpload.mock.calls.some((call: unknown[]) => String(call[0]).includes('-thumb'))
    ).toBe(true);

    const firstRow = (((upsertMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    expect(String(firstRow.image_url)).toContain('supabase-storage://dream-images/user-1/dream-');
    expect(String(firstRow.image_url)).not.toContain('/storage/v1/object/public/');

    expect(mocks.storageGetPublicUrl).not.toHaveBeenCalled();
    expect(mocks.storageCreateSignedUrl).toHaveBeenCalledWith('user-1/dream.webp', 86400);
    expect(dream.imageUrl).toBe('https://signed.example.com/user-1/dream.webp?token=owner');
    expect(dream.thumbnailUrl).toBe('https://signed.example.com/user-1/dream.webp?token=owner');
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

  it('updateDreamInSupabase retries without client_updated_at on schema cache errors', async () => {
    const singleMock = jest.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'client_updated_at' column of 'dreams' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: buildRow({
          id: 123,
          title: 'Analyzed dream',
          client_updated_at: null,
          is_analyzed: true,
          analysis_status: 'done',
        }),
        error: null,
      });

    const updateMock = jest.fn((_row: any) => ({
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

    const dream = await updateDreamInSupabase({
      ...buildDream({
        remoteId: 123,
        title: 'Analyzed dream',
        clientUpdatedAt: 1_700_000_000_000,
        isAnalyzed: true,
        analysisStatus: 'done',
      }),
    } as any);

    expect(updateMock).toHaveBeenCalledTimes(2);

    const firstRow = (((updateMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const secondRow = (((updateMock as any).mock.calls[1]?.[0] ?? {}) as unknown) as Record<string, unknown>;

    expect(firstRow).toHaveProperty('client_updated_at');
    expect(secondRow).not.toHaveProperty('client_updated_at');
    expect(dream.remoteId).toBe(123);
    expect(dream.isAnalyzed).toBe(true);
  });

  it('updateDreamInSupabase preserves remembered memory when retrying without the memory column', async () => {
    const memory = {
      version: 1,
      origin: 'remembered',
      anchorDream: true,
      dejaVu: true,
      rememberedKind: 'nightmare',
      approximatePeriod: 'years_ago',
      strongestFragment: 'fear',
      createdFrom: 'profile',
    };
    const singleMock = jest.fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: 'PGRST204',
          message: "Could not find the 'memory' column of 'dreams' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: buildRow({
          id: 123,
          title: 'Updated remembered dream',
          memory: undefined,
        }),
        error: null,
      });

    const updateMock = jest.fn((_row: any) => ({
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

    const dream = await updateDreamInSupabase({
      ...buildDream({
        remoteId: 123,
        title: 'Updated remembered dream',
        memory,
      }),
    } as any);

    const firstRow = (((updateMock as any).mock.calls[0]?.[0] ?? {}) as unknown) as Record<string, unknown>;
    const secondRow = (((updateMock as any).mock.calls[1]?.[0] ?? {}) as unknown) as Record<string, unknown>;

    expect(firstRow.memory).toEqual(memory);
    expect(secondRow).not.toHaveProperty('memory');
    expect(dream.memory).toEqual(memory);
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
