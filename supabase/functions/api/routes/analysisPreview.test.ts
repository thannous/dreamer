import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleAnalysisPreview } from './analysisPreview.ts';
import { transcriptSha256 } from '../lib/analysisPreview.ts';
import { isProductRouteAllowed } from '../lib/productAuthorization.ts';
import type { StructuredDreamAnalysis } from '../services/dreamAnalysis.ts';
import type { ApiContext } from '../types.ts';

// A small in-memory PostgREST: enough of the query builder for the previews and dreams.
type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

function table(rows: Row[], key: string[] = ['user_id', 'dream_id']) {
  return () => {
    const filters: Filter[] = [];
    let action: { kind: 'select' } | { kind: 'insert'; row: Row } | { kind: 'update'; values: Row } | { kind: 'delete' } = { kind: 'select' };
    let order: { column: string; ascending: boolean } | null = null;
    let limit = Infinity;
    const run = () => {
      if (action.kind === 'insert') {
        const inserted = action.row;
        if (rows.some((row) => key.every((column) => row[column] === inserted[column]))) return { data: null, error: { code: '23505' } };
        rows.push({ ...inserted });
        return { data: null, error: null };
      }
      const matched = rows.filter((row) => filters.every((filter) => filter(row)));
      if (action.kind === 'update') {
        for (const row of matched) Object.assign(row, action.values);
        return { data: matched.map((row) => ({ ...row })), error: null };
      }
      if (action.kind === 'delete') {
        for (const row of matched) rows.splice(rows.indexOf(row), 1);
        return { data: null, error: null };
      }
      const sorted = order ? [...matched].sort((a, b) => {
        const left = String(a[order!.column]);
        const right = String(b[order!.column]);
        return (left < right ? -1 : left > right ? 1 : 0) * (order!.ascending ? 1 : -1);
      }) : matched;
      return { data: sorted.slice(0, limit).map((row) => ({ ...row })), error: null };
    };
    const builder = {
      select: () => builder,
      insert: (row: Row) => { action = { kind: 'insert', row }; return builder; },
      update: (values: Row) => { action = { kind: 'update', values }; return builder; },
      delete: () => { action = { kind: 'delete' }; return builder; },
      eq: (column: string, value: unknown) => { filters.push((row) => row[column] === value); return builder; },
      neq: (column: string, value: unknown) => { filters.push((row) => row[column] !== value); return builder; },
      in: (column: string, values: unknown[]) => { filters.push((row) => values.includes(row[column])); return builder; },
      gt: (column: string, value: string) => { filters.push((row) => String(row[column]) > value); return builder; },
      order: (column: string, options: { ascending: boolean }) => { order = { column, ascending: options.ascending }; return builder; },
      limit: (count: number) => { limit = count; return builder; },
      maybeSingle: async () => {
        const { data, error } = run();
        return { data: (data as Row[] | null)?.[0] ?? null, error };
      },
      then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return builder;
  };
}

const NOW = Date.parse('2026-10-22T07:00:00Z');
const DAY = 24 * 60 * 60 * 1000;
const iso = (time: number) => new Date(time).toISOString();
const TRANSCRIPT = 'Je marchais sur une rivière de verre vers la maison de mon enfance.';

const reading = (extra: Partial<StructuredDreamAnalysis> = {}): StructuredDreamAnalysis => ({
  title: 'La rivière de verre',
  interpretation: 'Ton rêve fait de la rivière un passage plutôt qu’un obstacle. La maison de ton enfance attend au bout, éclairée.',
  shareableQuote: 'Une rivière de verre',
  theme: 'calm',
  dreamType: 'Symbolic Dream',
  imagePrompt: 'A river of glass at dusk leading to a lit childhood home',
  promptVersion: 'test',
  symbols: [
    { name: 'Rivière', meaning: 'Un passage entre deux rives de ta vie.' },
    { name: 'Maison', meaning: 'Ce qui t’attend.' },
  ],
  emotions: [{ name: 'Calme', insight: 'Tu avances sans peur.' }],
  reflectionQuestions: ['Vers quoi marches-tu ?'],
  ...extra,
});

function setup(options: {
  tier?: string;
  canAnalyze?: boolean;
  dream?: Row;
  previews?: Row[];
  analyze?: () => Promise<StructuredDreamAnalysis>;
  paint?: () => Promise<{ imagePath: string; bandPath: string; bandUrl: string }>;
  admit?: () => Promise<unknown>;
  signFails?: () => boolean;
} = {}) {
  const previews = options.previews ?? [];
  const dreams: Row[] = [
    {
      id: 7, user_id: 'u1', title: 'Rêve du 22 octobre', transcript: TRANSCRIPT, is_analyzed: false, analysis_status: 'none',
      theme: null, precise_theme: null, dream_type: null, analysis_details: null, ...options.dream,
    },
    { id: 3, user_id: 'u1', is_analyzed: true, analyzed_at: '2026-10-01T00:00:00Z', analysis_details: { symbols: [{ name: 'Rivière de verre', key: 'glass-river' }] } },
  ];
  const calls = { analyze: 0, admit: 0, paint: 0, quota: 0, analyzeOptions: [] as Record<string, unknown>[], removed: [] as string[] };
  // hold_analysis_preview as the migration writes it, at NOW, one call at a time like its lock.
  const hold = (args: Record<string, unknown>) => {
    const dream = dreams.find((row) => row.id === args.p_dream_id && row.user_id === args.p_user_id);
    if (!dream) return { state: 'gone' };
    if (dream.is_analyzed === true) return { state: 'analyzed' };
    if (dream.analysis_status === 'pending') return { state: 'pending' };
    const live = (row: Row) => row.status !== 'writing' || Date.parse(String(row.updated_at)) > NOW - 3 * 60_000;
    const current = previews.find((row) => row.user_id === args.p_user_id && row.dream_id === args.p_dream_id);
    if (current?.status === 'writing' && live(current)) return { state: 'writing' };
    const week = previews.filter((row) => row.user_id === args.p_user_id && Date.parse(String(row.created_at)) > NOW - 7 * DAY && live(row));
    if (week.length) return { state: 'weekly_limit', retry_at: iso(Math.max(...week.map((row) => Date.parse(String(row.created_at)))) + 7 * DAY) };
    const previous = { previous_image_path: current?.image_path ?? null, previous_band_path: current?.band_path ?? null };
    const held = {
      user_id: args.p_user_id, dream_id: args.p_dream_id, status: 'writing', lang: args.p_lang, transcript_sha256: args.p_transcript_sha256,
      reading: null, image_status: 'none', image_prompt: null, image_path: null, band_path: null, band_url: null, image_updated_at: null,
      created_at: iso(NOW), updated_at: iso(NOW),
    };
    if (current) Object.assign(current, held);
    else previews.push(held);
    return { state: 'held', held_at: iso(NOW), ...previous };
  };
  // save_analysis_preview as the migration writes it: the dream checked again, then the held row saved.
  const save = async (args: Record<string, unknown>) => {
    const dream = dreams.find((row) => row.id === args.p_dream_id && row.user_id === args.p_user_id);
    if (!dream) return { state: 'gone' };
    if (dream.is_analyzed === true) return { state: 'analyzed' };
    if (dream.analysis_status === 'pending') return { state: 'pending' };
    if (await transcriptSha256(String(dream.transcript ?? '')) !== args.p_dream_transcript_sha256) return { state: 'changed' };
    const held = previews.find((row) => row.user_id === args.p_user_id && row.dream_id === args.p_dream_id
      && row.status === 'writing' && row.updated_at === args.p_held_at);
    if (!held) return { state: 'lost' };
    const savedAt = iso(NOW);
    Object.assign(held, {
      status: 'ready', reading: args.p_reading, updated_at: savedAt,
      image_status: 'painting', image_prompt: args.p_image_prompt, image_updated_at: savedAt,
    });
    return { state: 'saved', saved_at: savedAt, row: { ...held } };
  };
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === 'get_effective_subscription_tier') return { data: options.tier ?? 'free', error: null };
      if (name === 'hold_analysis_preview') return { data: hold(args), error: null };
      if (name === 'save_analysis_preview') return { data: await save(args), error: null };
      return { data: null, error: { code: 'x' } };
    },
    from: (name: string) => {
      if (name === 'dreams') return table(dreams, ['id'])();
      assertEquals(name, 'analysis_previews');
      return table(previews)();
    },
    storage: {
      from: () => ({
        remove: async (keys: string[]) => { calls.removed.push(...keys); return { error: null }; },
        createSignedUrl: async (path: string, seconds: number) => options.signFails?.()
          ? { data: null, error: { message: 'unavailable' } }
          : { data: { signedUrl: `https://example.test/sign/${path}?expires=${seconds}` }, error: null },
      }),
    },
  };
  const ctx = (body: unknown, user: unknown = { id: 'u1' }): ApiContext => ({
    req: new Request('https://example.test/analysis-preview', { method: 'POST', body: JSON.stringify(body) }),
    user,
    supabase: {
      // Row-level security: the caller reads its own dreams only.
      from: (name: string) => { assertEquals(name, 'dreams'); return table(dreams.filter((row) => row.user_id === 'u1'), ['id'])(); },
      rpc: async (name: string) => {
        assertEquals(name, 'get_authenticated_quota_snapshot');
        calls.quota++;
        return { data: { tier: 'free', canAnalyze: options.canAnalyze ?? false }, error: null };
      },
    },
    supabaseUrl: 'https://example.test', supabaseServiceRoleKey: 'service-role', storageBucket: 'dream-images',
  });
  const deps = {
    now: () => NOW,
    apiKey: 'gemini-key',
    anthropicApiKey: null,
    createAdminClient: (() => admin) as never,
    admit: (async () => { calls.admit++; return options.admit ? await options.admit() : { tier: 'free', actorClass: 'FREE' }; }) as never,
    analyze: (async (analyzeOptions: Record<string, unknown>) => {
      calls.analyze++;
      calls.analyzeOptions.push(analyzeOptions);
      return options.analyze ? await options.analyze() : reading();
    }) as never,
    paint: (async () => {
      calls.paint++;
      return options.paint ? await options.paint() : {
        imagePath: 'previews/u1/7-a.jpg', bandPath: 'previews/u1/7-a-band.jpg', bandUrl: 'https://example.test/sign/band',
      };
    }) as never,
  };
  return { ctx, deps, previews, dreams, calls };
}

