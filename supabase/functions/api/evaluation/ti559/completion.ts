import * as before from './completion-baseline.ts';
import * as after from './completion-candidate.ts';
import { aiLanguageName, AI_LANGUAGES } from '../../lib/aiLanguage.ts';
import { boundTranscriptForPrompt } from '../../lib/prompts.ts';
import { ANALYZE_DREAM_SCHEMA } from '../../lib/schemas.ts';
import { callGeminiWithFallback } from '../../services/gemini.ts';
import { atomicWriteJson } from './core.ts';
export const OUTPUT = '/private/tmp/ti559-completion-evaluation-run';
export const MODEL = 'gemini-3.8-flash';
export function validate(fixtures: any[]) {
  if (!Array.isArray(fixtures) || fixtures.length !== 12 || new Set(fixtures.map(f => f.id)).size !== 12) throw new Error('Expected twelve unique cases');
  for (const f of fixtures) if (!AI_LANGUAGES.includes(f.lang) || typeof f.transcript !== 'string' || !f.transcript.trim() || !Array.isArray(f.observations) || !Array.isArray(f.reportedEmotions)) throw new Error('Invalid fixture');
  if (new Set(fixtures.map(f => f.lang)).size !== 6) throw new Error('Missing language');
  const long = fixtures.find(f => f.id === 'es-long');
  const bounded = boundTranscriptForPrompt(long.transcript);
  if (!bounded.truncated || bounded.text.includes('ZAFIRO_FINAL') || !long.transcript.includes('ZAFIRO_FINAL')) throw new Error('Invalid truncation control');
  return fixtures;
}
export function guardedFetch(fetcher: typeof fetch, reserve: (count: number, slot: number) => Promise<void>, slot: () => number): typeof fetch {
  let count = 0, last = 0;
  return async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const current = slot();
    if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com' || count >= 24 || current <= last || current < 1 || current > 24) throw new Error('Dispatch blocked');
    last = current; count++;
    await reserve(count, current);
    return fetcher(input, init);
  };
}
async function main() {
  if (Deno.args.some(a => a !== '--execute')) throw new Error('Unknown argument');
  if (before.ANALYSIS_PROMPT_VERSION !== 'analysis-2026-09-09.1' || after.ANALYSIS_PROMPT_VERSION !== 'analysis-2026-09-09.2') throw new Error('Prompt drift');
  const fixtures = validate(JSON.parse(await Deno.readTextFile(new URL('./completion-fixtures.json', import.meta.url))));
  const originals = JSON.parse(await Deno.readTextFile(new URL('./followup-fixtures.json', import.meta.url)));
  if (JSON.stringify(fixtures.slice(0, 6)) !== JSON.stringify(originals)) throw new Error('Historical fixture drift');
  const systems: Record<string, Record<string, string>> = {};
  for (const [version, path] of [['before', './completion-baseline.ts'], ['after', './completion-candidate.ts']]) {
    const source = await Deno.readTextFile(new URL(path, import.meta.url));
    const block = source.match(/const ANALYSIS_SYSTEM_INSTRUCTIONS[^=]*= \{([\s\S]*?)\n\};/)?.[1] ?? '';
    systems[version] = Object.fromEntries([...block.matchAll(/\s*(en|fr|es|de|it|pt): '([^'\n]*)',/g)].map(m => [m[1], m[2]]));
    if (Object.keys(systems[version]).length !== 6) throw new Error('System drift');
  }
  const metadata = { model: MODEL, cap: 24, thinkingLevel: 'low', maxOutputTokens: 4096, store: false, schema: ANALYZE_DREAM_SCHEMA, versions: { before: before.ANALYSIS_PROMPT_VERSION, after: after.ANALYSIS_PROMPT_VERSION }, fixtures, rubric: ['grounding', 'uncertainty', 'non-leading questions', 'no diagnosis or invention', 'language', 'perceived usefulness'], acceptance: 'Per-case pass/fail/indeterminate with evidence; serious grounding or wellbeing failure blocks case. No true meaning reference.' };
  if (!Deno.args.includes('--execute')) { console.log(JSON.stringify(metadata)); return; }
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('Missing key; no calls');
  await Deno.mkdir(OUTPUT, { mode: 0o700 });
  let slot = 0, requests = 0;
  const results: any[] = [];
  const save = () => atomicWriteJson(`${OUTPUT}/results.json`, { ...metadata, requests, results });
  const original = globalThis.fetch;
  globalThis.fetch = guardedFetch(original, async (count, current) => { requests = count; await atomicWriteJson(`${OUTPUT}/request-count.json`, { requests, slot: current, cap: 24, model: MODEL }); }, () => slot);
  try {
    await save();
    for (const [i, fixture] of fixtures.entries()) for (const version of (i % 2 ? ['after', 'before'] : ['before', 'after']) as ('before'|'after')[]) {
      slot++;
      const policy = version === 'before' ? before : after;
      const bounded = boundTranscriptForPrompt(fixture.transcript);
      const prompt = policy.buildAnalysisPrompt(bounded.text, aiLanguageName(fixture.lang), bounded.truncated);
      const system = `${systems[version][fixture.lang]} ${policy.REFLECTION_POLICY}`;
      const start = performance.now();
      const { text, raw } = await callGeminiWithFallback(key, MODEL, MODEL, [{ role: 'user', parts: [{ text: prompt }] }], system, { responseMimeType: 'application/json', responseJsonSchema: ANALYZE_DREAM_SCHEMA, thinkingLevel: 'low', maxOutputTokens: 4096 });
      const record: any = { id: fixture.id, version, slot, prompt, system, promptTranscript: bounded.text, truncated: bounded.truncated, milliseconds: Math.round(performance.now()-start), rawText: text, usage: raw.usage ?? null, parseStatus: 'pending' };
      results.push(record); await save();
      try {
        const parsed = JSON.parse(text);
        if (!parsed.title || !parsed.interpretation) throw new Error('Missing required output');
        record.parsed = parsed;
        record.rendered = { ...parsed, interpretation: policy.discloseAnalysisExcerpt(String(parsed.interpretation), fixture.lang, bounded.truncated), shareableQuote: version === 'after' ? after.groundedAnalysisQuote(parsed.shareableQuote, bounded.text) : String(parsed.shareableQuote ?? ''), dreamType: policy.normalizeAnalysisDreamType(parsed.dreamType), ...policy.sanitizeAnalysisDetails(parsed) };
        record.parseStatus = 'valid';
      } catch { record.parseStatus = 'invalid'; await save(); throw new Error('Invalid output; stopped'); }
      await save(); console.log(JSON.stringify({ id: fixture.id, version, saved: true }));
    }
  } catch { console.error('Evaluation stopped; preserved evidence. No retry or fallback.'); Deno.exitCode = 1; }
  finally { globalThis.fetch = original; }
}
if (import.meta.main) await main();
