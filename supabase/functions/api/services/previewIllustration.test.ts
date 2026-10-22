import { assert, assertEquals, assertRejects } from 'https://deno.land/std@0.224.0/assert/mod.ts';
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

/** A take whose job stores the painting: settled, as the image job does once the dream holds it. */
const take = async (...args: Parameters<typeof takePreparedIllustration>) => {
  const painting = await takePreparedIllustration(...args);
  if (!painting) return null;
  await painting.settle();
  return painting.url;
};
const attached = async (...args: Parameters<typeof attachPreparedIllustration>) => (await attachPreparedIllustration(...args)) !== null;

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

  assertEquals(await take(admin, { ...input, prompt: 'Another prompt' }), null);
  assertEquals(await take(admin, input), 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals([...storage.objects.keys()], ['u1/7-a.jpg']);
  assertEquals([rows[0].image_status, rows[0].image_path, rows[0].band_path, rows[0].band_url], ['used', null, null, null]);
  // Taken: a second job paints its own.
  assertEquals(await take(admin, input), null);
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

  assertEquals(await take(admin, input), null);
  assertEquals(await take(admin, { ...input, transcriptSha256: 'sha-edited' }), null);
  assertEquals(await take(admin, { ...input, transcriptSha256: 'sha-1' }), 'https://example.test/sign/u1/7-a.jpg?token=t');
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
  assertEquals(await take(admin, { ...input, sleep }), 'https://example.test/sign/u1/7-a.jpg?token=t');

  // A painting that never ends is waited for a bounded time only.
  Object.assign(rows[0], { image_status: 'painting', image_path: null, image_updated_at: new Date(clock).toISOString() });
  const waitedFrom = clock;
  assertEquals(await take(admin, { ...input, sleep: async (ms: number) => { clock += ms; } }), null);
  assert(clock - waitedFrom <= 93_000);
  // A job with attempts left tries again later rather than pay while the painting is still live.
  const live = await assertRejects(() => takePreparedIllustration(admin, { ...input, retryWhileLive: true, sleep: async (ms: number) => { clock += ms; } }));
  assertEquals((live as { isTransient?: unknown }).isTransient, true);
  assertEquals(rows[0].image_status, 'painting');
  // A painting under way for longer than its three minutes has failed: nothing to wait for.
  const before = clock;
  clock += 4 * 60_000;
  const slept: number[] = [];
  assertEquals(await take(admin, { ...input, sleep: async (ms: number) => { slept.push(ms); } }), null);
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
    const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: imageUrl, image_generation_failed: null, analysis_request_id: 'r1', analysis_status: 'pending' }];
    const admin = { from: (name: string) => (name === 'dreams' ? previewsTable(dreams) : previewsTable(previews))(), storage };
    return { admin, storage, previews, dreams };
  };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', analysisRequestId: 'r1' };

  const fresh = setup(null);
  assertEquals(await attached(fresh.admin, input), true);
  assertEquals(fresh.dreams[0].image_url, 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals(fresh.dreams[0].image_generation_failed, false);
  assertEquals(fresh.previews[0].image_status, 'used');

  // An illustration already there stays, and the prepared painting is left for nothing else.
  const illustrated = setup('https://example.test/own.jpg');
  assertEquals(await attached(illustrated.admin, input), false);
  assertEquals(illustrated.dreams[0].image_url, 'https://example.test/own.jpg');
  assertEquals(illustrated.previews[0].image_status, 'ready');

  // Another reading (an edited dream) has another prompt: nothing is taken, nothing is painted.
  const edited = setup(null);
  assertEquals(await attached(edited.admin, { ...input, prompt: 'Another prompt' }), false);
  assertEquals(edited.dreams[0].image_url, null);
  assertEquals([...edited.storage.objects.keys()], ['previews/u1/7-a.jpg']);
});