const prepare = { dreamId: 7, lang: 'fr', prepare: true };

Deno.test('the prepared analysis is a journal route, for signed-in free accounts', async () => {
  assertEquals(isProductRouteAllowed('journal', 'POST /analysis-preview'), true);
  assertEquals(isProductRouteAllowed('lucid', 'POST /analysis-preview'), false);
  const { ctx, deps, calls } = setup();
  assertEquals((await handleAnalysisPreview(ctx(prepare, null), deps)).status, 401);
  assertEquals((await handleAnalysisPreview(ctx({ dreamId: -1, lang: 'fr' }), deps)).status, 400);
  assertEquals((await handleAnalysisPreview(ctx({ dreamId: 7 }), deps)).status, 400);
  assertEquals((await handleAnalysisPreview(ctx({ ...prepare, prepare: 'yes' }), deps)).status, 400);
  const plus = setup({ tier: 'plus' });
  const refused = await handleAnalysisPreview(plus.ctx(prepare), plus.deps);
  assertEquals([refused.status, (await refused.json()).code], [409, 'PLUS_ANALYZES']);
  assertEquals(calls.analyze + plus.calls.analyze, 0);
});

Deno.test('without prepare, it only says a preview can be prepared and costs nothing', async () => {
  const { ctx, deps, previews, calls } = setup();
  const result = await (await handleAnalysisPreview(ctx({ dreamId: 7, lang: 'fr' }), deps)).json();
  assertEquals(result, { state: 'available', preview: null, preparedAt: null, retryAt: null });
  assertEquals([calls.analyze, calls.admit, calls.quota, previews.length], [0, 0, 0, 0]);
});

