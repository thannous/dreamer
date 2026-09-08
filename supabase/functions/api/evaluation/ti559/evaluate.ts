/** Synthetic-only, paired prompt evaluation. Default is a no-generation preview. */
import { aiLanguageName, localizedForAi } from '../../lib/aiLanguage.ts';
import { buildAnalysisPrompt, REFLECTION_POLICY, ANALYSIS_PROMPT_VERSION } from '../../services/dreamAnalysis.ts';
import { ANALYZE_DREAM_SCHEMA } from '../../lib/schemas.ts';
import { callGeminiWithFallback, GEMINI_FLASH_MODEL, resolveTextModel } from '../../services/gemini.ts';
import { ANALYSIS_SYSTEM_INSTRUCTIONS as beforeSystem, buildAnalysisPrompt as beforePrompt } from './baseline.ts';
import { ANALYZE_DREAM_SCHEMA as beforeSchema } from './baseline-schema.ts';

const fixtures = JSON.parse(await Deno.readTextFile(new URL('./fixtures.json', import.meta.url)));
if (fixtures.length !== 6 || new Set(fixtures.map((x: { lang: string }) => x.lang)).size !== 6) {
  throw new Error('Expected exactly six synthetic multilingual cases.');
}
const model = resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL);
const execute = Deno.args.includes('--execute');
const output = Deno.args.find((x) => x.startsWith('--output='))?.slice(9);
console.log(JSON.stringify({ model, calls: 12, execute, cases: fixtures.map((x: { id: string }) => x.id), promptVersion: ANALYSIS_PROMPT_VERSION }));
if (!execute) Deno.exit(0);
const key = Deno.env.get('GEMINI_API_KEY');
if (!key) throw new Error('GEMINI_API_KEY is unavailable. No generations started.');
if (!output) throw new Error('Supply --output=/private/tmp/a-new-ti559-evaluation-directory');
// A new directory prevents accidentally repeating the same paid experiment.
await Deno.mkdir(output, { mode: 0o700 });
const source = await Deno.readTextFile(new URL('../../services/dreamAnalysis.ts', import.meta.url));
const systemBlock = source.match(/const ANALYSIS_SYSTEM_INSTRUCTIONS[^=]*= \{([\s\S]*?)\n\};/)?.[1];
if (!systemBlock) throw new Error('Cannot resolve current system instructions; review harness for source drift.');
const afterSystem = Object.fromEntries([...systemBlock.matchAll(/\s*(en|fr|es|de|it|pt): '([^'\n]*)',/g)].map((m) => [m[1], m[2]]));
if (Object.keys(afterSystem).length !== 6) throw new Error('Cannot safely resolve all current system instructions.');
const realFetch = globalThis.fetch;
let requests = 0;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== 'generativelanguage.googleapis.com') throw new Error('Unexpected provider endpoint blocked.');
  if (++requests > 12) throw new Error('Hard limit of 12 provider HTTP requests reached.');
  await Deno.writeTextFile(`${output}/request-count.json`, JSON.stringify({ requests, model }), { mode: 0o600 });
  return realFetch(input, init);
};
const results: unknown[] = [];
try {
  for (const [index, fixture] of fixtures.entries()) {
    // Alternate order to reduce a systematic before-first timing bias.
    for (const version of index % 2 ? ['after', 'before'] : ['before', 'after']) {
      const before = version === 'before';
      const prompt = (before ? beforePrompt : buildAnalysisPrompt)(fixture.transcript, aiLanguageName(fixture.lang));
      const system = before ? localizedForAi(fixture.lang, beforeSystem) : `${afterSystem[fixture.lang]} ${REFLECTION_POLICY}`;
      const start = performance.now();
      // Identical model for both sides; identical fallback disables fallback generations.
      const { text, raw } = await callGeminiWithFallback(key, model, model,
        [{ role: 'user', parts: [{ text: prompt }] }], system,
        { responseMimeType: 'application/json', responseJsonSchema: before ? beforeSchema : ANALYZE_DREAM_SCHEMA, thinkingLevel: 'low', maxOutputTokens: 4096 });
      const parsed = JSON.parse(text);
      results.push({ id: fixture.id, version, model, milliseconds: Math.round(performance.now() - start),
        interpretationWords: String(parsed.interpretation ?? '').trim().split(/\s+/u).filter(Boolean).length,
        response: parsed, usage: raw.usage ?? raw.usage_metadata ?? null });
      await Deno.writeTextFile(`${output}/results.json`, JSON.stringify({ promptVersion: ANALYSIS_PROMPT_VERSION, baseline: 'd2bc25936', results }, null, 2), { mode: 0o600 });
      console.log(`${fixture.id} ${version}: saved`);
    }
  }
} catch {
  // SDK errors may include request details. Keep console output categorical.
  console.error('Evaluation stopped; inspect saved synthetic results and request count. No automatic rerun.');
  Deno.exitCode = 1;
} finally {
  globalThis.fetch = realFetch;
}
