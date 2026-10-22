import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { decodeBase64, encodeBase64 } from 'https://deno.land/std@0.224.0/encoding/base64.ts';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';
import { cropBand, paintPreparedIllustration, takePreparedIllustration } from './previewIllustration.ts';

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
    const matched = () => rows.filter((row) => filters.every(([column, value]) => row[column] === value));
    const builder = {
      select: () => builder,
      update: (next: Row) => { values = next; return builder; },
      eq: (column: string, value: unknown) => { filters.push([column, value]); return builder; },
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