Deno.test('prepares the analysis once and gives its title, first sentence, symbols and painted band only', async () => {
  const { ctx, deps, previews, calls } = setup();
  const response = await handleAnalysisPreview(ctx(prepare), deps);
  assertEquals(response.status, 200);
  const result = await response.json();
  assertEquals(result.state, 'ready');
  assertEquals(result.preview, {
    title: 'La rivière de verre',
    opening: 'Ton rêve fait de la rivière un passage plutôt qu’un obstacle.',
    symbols: ['Rivière', 'Maison'],
    // Signed again at each read, for an hour: a deleted dream's band stops showing soon after.
    image: { state: 'ready', bandUrl: 'https://example.test/sign/previews/u1/7-a-band.jpg?expires=3600' },
  });
  assertEquals(result.preparedAt, iso(NOW));
  // The rest of the reading and the whole painting stay on the server.
  const sent = JSON.stringify(result);
  for (const hidden of ['éclairée', 'Un passage entre deux rives', 'Tu avances sans peur', 'Vers quoi', 'previews/u1/7-a.jpg']) {
    assert(!sent.includes(hidden), hidden);
  }
  assertEquals(previews[0].status, 'ready');
  assertEquals(previews[0].transcript_sha256, await transcriptSha256(TRANSCRIPT));
  assertEquals(previews[0].image_status, 'ready');
  assertEquals(previews[0].image_prompt, 'A river of glass at dusk leading to a lit childhood home');
  assertEquals((previews[0].reading as StructuredDreamAnalysis).symbols[0].meaning, 'Un passage entre deux rives de ta vie.');
  // The same reading the analysis job writes: same route rules, the dreamer's own symbols.
  assertEquals(calls.analyzeOptions[0].route, '/analysis-preview');
  assertEquals(calls.analyzeOptions[0].lang, 'fr');
  assertEquals(calls.analyzeOptions[0].knownSymbols, [{ key: 'glass-river', name: 'Rivière de verre' }]);
  // Like the other synchronous analyses, Claude has twenty seconds before Gemini takes over.
  assertEquals(calls.analyzeOptions[0].claudeTimeoutMs, 20_000);

  // Read again, prepared or not: the same preview, no second writing.
  const again = await (await handleAnalysisPreview(ctx({ dreamId: 7, lang: 'fr' }), deps)).json();
  assertEquals(again.preview.opening, result.preview.opening);
  await handleAnalysisPreview(ctx(prepare), deps);
  assertEquals([calls.analyze, calls.paint, calls.admit], [1, 1, 1]);
});

