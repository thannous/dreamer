import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { attachPreparedIllustration, cropBand, paintPreparedIllustration, takePreparedIllustration } from './previewIllustration.ts';

type Row = Record<string, unknown>;

function fakeStorage(options: { failBand?: boolean } = {}) {
  const objects = new Map<string, Uint8Array>();
  const calls: string[] = [];
  return {
    objects,
    calls,
    from: (bucket: string) => ({
      upload: async (path: string, bytes: Uint8Array) => {
        calls.push(`upload:${bucket}:${path}`);
        if (options.failBand && path.endsWith('-band.jpg')) return { error: { message: 'full' } };
        objects.set(path, bytes);
        return { error: null };
      },
      createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://example.test/sign/${path}?token=t` }, error: null }),
      remove: async (paths: string[]) => {
        calls.push(`remove:${paths.join(',')}`);
        paths.forEach((path) => objects.delete(path));
        return { error: null };
      },
      move: async (from: string, to: string) => {
        calls.push(`move:${from}->${to}`);
        const bytes = objects.get(from);
        if (!bytes) return { error: { message: 'missing' } };
        objects.delete(from);
        objects.set(to, bytes);
        return { error: null };
      },
    }),
  };
}

function previewsTable(rows: Row[]) {
  return () => {
    const filters: [string, unknown][] = [];
    let values: Row | null = null;
    const matched = () => rows.filter((row) => filters.every(([column, value]) =>
      value === undefined ? !row[column] : row[column] === value));
    const builder = {
      select: () => builder,
      update: (next: Row) => { values = next; return builder; },
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
      // Only the dream's "no illustration yet" condition is used.
      or: (condition: string) => {
        assertEquals(condition, 'image_url.is.null,image_url.eq.');
        filters.push(['image_url', undefined]);
        return builder;
      },
      maybeSingle: async () => ({ data: matched()[0] ?? null, error: null }),
      then: (resolve: (value: unknown) => unknown) => {
        const found = matched();
        if (values) found.forEach((row) => Object.assign(row, values));
        return Promise.resolve({ data: found.map((row) => ({ ...row })), error: null }).then(resolve);
      },
    };
    return builder;
  };
}

const painting = async () => {
  // Three stripes: the band is the middle one.
  const image = new Image(90, 160);
  image.fill((_x, y) => (y <= 53 ? 0xff0000ff : y <= 107 ? 0x00ff00ff : 0x0000ffff));
  return encodeBase64(await image.encode());
};

Deno.test('the band is the middle third of the painting, nothing above or below', async () => {
  const band = await Image.decode(await cropBand(decodeBase64(await painting())));
  assertEquals([band.width, band.height], [90, 53]);
  const [red, green] = Image.colorToRGBA(band.getPixelAt(45, 27));
  assert(green > 200 && red < 60);
});

Deno.test('a prepared painting is stored out of the account’s prefix, and only its band is linked', async () => {
  const storage = fakeStorage();
  const prompts: string[] = [];
  const painted = await paintPreparedIllustration({
    admin: { from: () => null, storage },
    bucket: 'dream-images', apiKey: 'key', userId: 'u1', dreamId: 7, prompt: 'A river of glass',
    generate: (async (options: { prompt: string }) => {
      prompts.push(options.prompt);
      return { imageBase64: await painting(), mimeType: 'image/png', raw: {} };
    }) as never,
  });
  assertEquals(prompts, ['A river of glass']);
  assert(painted.imagePath.startsWith('previews/u1/7-'));
  assertEquals(painted.bandPath, painted.imagePath.replace(/\.[a-z]+$/, '-band.jpg'));
  assertEquals(painted.bandUrl, `https://example.test/sign/${painted.bandPath}?token=t`);
  assertEquals([...storage.objects.keys()].sort(), [painted.bandPath, painted.imagePath].sort());

  // A band that cannot be stored takes the painting with it.
  const failing = fakeStorage({ failBand: true });
  let failed = false;
  try {
    await paintPreparedIllustration({
      admin: { from: () => null, storage: failing }, bucket: 'dream-images', apiKey: 'key', userId: 'u1', dreamId: 7, prompt: 'p',
      generate: (async () => ({ imageBase64: await painting(), mimeType: 'image/png', raw: {} })) as never,
    });
  } catch {
    failed = true;
  }
  assert(failed);
  assertEquals(failing.objects.size, 0);
});

