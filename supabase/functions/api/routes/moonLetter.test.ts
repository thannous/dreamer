import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { handleMoonLetter, moonLetterInstruction, parseMoonLetter } from './moonLetter.ts';
import { isProductRouteAllowed } from '../lib/productAuthorization.ts';
import type { ApiContext } from '../types.ts';

// A small in-memory PostgREST: enough of the query builder for the letters and dreams.
type Row = Record<string, unknown>;
type Filter = (row: Row) => boolean;

function table(rows: Row[], onInsert?: (row: Row) => { code: string } | null) {
  return () => {
    const filters: Filter[] = [];
    let action: { kind: 'select' } | { kind: 'insert'; row: Row } | { kind: 'update'; values: Row } | { kind: 'delete' } = { kind: 'select' };
    let order: { column: string; ascending: boolean } | null = null;
    let limit = Infinity;
    const run = () => {
      if (action.kind === 'insert') {
        const inserted = action.row;
        const conflict = onInsert?.(inserted) ?? (rows.some((row) => row.user_id === inserted.user_id && row.full_moon_at === inserted.full_moon_at) ? { code: '23505' } : null);
        if (conflict) return { data: null, error: conflict };
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
      lt: (column: string, value: string) => { filters.push((row) => String(row[column]) < value); return builder; },
      gte: (column: string, value: string) => { filters.push((row) => String(row[column]) >= value); return builder; },
      order: (column: string, options: { ascending: boolean }) => { order = { column, ...options }; return builder; },
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

// Tuesday 27 October 2026, the morning after the 26 October full moon (04:12 UTC).
const NOW = Date.parse('2026-10-27T07:00:00Z');
const FULL_MOON = '2026-10-26T04:11:49.432Z';
// symbols and emotions as PostgREST returns them for `symbols:analysis_details->symbols`.
const dream = (iso: string, extra: Row = {}): Row => ({
  user_id: 'u1', created_at: iso, title: `Dream ${iso.slice(5, 10)}`, transcript: 'I walked along a river of glass.', theme: 'calm',
  symbols: [{ name: 'River' }], emotions: [{ name: 'Calm' }], ...extra,
});
const cycleDreams = () => [
  // The day of the previous full moon belongs to the cycle before.
  dream('2026-09-27T05:00:00Z'),
  dream('2026-10-02T06:00:00Z'),
  dream('2026-10-15T06:00:00Z', { transcript: '   ' }),
  dream('2026-10-19T06:00:00Z'),
  dream('2026-10-26T06:30:00Z'),
];
const letterText = JSON.stringify({
  opening: 'Ce cycle, la rivière de verre est revenue trois fois — chaque fois plus calme.',
  body: 'Elle a commencé loin de toi.\n\n\n\nPuis elle a traversé ta maison. Que portera-t-elle la prochaine fois ?',
});

function setup(options: { tier?: string; dreams?: Row[]; letters?: Row[]; generate?: () => Promise<{ text: string; raw: unknown }>; admit?: () => Promise<unknown> } = {}) {
  const letters = options.letters ?? [];
  const dreams = options.dreams ?? cycleDreams();
  const calls = { generate: 0, admit: 0, prompts: [] as string[] };
  const admin = {
    rpc: async (name: string) => (name === 'get_effective_subscription_tier' ? { data: options.tier ?? 'plus', error: null } : { data: null, error: { code: 'x' } }),
    from: (name: string) => {
      assertEquals(name, 'moon_letters');
      return table(letters)();
    },
  };
  const ctx = (body: unknown, user: unknown = { id: 'u1' }): ApiContext => ({
    req: new Request('https://example.test/moon-letter', { method: 'POST', body: JSON.stringify(body) }),
    user,
    supabase: { from: (name: string) => { assertEquals(name, 'dreams'); return table(dreams.filter((row) => row.user_id === 'u1'))(); } },
    supabaseUrl: 'https://example.test', supabaseServiceRoleKey: 'service-role', storageBucket: 'test',
  });
  const deps = {
    now: () => NOW,
    apiKey: 'gemini-key',
    anthropicApiKey: null,
    createAdminClient: (() => admin) as never,
    admit: (async () => { calls.admit++; return options.admit ? await options.admit() : { tier: 'plus', actorClass: 'PLUS' }; }) as never,
    generate: (async (_key: string, _model: string, _fallback: string, contents: { parts: { text: string }[] }[]) => {
      calls.generate++;
      calls.prompts.push(contents[0].parts[0].text);
      return options.generate ? await options.generate() : { text: letterText, raw: {} };
    }) as never,
  };
  return { ctx, deps, letters, calls };
}

Deno.test('the letter is a journal route, for signed-in accounts only', async () => {
  assertEquals(isProductRouteAllowed('journal', 'POST /moon-letter'), true);
  assertEquals(isProductRouteAllowed('lucid', 'POST /moon-letter'), false);
  const { ctx, deps, calls } = setup();
  assertEquals((await handleMoonLetter(ctx({ lang: 'fr' }, null), deps)).status, 401);
  assertEquals((await handleMoonLetter(ctx({ lang: 'xx' }), deps)).status, 400);
  assertEquals((await handleMoonLetter(ctx({ lang: 'fr', fullMoonAt: '2026-10-20T00:00:00Z' }), deps)).status, 400);
  // The next full moon has no letter yet.
  assertEquals((await handleMoonLetter(ctx({ lang: 'fr', fullMoonAt: '2026-11-24T14:53:32Z' }), deps)).status, 400);
  assertEquals(calls.generate, 0);
});

Deno.test('writes the cycle’s letter once, from its own dreams, and gives Plus all of it', async () => {
  const { ctx, deps, letters, calls } = setup();
  const response = await handleMoonLetter(ctx({ lang: 'fr' }), deps);
  assertEquals(response.status, 200);
  const result = await response.json();
  assertEquals(result.fullMoonAt, FULL_MOON);
  assertEquals(result.letter.locked, false);
  assertEquals(result.letter.dreamCount, 3);
  // No long dash, no run of blank lines.
  assertEquals(result.letter.opening, 'Ce cycle, la rivière de verre est revenue trois fois, chaque fois plus calme.');
  assertEquals(result.letter.body, 'Elle a commencé loin de toi.\n\nPuis elle a traversé ta maison. Que portera-t-elle la prochaine fois ?');
  const sent = JSON.parse(calls.prompts[0]);
  assertEquals(sent.dreams.map((entry: { date: string }) => entry.date), ['2026-10-02', '2026-10-19', '2026-10-26']);
  assertEquals(sent.dreams[0].symbols, ['River']);
  assertEquals(letters[0].status, 'ready');
  // The window a deleted dream is matched against.
  assertEquals([letters[0].dreams_from, letters[0].dreams_until], ['2026-09-27T16:49:03.885Z', '2026-10-27T04:11:49.432Z']);

  // Read again: the same letter, no second writing.
  const again = await (await handleMoonLetter(ctx({ lang: 'fr' }), deps)).json();
  assertEquals(again.letter.opening, result.letter.opening);
  assertEquals(calls.generate, 1);
  assertEquals(calls.admit, 1);
});

Deno.test('a free account receives the opening sentence only', async () => {
  const { ctx, deps } = setup({ tier: 'free' });
  const result = await (await handleMoonLetter(ctx({ lang: 'fr' }), deps)).json();
  assertEquals(result.letter.locked, true);
  assertEquals(result.letter.body, null);
  assert(!JSON.stringify(result).includes('traversé ta maison'));
  assertStringIncludes(result.letter.opening, 'rivière de verre');
});

Deno.test('a cycle with too few dreams gets no letter and costs nothing', async () => {
  const { ctx, deps, letters, calls } = setup({ dreams: cycleDreams().slice(0, 3) });
  const result = await (await handleMoonLetter(ctx({ lang: 'fr' }), deps)).json();
  assertEquals(result.letter, null);
  assertEquals(result.reason, 'too_few_dreams');
  assertEquals(result.dreamCount, 1);
  assertEquals(result.minDreams, 3);
  assertEquals(letters.length, 0);
  assertEquals(calls.admit + calls.generate, 0);
});

Deno.test('a letter being written makes a second request wait, until it is stale', async () => {
  const writing = { user_id: 'u1', full_moon_at: FULL_MOON, status: 'writing', lang: 'fr', opening: null, body: null, dream_count: 3, updated_at: new Date(NOW - 30_000).toISOString() };
  const fresh = setup({ letters: [{ ...writing }] });
  const waiting = await (await handleMoonLetter(fresh.ctx({ lang: 'fr' }), fresh.deps)).json();
  assertEquals(waiting.reason, 'writing');
  assertEquals(fresh.calls.generate, 0);

  const stale = setup({ letters: [{ ...writing, updated_at: new Date(NOW - 5 * 60_000).toISOString() }] });
  const taken = await (await handleMoonLetter(stale.ctx({ lang: 'fr' }), stale.deps)).json();
  assertEquals(taken.letter.locked, false);
  assertEquals(stale.calls.generate, 1);
  assertEquals(stale.letters.length, 1);
});

Deno.test('a refused or failed writing leaves no letter behind, so the next request can write it', async () => {
  const refused = setup({ admit: async () => new Response('{}', { status: 429 }) });
  assertEquals((await handleMoonLetter(refused.ctx({ lang: 'fr' }), refused.deps)).status, 429);
  assertEquals(refused.letters.length, 0);
  assertEquals(refused.calls.generate, 0);

  const invalid = setup({ generate: async () => ({ text: JSON.stringify({ opening: 'Voir https://example.com', body: 'x' }), raw: {} }) });
  assertEquals((await handleMoonLetter(invalid.ctx({ lang: 'fr' }), invalid.deps)).status, 502);
  assertEquals(invalid.letters.length, 0);
});

Deno.test('an earlier cycle shows the letter it had, and is never written afterwards', async () => {
  const earlier = { user_id: 'u1', full_moon_at: '2026-09-26T16:49:03.885Z', status: 'ready', lang: 'fr', opening: 'Septembre.', body: 'Suite.', dream_count: 4, updated_at: '2026-09-27T08:00:00.000Z' };
  const { ctx, deps, calls } = setup({ letters: [{ ...earlier }] });
  const old = await (await handleMoonLetter(ctx({ lang: 'fr', fullMoonAt: '2026-09-26T16:49:00Z' }), deps)).json();
  assertEquals(old.letter.opening, 'Septembre.');
  const missing = await (await handleMoonLetter(ctx({ lang: 'fr', fullMoonAt: '2026-08-28T04:18:31Z' }), deps)).json();
  assertEquals(missing.letter, null);
  assertEquals(missing.reason, 'not_written');
  // The current letter lists the earlier one.
  const current = await (await handleMoonLetter(ctx({ lang: 'fr' }), deps)).json();
  assertEquals(current.previous, [{ fullMoonAt: '2026-09-26T16:49:03.885Z', opening: 'Septembre.', dreamCount: 4 }]);
  assertEquals(calls.generate, 1);
});

Deno.test('a request naming the current full moon only reads, so it never writes without the app asking consent', async () => {
  const { ctx, deps, letters, calls } = setup();
  const named = await (await handleMoonLetter(ctx({ lang: 'fr', fullMoonAt: FULL_MOON }), deps)).json();
  assertEquals(named.letter, null);
  assertEquals(named.reason, 'not_written');
  assertEquals(letters.length, 0);
  assertEquals(calls.admit + calls.generate, 0);
  // Once written, naming it reads it.
  await handleMoonLetter(ctx({ lang: 'fr' }), deps);
  const read = await (await handleMoonLetter(ctx({ lang: 'fr', fullMoonAt: FULL_MOON }), deps)).json();
  assertStringIncludes(read.letter.opening, 'rivière de verre');
  assertEquals(calls.generate, 1);
});

Deno.test('the instruction keeps the letter grounded, informal and free of long dashes', () => {
  const instruction = moonLetterInstruction('fr');
  assertStringIncludes(instruction, 'French');
  assertStringIncludes(instruction, 'never vous');
  assertStringIncludes(instruction, 'never say the moon causes or influences dreams');
  assertStringIncludes(instruction, 'no em dash');
  assertEquals(parseMoonLetter(JSON.stringify({ opening: 'Une phrase.', body: 'La suite.' })), { opening: 'Une phrase.', body: 'La suite.' });
});