Deno.test('a dream illustrated between the read and the link keeps its own illustration, and the taken painting goes', async () => {
  const storage = fakeStorage();
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  const previews: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: null, band_url: null,
  }];
  const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: 'https://example.test/own.jpg', analysis_request_id: 'r1', analysis_status: 'pending' }];
  let dreamReads = 0;
  // The first read still sees no illustration: the image job saved its own right after.
  const stale = { select: () => stale, eq: () => stale, maybeSingle: async () => ({ data: { image_url: null }, error: null }) };
  const admin = {
    from: (name: string) => (name !== 'dreams' ? previewsTable(previews)() : dreamReads++ === 0 ? stale : previewsTable(dreams)()),
    storage,
  };
  assertEquals(await attached(admin, { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', analysisRequestId: 'r1' }), false);
  assertEquals(dreams[0].image_url, 'https://example.test/own.jpg');
  assertEquals([...storage.objects.keys()], []);

  // A dream that cannot be read again may hold the painting through another job: the object stays.
  const kept = fakeStorage();
  kept.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  const keptPreviews: Row[] = [{ ...previews[0], image_status: 'ready', image_path: 'previews/u1/7-a.jpg' }];
  const unreadable = { select: () => unreadable, eq: () => unreadable, maybeSingle: async () => ({ data: null, error: { message: 'down' } }) };
  let keptReads = 0;
  const keptAdmin = {
    from: (name: string) => {
      if (name !== 'dreams') return previewsTable(keptPreviews)();
      const read = keptReads++;
      return read === 0 ? stale : read === 1 ? previewsTable(dreams)() : unreadable;
    },
    storage: kept,
  };
  assertEquals(await attached(keptAdmin, { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', analysisRequestId: 'r1' }), false);
  assertEquals([...kept.objects.keys()], ['u1/7-a.jpg']);
});

Deno.test('with no wait, a painting under way is left for later', async () => {
  const storage = fakeStorage();
  const previews: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'painting', image_prompt: 'A river of glass',
    image_path: null, band_path: null, band_url: null, image_updated_at: new Date().toISOString(),
  }];
  const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: null, analysis_request_id: 'r1', analysis_status: 'pending' }];
  const admin = { from: (name: string) => (name === 'dreams' ? previewsTable(dreams) : previewsTable(previews))(), storage };
  const slept: number[] = [];
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', analysisRequestId: 'r1', sleep: async (ms: number) => { slept.push(ms); } };
  assertEquals(await attached(admin, { ...input, waitMs: 0 }), false);
  assertEquals(slept, []);
  assertEquals(previews[0].image_status, 'painting');
});

Deno.test('a painting that cannot be moved stays ready for the next job instead of being paid again', async () => {
  const storage = fakeStorage();
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
  }];
  const admin = { from: previewsTable(rows), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };
  // The object is missing for now (the fake move fails): nothing is spent.
  assertEquals(await take(admin, input), null);
  assertEquals([rows[0].image_status, rows[0].image_path], ['ready', 'previews/u1/7-a.jpg']);
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  assertEquals(await take(admin, input), 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals([rows[0].image_status, rows[0].image_path], ['used', null]);
});

Deno.test('a painting moved but not linked is linked by the next job from where it lies', async () => {
  const storage = fakeStorage();
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  let failSign = true;
  const signing = storage.from;
  const flaky = {
    ...storage,
    from: (bucket: string) => ({
      ...signing(bucket),
      createSignedUrl: async (path: string) => (failSign
        ? { data: null, error: { message: 'down' } }
        : { data: { signedUrl: `https://example.test/sign/${path}?token=t` }, error: null }),
    }),
  };
  storage.objects.set('previews/u1/7-a-band.jpg', new Uint8Array([2]));
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
  }];
  const admin = { from: previewsTable(rows), storage: flaky };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };
  assertEquals(await take(admin, input), null);
  // Ready again with its band, as analysis_previews_painted_has_image requires.
  assertEquals([rows[0].image_status, rows[0].image_path, rows[0].band_path], ['ready', 'u1/7-a.jpg', 'previews/u1/7-a-band.jpg']);
  assert(rows[0].band_url);
  failSign = false;
  assertEquals(await take(admin, input), 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals([...storage.objects.keys()], ['u1/7-a.jpg']);
  assertEquals([rows[0].image_status, rows[0].image_path, rows[0].band_path, rows[0].band_url], ['used', null, null, null]);
});

Deno.test('a job that cannot store the taken painting gives it back to the next one', async () => {
  const storage = fakeStorage();
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  storage.objects.set('previews/u1/7-a-band.jpg', new Uint8Array([2]));
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
  }];
  const admin = { from: previewsTable(rows), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };
  const first = await takePreparedIllustration(admin, input);
  assert(first);
  // Held while the job stores it: no other job takes it meanwhile.
  assertEquals(await takePreparedIllustration(admin, { ...input, waitMs: 0 }), null);
  await first.giveBack();
  // Ready again with its band, as analysis_previews_painted_has_image requires.
  assertEquals([rows[0].image_status, rows[0].image_path, rows[0].band_path], ['ready', 'u1/7-a.jpg', 'previews/u1/7-a-band.jpg']);
  assertEquals(await take(admin, input), 'https://example.test/sign/u1/7-a.jpg?token=t');
  assertEquals([...storage.objects.keys()], ['u1/7-a.jpg']);
});

