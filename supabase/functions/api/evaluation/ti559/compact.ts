import { ANALYSIS_PROMPT_VERSION, runDreamAnalysis } from '../../services/dreamAnalysis.ts';
import { boundTranscriptForPrompt } from '../../lib/prompts.ts';
import { atomicWriteJson } from './core.ts';
import { guardedFetch, MODEL, validate } from './completion.ts';
import corpus from './completion-fixtures.json' with { type: 'json' };

export const OUTPUT = '/private/tmp/ti559-compact-v4-evaluation-run';
// One new answer per historical case. Prior outputs are retained as the comparison,
// not regenerated or overwritten; this is a bounded regression run, not an A/B trial.
async function main() {
  if (Deno.args.some(arg => arg !== '--execute')) throw new Error('Unknown argument');
  if (ANALYSIS_PROMPT_VERSION !== 'analysis-2026-09-09.4') throw new Error('Prompt drift');
  const fixtures = validate(corpus);
  const metadata = { model: MODEL, promptVersion: ANALYSIS_PROMPT_VERSION, cap: 12, fixtures,
    comparison: 'doc_web_interne/docs/qa/ti559-completion-evaluation-2026-09-09/results.json (after)',
    acceptance: 'Review all twelve cases against source facts and uncertainty; no diagnosis, predictions, leading questions or invented emotions. Artistic imagery is not factual evidence.' };
  if (!Deno.args.includes('--execute')) { console.log(JSON.stringify(metadata)); return; }
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) throw new Error('Missing key; no calls');
  await Deno.mkdir(OUTPUT, { mode: 0o700 }); // Exclusive: never restart a consumed run.
  Deno.env.set('GEMINI_MODEL', MODEL);
  Deno.env.set('GEMINI_FALLBACK_MODEL', MODEL);
  let slot = 0, requests = 0;
  const results: Record<string, unknown>[] = [];
  const save = () => atomicWriteJson(`${OUTPUT}/results.json`, { ...metadata, requests, results });
  const originalFetch = globalThis.fetch;
  let current: Record<string, unknown>;
  globalThis.fetch = guardedFetch(async (input, init) => {
    const request = new Request(input, init);
    const body = await request.clone().json();
    if (body.model !== MODEL || body.store !== false || body.generation_config?.thinking_level !== 'low' || body.generation_config?.max_output_tokens !== 4096) throw new Error('Request contract drift');
    current.request = body; // Synthetic corpus only; never store headers or API key.
    await save();
    const response = await originalFetch(request);
    current.httpStatus = response.status;
    if (response.ok) {
      const raw = await response.clone().json();
      current.usage = raw.usage ?? null;
      current.rawText = (raw.steps ?? []).filter((s: any) => s.type === 'model_output').flatMap((s: any) => s.content ?? []).filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
    }
    await save();
    return response;
  }, async (count, currentSlot) => {
    if (count > 12) throw new Error('Budget exceeded');
    requests = count;
    await atomicWriteJson(`${OUTPUT}/request-count.json`, { requests, slot: currentSlot, cap: 12, model: MODEL });
  }, () => slot);
  try {
    await save();
    for (const fixture of fixtures) {
      slot++;
      const bounded = boundTranscriptForPrompt(fixture.transcript);
      current = { id: fixture.id, slot, truncated: bounded.truncated, promptTranscript: bounded.text, status: 'pending' };
      results.push(current);
      const start = performance.now();
      current.rendered = await runDreamAnalysis({ apiKey, transcript: bounded.text, lang: fixture.lang, route: 'ti559-compact-evaluation', truncatedForPrompt: bounded.truncated });
      current.milliseconds = Math.round(performance.now() - start);
      current.status = 'complete';
      await save();
      console.log(JSON.stringify({ id: fixture.id, saved: true }));
    }
  } catch {
    await save();
    console.error('Evaluation stopped; evidence preserved. No repeat dispatch or fallback.');
    Deno.exitCode = 1;
  } finally { globalThis.fetch = originalFetch; }
}
if (import.meta.main) await main();