Deno.test('a classed dream keeps the name its seal wrote', async () => {
  const { ctx, deps } = setup({ dream: { theme: 'calm', precise_theme: 'luminous', title: 'Le passage de verre' } });
  const result = await (await handleAnalysisPreview(ctx(prepare), deps)).json();
  assertEquals(result.preview.title, 'Le passage de verre');
});

Deno.test('an account with an analysis left analyzes the dream instead', async () => {
  const { ctx, deps, previews, calls } = setup({ canAnalyze: true });
  const response = await handleAnalysisPreview(ctx(prepare), deps);
  assertEquals([response.status, (await response.json()).code], [409, 'CAN_ANALYZE']);
  assertEquals([calls.analyze, previews.length], [0, 0]);
});

Deno.test('one new prepared analysis per rolling week', async () => {
  const lastWeek = (time: number, extra: Row = {}): Row => ({
    user_id: 'u1', dream_id: 5, status: 'ready', lang: 'fr', transcript_sha256: 'a'.repeat(64), reading: reading(),
    image_status: 'none', created_at: iso(time), updated_at: iso(time), ...extra,
  });
  const blocked = setup({ previews: [lastWeek(NOW - 2 * DAY)] });
  const result = await (await handleAnalysisPreview(blocked.ctx(prepare), blocked.deps)).json();
  assertEquals(result, { state: 'weekly_limit', preview: null, preparedAt: null, retryAt: iso(NOW + 5 * DAY) });
  // Spent or deleted, this week's preview still counts.
  const spent = setup({ previews: [lastWeek(NOW - DAY, { status: 'used', reading: null })] });
  assertEquals((await (await handleAnalysisPreview(spent.ctx(prepare), spent.deps)).json()).state, 'weekly_limit');
  assertEquals(blocked.calls.analyze + spent.calls.analyze, 0);

  // Older than a week, or a writing that failed long ago, it no longer does.
  const open = setup({ previews: [lastWeek(NOW - 8 * DAY), lastWeek(NOW - DAY, { dream_id: 6, status: 'writing', reading: null, updated_at: iso(NOW - DAY) })] });
  assertEquals((await (await handleAnalysisPreview(open.ctx(prepare), open.deps)).json()).state, 'ready');
});