Deno.test('a painting attached before an analysis refused leaves the dream, and only for that analysis', async () => {
  const setup = (dream: Row) => {
    const storage = fakeStorage();
    storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
    const previews: Row[] = [{
      user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
      image_path: 'previews/u1/7-a.jpg', band_path: null, band_url: null,
    }];
    const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: null, analysis_request_id: 'r1', analysis_status: 'pending', ...dream }];
    const admin = { from: (name: string) => (name === 'dreams' ? previewsTable(dreams) : previewsTable(previews))(), storage };
    return { admin, storage, dreams };
  };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', analysisRequestId: 'r1' };

  const refused = setup({});
  const painting = await attachPreparedIllustration(refused.admin, input);
  assert(painting);
  assertEquals(refused.dreams[0].image_url, 'https://example.test/sign/u1/7-a.jpg?token=t');
  await painting.detach();
  assertEquals(refused.dreams[0].image_url, null);
  assertEquals([...refused.storage.objects.keys()], []);

  // Asked again meanwhile: another analysis, the painting is not this dream's.
  const askedAgain = setup({ analysis_request_id: 'r2' });
  assertEquals(await attachPreparedIllustration(askedAgain.admin, input), null);
  assertEquals(askedAgain.dreams[0].image_url, null);
});

Deno.test('after a failure that may hide a stored link, the painting is settled if the dream holds it, given back otherwise', async () => {
  const setup = (imageUrl: (url: string) => string | null) => {
    const storage = fakeStorage();
    storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
    storage.objects.set('previews/u1/7-a-band.jpg', new Uint8Array([2]));
    const previews: Row[] = [{
      user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
      image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
    }];
    const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: null }];
    const admin = { from: (name: string) => (name === 'dreams' ? previewsTable(dreams) : previewsTable(previews))(), storage };
    return { admin, storage, previews, dreams, link: (url: string) => { dreams[0].image_url = imageUrl(url); } };
  };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };

  // The link was stored before the failure: the painting is the dream's for good, never taken again.
  const stored = setup((url) => url);
  const kept = await takePreparedIllustration(stored.admin, input);
  assert(kept);
  stored.link(kept.url);
  assertEquals(await kept.release(), true);
  assertEquals([stored.previews[0].image_status, stored.previews[0].image_path, stored.previews[0].band_path], ['used', null, null]);
  assertEquals([...stored.storage.objects.keys()], ['u1/7-a.jpg']);
  assertEquals(await take(stored.admin, input), null);

  // Not stored: ready again for the next job.
  const lost = setup(() => null);
  const back = await takePreparedIllustration(lost.admin, input);
  assert(back);
  lost.link(back.url);
  assertEquals(await back.release(), false);
  assertEquals([lost.previews[0].image_status, lost.previews[0].image_path], ['ready', 'u1/7-a.jpg']);
});

Deno.test('a painting moved whose new place cannot be recorded goes back, ready for the next job', async () => {
  const storage = fakeStorage();
  storage.objects.set('previews/u1/7-a.jpg', new Uint8Array([1]));
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
  }];
  let recordFails = true;
  const table = previewsTable(rows);
  const admin = {
    from: () => {
      const builder = table();
      const update = builder.update;
      // The database refuses the new path once, and answers with an error rather than throwing.
      builder.update = (values: Row) => {
        if (recordFails && values.image_path === 'u1/7-a.jpg') {
          recordFails = false;
          const failing = { eq: () => failing, select: () => failing, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'down' } }).then(resolve) };
          return failing as never;
        }
        return update(values);
      };
      return builder;
    },
    storage,
  };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' };
  assertEquals(await take(admin, input), null);
  assertEquals([...storage.objects.keys()], ['previews/u1/7-a.jpg']);
  assertEquals([rows[0].image_status, rows[0].image_path], ['ready', 'previews/u1/7-a.jpg']);
  assertEquals(await take(admin, input), 'https://example.test/sign/u1/7-a.jpg?token=t');
});

