import { budgetedFetch, planPairs, preserveResponse, validateFixtures, type Evidence, atomicWriteJson, type AtomicFileIO } from './core.ts';
const corpus = JSON.parse(await Deno.readTextFile(new URL('./fixtures.json', import.meta.url)));
function assert(value: unknown, message = 'Assertion failed'): asserts value {
  if (!value) throw new Error(message);
}
function rejectsFixture(mutate: (rows: typeof corpus) => void) {
  const rows = structuredClone(corpus);
  mutate(rows);
  let rejected = false;
  try { validateFixtures(rows); } catch { rejected = true; }
  assert(rejected, 'Invalid fixture accepted');
}
Deno.test('actual corpus preserves six languages, short/rich mix and a lucid positive control', () => {
  const rows = validateFixtures(corpus);
  assert(rows.length === 6 && rows.filter((x) => x.kind === 'short').length === 3);
  assert(rows.find((x) => x.expectedType === 'Lucid Dream')?.lang === 'de');
});
Deno.test('preflight rejects malformed data before an experiment can be planned', () => {
  for (const value of [null, {}, [], [...corpus, corpus[0]]]) {
    let rejected = false;
    try { validateFixtures(value); } catch { rejected = true; }
    assert(rejected);
  }
  rejectsFixture((r) => { r[0].id = r[1].id; });
  rejectsFixture((r) => { r[0].lang = 'zz'; });
  rejectsFixture((r) => { r[0].lang = r[1].lang; });
  rejectsFixture((r) => { delete r[0].transcript; });
  rejectsFixture((r) => { r[0].transcript = 42; });
  rejectsFixture((r) => { r[0].transcript = ' '; });
  rejectsFixture((r) => { r[0].transcript = 'x'.repeat(6001); });
  rejectsFixture((r) => { r[0].kind = 'medium'; });
  rejectsFixture((r) => { r[0].kind = 'rich'; });
  rejectsFixture((r) => { r[1].kind = 'short'; });
  rejectsFixture((r) => { r[0].observations = []; });
  rejectsFixture((r) => { r[0].observations = ['']; });
  rejectsFixture((r) => { delete r[0].reportedEmotions; });
  rejectsFixture((r) => { r[0].reportedEmotions = [42]; });
  rejectsFixture((r) => { r[0].expectedType = 'Made up'; });
  rejectsFixture((r) => { r[3].expectedType = 'Unknown'; });
});
Deno.test('both orders occur within each length and the total is balanced, even after reordering', () => {
  for (const rows of [corpus, [...corpus].reverse(), [...corpus].sort((a, b) => a.kind.localeCompare(b.kind))]) {
    const plan = planPairs(validateFixtures(rows));
    assert(plan.filter((x) => x.versions[0] === 'before').length === 3);
    for (const kind of ['short', 'rich']) {
      assert(new Set(plan.filter((x) => x.fixture.kind === kind).map((x) => x.versions[0])).size === 2);
    }
  }
});
const evidence: Evidence = { id: 'en-short', version: 'after', model: 'mock', milliseconds: 1, rawText: '{broken', usage: null };
Deno.test('malformed paid text is persisted before parsing and retained as an invalid result', async () => {
  const writes: Evidence[] = [];
  const result = await preserveResponse(evidence, async (row) => { writes.push(structuredClone(row)); });
  assert(writes.length === 2 && writes[0].parseStatus === 'pending');
  assert(writes[0].rawText === '{broken' && writes[1].rawText === '{broken');
  assert(result.parseStatus === 'invalid' && result.response === undefined);
});
Deno.test('valid output also preserves raw text before deriving word metrics', async () => {
  const writes: Evidence[] = [];
  const result = await preserveResponse({ ...evidence, rawText: '{"interpretation":"A blue door."}' }, async (row) => { writes.push(row); });
  assert(writes[0].parseStatus === 'pending' && writes[0].response === undefined);
  assert(result.parseStatus === 'valid' && result.interpretationWords === 3);
});
Deno.test('failed raw evidence persistence aborts before a second save or result processing', async () => {
  let writes = 0; let rejected = false;
  try { await preserveResponse(evidence, async () => { writes++; throw new Error('disk unavailable'); }); } catch { rejected = true; }
  assert(rejected && writes === 1);
});
Deno.test('mock transport cannot exceed twelve requests, including concurrent reservations', async () => {
  let sends = 0;
  const receipts: number[] = [];
  const transport = budgetedFetch(async () => { sends++; return new Response('{}'); }, async (n) => { receipts.push(n); });
  const results = await Promise.allSettled(Array.from({ length: 13 }, () => transport('https://generativelanguage.googleapis.com/mock')));
  assert(sends === 12 && receipts.length === 12 && receipts[11] === 12);
  assert(results.filter((x) => x.status === 'rejected').length === 1);
});
Deno.test('foreign endpoints and failed durable reservations never send to the mock provider', async () => {
  let sends = 0; let reservations = 0;
  const transport = budgetedFetch(async () => { sends++; return new Response('{}'); }, async () => { reservations++; throw new Error('disk unavailable'); });
  const results = await Promise.allSettled([
    transport('https://example.com'), transport('http://generativelanguage.googleapis.com'), transport('https://generativelanguage.googleapis.com/mock'),
  ]);
  assert(results.every((x) => x.status === 'rejected') && sends === 0 && reservations === 1);
});
Deno.test('failed second evidence staging or rename preserves the previous raw response and older cases', async () => {
  for (const failure of ['write', 'rename']) {
    const files = new Map<string, string>();
    let fail = false;
    const io: AtomicFileIO = {
      async writeTextFile(path, text, options) {
        assert(options.mode === 0o600 && options.createNew);
        assert(!files.has(path));
        if (fail && failure === 'write') {
          files.set(path, 'partial staging content');
          throw new Error('disk full');
        }
        files.set(path, text);
      },
      async rename(from, to) {
        if (fail && failure === 'rename') throw new Error('rename failed');
        assert(files.has(from));
        files.set(to, files.get(from)!); files.delete(from);
      },
      async remove(path) { files.delete(path); },
    };
    const path = '/mock/results.json';
    const oldCase = { id: 'prior-case', rawText: 'prior paid output' };
    let saves = 0; let rejected = false;
    try {
      await preserveResponse(evidence, async (row) => {
        fail = ++saves === 2;
        await atomicWriteJson(path, { results: [oldCase, row] }, io);
      });
    } catch { rejected = true; }
    assert(rejected && saves === 2);
    const saved = JSON.parse(files.get(path)!);
    assert(saved.results[0].rawText === 'prior paid output');
    assert(saved.results[1].rawText === '{broken' && saved.results[1].parseStatus === 'pending');
    assert(files.size === 1, 'Only the previous target should remain after staging cleanup');
  }
});
Deno.test('delayed first budget receipt cannot be overtaken by a later count', async () => {
  let release!: () => void;
  const delay = new Promise<void>((resolve) => { release = resolve; });
  const started: number[] = []; const completed: number[] = []; let sends = 0;
  const transport = budgetedFetch(async () => { sends++; return new Response('{}'); }, async (count) => {
    started.push(count);
    if (count === 1) await delay;
    completed.push(count);
  });
  const first = transport('https://generativelanguage.googleapis.com/mock');
  const second = transport('https://generativelanguage.googleapis.com/mock');
  await Promise.resolve();
  assert(started.join() === '1' && completed.length === 0 && sends === 0);
  release();
  await Promise.all([first, second]);
  assert(started.join() === '1,2' && completed.join() === '1,2' && Number(sends) === 2);
});