Deno.test('an edited dream is not shown the reading of its former text', async () => {
  const { ctx, deps, previews } = setup();
  await handleAnalysisPreview(ctx(prepare), deps);
  const edited = setup({ previews, dream: { transcript: `${TRANSCRIPT} Puis la rivière a gelé.` } });
  const result = await (await handleAnalysisPreview(edited.ctx({ dreamId: 7, lang: 'fr' }), edited.deps)).json();
  assertEquals([result.state, result.preview], ['weekly_limit', null]);
});

Deno.test('a failed reading costs the week nothing', async () => {
  const { ctx, deps, previews } = setup({ analyze: () => Promise.reject(new Error('provider down')) });
  const response = await handleAnalysisPreview(ctx(prepare), deps);
  assertEquals([response.status, (await response.json()).code], [502, 'PREVIEW_FAILED']);
  assertEquals(previews.length, 0);

  const refused = setup({ admit: async () => new Response('{}', { status: 429 }) });
  assertEquals((await handleAnalysisPreview(refused.ctx(prepare), refused.deps)).status, 429);
  assertEquals([refused.previews.length, refused.calls.analyze], [0, 0]);
});

Deno.test('any failure once held gives the week back', async () => {
  const unsavable = setup({ analyze: async () => reading({ imagePrompt: '  ' }) });
  const refused = await handleAnalysisPreview(unsavable.ctx(prepare), unsavable.deps);
  assertEquals([refused.status, (await refused.json()).code], [502, 'PREVIEW_FAILED']);
  assertEquals(unsavable.previews.length, 0);

  // Written after its hold could have lapsed, a reading is not saved over another dream's week.
  let late = NOW;
  const slow = setup({ analyze: async () => { late = NOW + 160_000; return reading(); } });
  slow.deps.now = () => late;
  const tooLate = await handleAnalysisPreview(slow.ctx(prepare), slow.deps);
  assertEquals([tooLate.status, (await tooLate.json()).code], [502, 'PREVIEW_FAILED']);
  assertEquals(slow.previews.length, 0);

  const thrown = setup({ admit: () => Promise.reject(new Error('admission down')) });
  const failed = await handleAnalysisPreview(thrown.ctx(prepare), thrown.deps);
  assertEquals([failed.status, (await failed.json()).code], [503, 'PREVIEW_UNAVAILABLE']);
  assertEquals([thrown.previews.length, thrown.calls.analyze], [0, 0]);
});

