import type { SupabaseClient } from '@supabase/supabase-js';
import type { DreamAnalysis } from '@/lib/types';
import { createJournalMediaUploadService } from '../journalMediaUploadService';

const ref = (path: string) => `supabase-storage://dream-images/${path}`;
const dream = (overrides: Partial<DreamAnalysis> = {}): DreamAnalysis => ({
  id: 1, remoteId: 42, title: 'Dream', transcript: 'Text', interpretation: '',
  shareableQuote: '', imageUrl: '', dreamType: 'Symbolic Dream', chatHistory: [],
  isFavorite: false, ...overrides,
});

function fixture() {
  const upload = jest.fn(async (path: string, _bytes: Uint8Array, _options: unknown) => ({ data: { path }, error: null as null | { message: string } }));
  const remove = jest.fn(async (_paths: string[]) => ({}));
  const getUser = jest.fn(async () => ({ data: { user: { id: 'owner' } } }));
  const client = { storage: { from: jest.fn(() => ({ upload, remove })) }, auth: { getUser } } as unknown as SupabaseClient;
  const dependencies = {
    getClient: jest.fn(() => client), isConfigured: jest.fn(() => true),
    invalidateDreamMedia: jest.fn(),
    readImageFileBase64: jest.fn(async (_uri: string) => 'dGVzdA=='),
    convertToWebpBase64: jest.fn(async (_params: unknown, _options: unknown) => ({ base64: 'dGVzdA==', contentType: 'image/webp' })),
  };
  return { ...dependencies, upload, remove, getUser, service: createJournalMediaUploadService(dependencies) };
}

describe('journal media upload boundary', () => {
  it('uploads full inline image and thumbnail with the existing paths, bytes and options', async () => {
    const f = fixture();
    const result = await f.service.ensureRemoteImage(dream({ imageUrl: 'data:image/png;base64,dGVzdA==' }), 'owner');
    expect(result.imageUrl).toBe(ref('owner/dream-42.webp'));
    expect(result.thumbnailUrl).toBe(ref('owner/dream-42-thumb.webp'));
    expect(f.upload.mock.calls.map(([path, bytes, options]) => [path, [...bytes], options])).toEqual([
      ['owner/dream-42.webp', [116, 101, 115, 116], { contentType: 'image/webp', upsert: true }],
      ['owner/dream-42-thumb.webp', [116, 101, 115, 116], { contentType: 'image/webp', upsert: true }],
    ]);
    expect(f.convertToWebpBase64.mock.calls.map(([, options]) => options)).toEqual([{ maxDimension: 1600 }, { squareSize: 320, compress: 0.7 }]);
    expect(f.getUser).not.toHaveBeenCalled();
    expect(f.invalidateDreamMedia).toHaveBeenCalledTimes(2);
  });

  it('reads a file thumbnail and uses it as the image when none was stored', async () => {
    const f = fixture();
    const result = await f.service.ensureRemoteImage(dream({ thumbnailUrl: 'file:///cache/thumb.png' }));
    expect(f.readImageFileBase64).toHaveBeenCalledWith('file:///cache/thumb.png');
    expect(f.convertToWebpBase64).toHaveBeenCalledWith({ base64: 'dGVzdA==', uri: 'file:///cache/thumb.png', contentType: 'image/png' }, { squareSize: 320, compress: 0.7 });
    expect(result.imageUrl).toBe(ref('owner/dream-42-thumb.webp'));
    expect(result.thumbnailUrl).toBe(result.imageUrl);
  });

  it('leaves stored references and unconfigured dreams intact without uploads', async () => {
    const f = fixture();
    const original = dream({ imageUrl: ref('owner/full.webp'), thumbnailUrl: ref('owner/thumb.webp') });
    expect(await f.service.ensureRemoteImage(original)).toEqual(original);
    f.isConfigured.mockReturnValue(false);
    expect(await f.service.ensureRemoteImage(original)).toBe(original);
    expect(f.upload).not.toHaveBeenCalled();
    expect(f.convertToWebpBase64).not.toHaveBeenCalled();
  });

  it('preserves the existing failure result if the thumbnail upload fails', async () => {
    const f = fixture();
    f.upload.mockResolvedValueOnce({ data: { path: 'owner/full.webp' }, error: null });
    f.upload.mockResolvedValueOnce({ data: { path: '' }, error: { message: 'offline' } });
    const original = dream({ imageUrl: 'data:image/png;base64,dGVzdA==', imageGenerationFailed: false });
    expect(await f.service.ensureRemoteImage(original, 'owner')).toEqual({ ...original, imageUrl: '', thumbnailUrl: undefined, imageGenerationFailed: false });
    expect(f.remove).not.toHaveBeenCalled();
  });

  it.each(['owner', 'foreign'])('only removes an old thumbnail owned by the current account (%s)', async (oldOwner) => {
    const f = fixture();
    const oldRef = ref(`${oldOwner}/old-thumb.webp`);
    await f.service.ensureRemoteImage(dream({ imageUrl: 'data:image/png;base64,dGVzdA==', thumbnailUrl: oldRef }), 'owner');
    if (oldOwner === 'owner') {
      expect(f.remove).toHaveBeenCalledWith(['owner/old-thumb.webp']);
      expect(f.invalidateDreamMedia).toHaveBeenCalledWith(oldRef);
    } else {
      expect(f.remove).not.toHaveBeenCalled();
    }
  });
});