Deno.test('a painting held by a job that stopped is taken over after its lease, never while held', async () => {
  const storage = fakeStorage();
  storage.objects.set('u1/7-a.jpg', new Uint8Array([1]));
  storage.objects.set('previews/u1/7-a-band.jpg', new Uint8Array([2]));
  const start = Date.parse('2026-10-22T07:00:00Z');
  let clock = start;
  // Taken (moved to the account's prefix) by a job that stopped before linking or giving it back.
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'used', image_prompt: 'A river of glass',
    image_path: 'u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
    image_updated_at: new Date(start - 10_000).toISOString(),
  }];
  const admin = { from: previewsTable(rows), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', now: () => clock };
  // Held: no wait asked, nothing taken.
  assertEquals(await take(admin, { ...input, waitMs: 0 }), null);
  // Waited for until its lease ends, then taken over without being moved again.
  const slept: number[] = [];
  assertEquals(await take(admin, { ...input, sleep: async (ms: number) => { slept.push(ms); clock += ms; } }), 'https://example.test/sign/u1/7-a.jpg?token=t');
  assert(slept.length > 0 && clock - start >= 50_000);
  assertEquals([rows[0].image_status, rows[0].image_path, rows[0].band_path], ['used', null, null]);
  assertEquals([...storage.objects.keys()], ['u1/7-a.jpg']);
});

Deno.test('a painting that cannot be given back makes the job try again rather than paint another', async () => {
  const storage = fakeStorage();
  const rows: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'ready', image_prompt: 'A river of glass',
    image_path: 'previews/u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
  }];
  const table = previewsTable(rows);
  const admin = {
    from: () => {
      const builder = table();
      const update = builder.update;
      // Giving back (to ready) answers with an error.
      builder.update = (values: Row) => {
        if (values.image_status === 'ready') {
          const failing = { eq: () => failing, select: () => failing, then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: null, error: { message: 'down' } }).then(resolve) };
          return failing as never;
        }
        return update(values);
      };
      return builder;
    },
    storage,
  };
  // The object is missing for now: the move fails, and the row cannot be given back.
  const error = await assertRejects(() => takePreparedIllustration(admin, { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass' }));
  assertEquals((error as { isTransient?: unknown }).isTransient, true);
  assertEquals(rows[0].image_status, 'used');
});

Deno.test('a held painting the dream already shows is settled, never taken over and linked again', async () => {
  const storage = fakeStorage();
  storage.objects.set('u1/7-a.jpg', new Uint8Array([1]));
  storage.objects.set('previews/u1/7-a-band.jpg', new Uint8Array([2]));
  const previews: Row[] = [{
    user_id: 'u1', dream_id: 7, status: 'used', image_status: 'used', image_prompt: 'A river of glass',
    image_path: 'u1/7-a.jpg', band_path: 'previews/u1/7-a-band.jpg', band_url: 'https://example.test/band',
    image_updated_at: new Date(Date.parse('2026-10-22T07:00:00Z') - 120_000).toISOString(),
  }];
  const dreams: Row[] = [{ id: 7, user_id: 'u1', image_url: 'https://example.test/storage/v1/object/sign/dream-images/u1/7-a.jpg?token=t' }];
  const admin = { from: (name: string) => (name === 'dreams' ? previewsTable(dreams) : previewsTable(previews))(), storage };
  const input = { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'A river of glass', now: () => Date.parse('2026-10-22T07:00:00Z') };
  // Given to the job as stored, the dream's own link: the job only finishes its bookkeeping.
  assertEquals(await take(admin, input), dreams[0].image_url);
  assertEquals(dreams[0].image_url, 'https://example.test/storage/v1/object/sign/dream-images/u1/7-a.jpg?token=t');
  assertEquals([previews[0].image_status, previews[0].image_path, previews[0].band_path], ['used', null, null]);
  assertEquals([...storage.objects.keys()], ['u1/7-a.jpg']);
  assertEquals(storage.calls.filter((call) => call.startsWith('move:')), []);
});

Deno.test('a preview that cannot be read makes the job try again rather than paint another', async () => {
  const failing = { eq: () => failing, select: () => failing, maybeSingle: async () => ({ data: null, error: { message: 'down' } }) };
  const admin = { from: () => failing, storage: fakeStorage() };
  const error = await assertRejects(() => takePreparedIllustration(admin, { bucket: 'dream-images', userId: 'u1', dreamId: 7, prompt: 'p' }));
  assertEquals((error as { isTransient?: unknown }).isTransient, true);
});