Deno.test('a dream analyzed or deleted while its preview is written keeps no preview', async () => {
  // The dreams' triggers spend or empty the held row meanwhile.
  const analyzed = setup({
    analyze: async () => {
      Object.assign(analyzed.previews[0], { status: 'used' });
      return reading();
    },
  });
  const late = await handleAnalysisPreview(analyzed.ctx(prepare), analyzed.deps);
  assertEquals([late.status, (await late.json()).code], [409, 'ALREADY_ANALYZED']);
  assertEquals([analyzed.previews[0].status, analyzed.previews[0].reading, analyzed.calls.paint], ['used', null, 0]);

  const deleted = setup({
    analyze: async () => {
      Object.assign(deleted.previews[0], { status: 'removed' });
      return reading();
    },
  });
  const gone = await handleAnalysisPreview(deleted.ctx(prepare), deleted.deps);
  assertEquals([gone.status, (await gone.json()).code], [404, 'DREAM_NOT_FOUND']);
  assertEquals(deleted.previews[0].status, 'removed');
});

Deno.test('a dream edited while its preview is written keeps no reading of its former text, and the week', async () => {
  const edited = setup({
    analyze: async () => {
      Object.assign(edited.dreams[0], { transcript: `${TRANSCRIPT} Puis la rivière a gelé.` });
      return reading();
    },
  });
  const result = await (await handleAnalysisPreview(edited.ctx(prepare), edited.deps)).json();
  assertEquals(result, { state: 'available', preview: null, preparedAt: null, retryAt: null });
  assertEquals([edited.previews.length, edited.calls.paint], [0, 0]);

  const asked = setup({
    analyze: async () => {
      Object.assign(asked.dreams[0], { analysis_status: 'pending' });
      return reading();
    },
  });
  const pending = await handleAnalysisPreview(asked.ctx(prepare), asked.deps);
  assertEquals([pending.status, (await pending.json()).code], [409, 'ANALYSIS_PENDING']);
  assertEquals([asked.previews.length, asked.calls.paint], [0, 0]);
});

Deno.test('a band whose link cannot be signed this time is read again, not shown as missing', async () => {
  let failing = false;
  const { ctx, deps } = setup({ signFails: () => failing });
  await handleAnalysisPreview(ctx(prepare), deps);
  failing = true;
  const missed = await (await handleAnalysisPreview(ctx({ dreamId: 7, lang: 'fr' }), deps)).json();
  assertEquals(missed.preview.image, { state: 'painting', bandUrl: null });
  failing = false;
  const read = await (await handleAnalysisPreview(ctx({ dreamId: 7, lang: 'fr' }), deps)).json();
  assertEquals(read.preview.image.state, 'ready');
});

Deno.test('a painting whose request stopped is started again by the next read, once', async () => {
  const stalledRow = (): Row => ({
    user_id: 'u1', dream_id: 7, status: 'ready', lang: 'fr', reading: reading(),
    image_status: 'painting', image_prompt: 'A river of glass at dusk leading to a lit childhood home', image_path: null, band_path: null,
    band_url: null, image_updated_at: iso(NOW - 4 * 60_000), created_at: iso(NOW - 4 * 60_000), updated_at: iso(NOW - 4 * 60_000),
    transcript_sha256: sha,
  });
  const sha = await transcriptSha256(TRANSCRIPT);
  const { ctx, deps, previews, calls } = setup({ previews: [stalledRow()] });
  const result = await (await handleAnalysisPreview(ctx({ dreamId: 7, lang: 'fr' }), deps)).json();
  assertEquals(calls.paint, 1);
  assertEquals([result.state, result.preview.image.state], ['ready', 'ready']);
  assertEquals([previews[0].image_status, previews[0].image_path], ['ready', 'previews/u1/7-a.jpg']);

  // Restarted once already and stalled again: never painted a third time.
  const again = setup({ previews: [{ ...stalledRow(), updated_at: iso(NOW - 8 * 60_000) }] });
  const left = await (await handleAnalysisPreview(again.ctx({ dreamId: 7, lang: 'fr' }), again.deps)).json();
  assertEquals([again.calls.paint, left.preview.image.state], [0, 'none']);

  // Still under way (within its three minutes): read only, never painted twice.
  const fresh = setup({ previews: [{ ...stalledRow(), image_updated_at: iso(NOW - 60_000), updated_at: iso(NOW - 60_000) }] });
  const waiting = await (await handleAnalysisPreview(fresh.ctx({ dreamId: 7, lang: 'fr' }), fresh.deps)).json();
  assertEquals([fresh.calls.paint, waiting.preview.image.state], [0, 'painting']);
});