Deno.test('the image job takes the painting of the same prompt once, into the account’s prefix', async () => {
  const storage = fakeStorage();
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  storage.objects.set('previews/u1/7-a-band.jpg', new Uint8Array([2]));
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
  }];
  const admin = { from: previewsTable(rows), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };

  assertEquals(await takePreparedIllustration(admin, { ...input, prompt: 'Another prompt' }), null);
  assertEquals(await takePreparedIllustration(admin, input), 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals([...storage.objects.keys()], ['u1/7-a.jpg']);
  assertEquals([rows[0].image_status, rows[0].image_path, rows[0].band_path, rows[0].band_url], ['used', null, null, null]);
  // Taken: a second job paints its own.
  assertEquals(await takePreparedIllustration(admin, input), null);
});

Deno.test('a job asked with the dream’s text only takes the painting of that same text', async () => {
  const storage = fakeStorage();
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass', transcript_sha256: 'sha-1',
    image_path: 'previews/u1/7-a.jpg', band_path: null, band_url: null,
  }];
  const admin = { from: previewsTable(rows), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7 };

  assertEquals(await takePreparedIllustration(admin, input), null);
  assertEquals(await takePreparedIllustration(admin, { ...input, transcriptSha256: 'sha-edited' }), null);
  assertEquals(await takePreparedIllustration(admin, { ...input, transcriptSha256: 'sha-1' }), 'https://example.test/sign/u1/7-a.jpg?token=t');
});

Deno.test('a painting under way is waited for, not paid for twice', async () => {
  const storage = fakeStorage();
  const start = Date.parse('2026-10-22T07:00:00Z');
  let clock = start;
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'painting', image_prompt: 'A river of glass',
    image_path: null, band_path: null, band_url: null, image_updated_at: new Date(start - 20_000).toISOString(),
  }];
  const admin = { from: previewsTable(rows), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', now: () => clock };
  // The preview's painter stores it a few seconds later.
  const sleep = async (ms: number) => {
    clock += ms;
    if (clock - start >= 9000) {
      storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
      Object.assign(rows[0], { image_status: 'ready', image_path: 'previews/u1/7-a.jpg' });
    }
  };
  assertEquals(await takePreparedIllustration(admin, { ...input, sleep }), 'https://example.test/sign/u1/7-a.jpg?token=t');

  // A painting that never ends is waited for a bounded time only.
  Object.assign(rows[0], { image_status: 'painting', image_path: null, image_updated_at: new Date(clock).toISOString() });
  const waitedFrom = clock;
  assertEquals(await takePreparedIllustration(admin, { ...input, sleep: async (ms: number) => { clock += ms; } }), null);
  assert(clock - waitedFrom <= 93_000);
  // A painting under way for longer than its three minutes has failed: nothing to wait for.
  const before = clock;
  clock += 4 * 60_000;
  const slept: number[] = [];
  assertEquals(await takePreparedIllustration(admin, { ...input, sleep: async (ms: number) => { slept.push(ms); } }), null);
  assertEquals(slept, []);
  assert(clock > before);
});

Deno.test('an analysis opened with no illustration asked takes the painting already paid for, never over one', async () => {
  const setup = (imageUrl: string | null) => {
    const storage = fakeStorage();
    storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
    const previews: Row[] = [{
      user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
      image_path: 'previews/u1/7-a.jpg', band_path: null, band_url: null,
    }];
    const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: imageUrl, image_generation_failed: null }];
    const admin = { from: (name: string) => (name === 'dreams' ? previewsTable(dreams) : previewsTable(previews))(), storage };
    return { admin, storage, previews, dreams };
  };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };

  const fresh = setup(null);
  assertEquals(await attachPreparedIllustration(fresh.admin, input), true);
  assertEquals(fresh.dreams[0].image_url, 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals(fresh.dreams[0].image_generation_failed, false);
  assertEquals(fresh.previews[0].image_status, 'used');

  // An illustration already there stays, and the prepared painting is left for nothing else.
  const illustrated = setup('https://example.test/own.jpg');
  assertEquals(await attachPreparedIllustration(illustrated.admin, input), false);
  assertEquals(illustrated.dreams[0].image_url, 'https://example.test/own.jpg');
  assertEquals(illustrated.previews[0].image_status, 'ready');

  // Another reading (an edited dream) has another prompt: nothing is taken, nothing is painted.
  const edited = setup(null);
  assertEquals(await attachPreparedIllustration(edited.admin, { ...input, prompt: 'Another prompt' }), false);
  assertEquals(edited.dreams[0].image_url, null);
  assertEquals([...edited.storage.objects.keys()], ['previews/u1/7-a.jpg']);
});