Deno.test('the painting of an older preview of the dream goes once the new one is saved', async () => {
  const older: Row = {
    user_id: 'u1', dream_id: 7, status: 'ready', lang: 'en', transcript_sha256: 'a'.repeat(64), reading: reading(),
    image_status: 'ready', image_prompt: 'old', image_path: 'previews/u1/7-old.jpg', band_path: 'previews/u1/7-old-band.jpg',
    band_url: 'https://example.test/sign/old', created_at: iso(NOW - 9 * DAY), updated_at: iso(NOW - 9 * DAY),
  };
  const { ctx, deps, previews, calls } = setup({ previews: [older] });
  const result = await (await handleAnalysisPreview(ctx(prepare), deps)).json();
  assertEquals([result.state, result.preview.image.bandUrl], ['ready', 'https://example.test/sign/previews/u1/7-a-band.jpg?expires=3600']);
  assertEquals(calls.removed, ['previews/u1/7-old.jpg', 'previews/u1/7-old-band.jpg']);
  assertEquals([previews.length, previews[0].lang, previews[0].image_path], [1, 'fr', 'previews/u1/7-a.jpg']);
});

Deno.test('a failed painting leaves the reading, without a band', async () => {
  const { ctx, deps, previews } = setup({ paint: () => Promise.reject(new Error('no image')) });
  const result = await (await handleAnalysisPreview(ctx(prepare), deps)).json();
  assertEquals(result.state, 'ready');
  assertEquals(result.preview.image, { state: 'none', bandUrl: null });
  assertEquals(previews[0].image_status, 'failed');
});

Deno.test('a dream opened while its painting is under way keeps that painting for its illustration', async () => {
  let previews: Row[] = [];
  const setupResult = setup({
    paint: () => {
      // The account opens the analysis meanwhile: the is_analyzed trigger spends the reading.
      Object.assign(previews[0], { status: 'used', reading: null });
      return Promise.resolve({ imagePath: 'previews/u1/7-a.jpg', bandPath: 'previews/u1/7-a-band.jpg', bandUrl: 'https://example.test/sign/band' });
    },
  });
  previews = setupResult.previews;
  await handleAnalysisPreview(setupResult.ctx(prepare), setupResult.deps);
  assertEquals([previews[0].status, previews[0].image_status, previews[0].image_path], ['used', 'ready', 'previews/u1/7-a.jpg']);
  assertEquals(setupResult.calls.removed, []);
});

Deno.test('analyzed, pending or missing dreams have no preview', async () => {
  for (const [dream, status, code] of [
    [{ is_analyzed: true }, 409, 'ALREADY_ANALYZED'],
    [{ analysis_status: 'pending' }, 409, 'ANALYSIS_PENDING'],
    [{ user_id: 'u2' }, 404, 'DREAM_NOT_FOUND'],
    [{ transcript: '   ' }, 422, 'INVALID_TRANSCRIPT'],
  ] as const) {
    const { ctx, deps, calls } = setup({ dream });
    const response = await handleAnalysisPreview(ctx(prepare), deps);
    assertEquals([response.status, (await response.json()).code], [status, code]);
    assertEquals(calls.analyze, 0);
  }
});

Deno.test('a preview being written is not written twice', async () => {
  const writing: Row = {
    user_id: 'u1', dream_id: 7, status: 'writing', lang: 'fr', transcript_sha256: 'a'.repeat(64), reading: null,
    image_status: 'none', created_at: iso(NOW - 30_000), updated_at: iso(NOW - 30_000),
  };
  const { ctx, deps, calls } = setup({ previews: [writing] });
  assertEquals((await (await handleAnalysisPreview(ctx(prepare), deps)).json()).state, 'writing');
  assertEquals(calls.analyze, 0);
});
