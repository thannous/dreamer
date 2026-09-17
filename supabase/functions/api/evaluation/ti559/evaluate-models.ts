/** Synthetic-only, paired model evaluation. Default is a no-generation preview. */
import { aiLanguageName } from '../../lib/aiLanguage.ts';
import { buildAnalysisPrompt, REFLECTION_POLICY, ANALYSIS_PROMPT_VERSION } from '../../services/dreamAnalysis.ts';
import { ANALYZE_DREAM_SCHEMA } from '../../lib/schemas.ts';
import { callGeminiWithFallback } from '../../services/gemini.ts';
const MODELS = { before: 'gemini-3.7-flash', after: 'gemini-3.8-flash' } as const;

import { validateFixtures, planPairs, preserveResponse, budgetedFetch, atomicWriteJson } from './core.ts';

if (ANALYSIS_PROMPT_VERSION !== 'analysis-2026-09-09.1') throw new Error('Review prompt drift before model comparison.');
const fixtures = validateFixtures(JSON.parse(await Deno.readTextFile(new URL('./followup-fixtures.json', import.meta.url))), 'followup');
const plan = planPairs(fixtures);
const execute = Deno.args.includes('--execute');
const output = '/private/tmp/ti559-gemini38-evaluation-run';
if (Deno.args.some((arg) => arg !== '--execute' && arg !== `--output=${output}`)) throw new Error('Unknown comparison argument.');
console.log(JSON.stringify({ models: MODELS, output, calls: 12, execute, promptVersion: ANALYSIS_PROMPT_VERSION, cases: plan.map(({ fixture, versions }) => ({ id: fixture.id, versions })) }));
if (!execute) Deno.exit(0);
const key = Deno.env.get('GEMINI_API_KEY');
if (!key) throw new Error('GEMINI_API_KEY is unavailable. No generations started.');
// A new directory prevents accidentally repeating the same paid experiment.
await Deno.mkdir(output, { mode: 0o700 });
const source = await Deno.readTextFile(new URL('../../services/dreamAnalysis.ts', import.meta.url));
const systemBlock = source.match(/const ANALYSIS_SYSTEM_INSTRUCTIONS[^=]*= \{([\s\S]*?)\n\};/)?.[1];
if (!systemBlock) throw new Error('Cannot resolve current system instructions; review harness for source drift.');
const afterSystem = Object.fromEntries([...systemBlock.matchAll(/\s*(en|fr|es|de|it|pt): '([^'\n]*)',/g)].map((m) => [m[1], m[2]]));
if (Object.keys(afterSystem).length !== 6) throw new Error('Cannot safely resolve all current system instructions.');
const realFetch = globalThis.fetch;
globalThis.fetch = budgetedFetch(realFetch, async (requests) => {
  await atomicWriteJson(`${output}/request-count.json`, { requests, models: MODELS, suite: 'gemini38' });
});
const results: unknown[] = [];
try {
  for (const { fixture, versions } of plan) {
    for (const version of versions) {
      const model = MODELS[version];
      const prompt = buildAnalysisPrompt(fixture.transcript, aiLanguageName(fixture.lang));
      const system = `${afterSystem[fixture.lang]} ${REFLECTION_POLICY}`;
      const start = performance.now();
      // Each side uses its fixed model as both primary and fallback, disabling fallback generations.
      const { text, raw } = await callGeminiWithFallback(key, model, model,
        [{ role: 'user', parts: [{ text: prompt }] }], system,
        { responseMimeType: 'application/json', responseJsonSchema: ANALYZE_DREAM_SCHEMA, thinkingLevel: 'low', maxOutputTokens: 4096 });
      const slot = results.length;
      await preserveResponse({ id: fixture.id, version, model, milliseconds: Math.round(performance.now() - start),
        rawText: text, usage: raw.usage ?? raw.usage_metadata ?? null }, async (evidence) => {
        results[slot] = evidence;
        await atomicWriteJson(`${output}/results.json`, { suite: 'gemini38', promptVersion: ANALYSIS_PROMPT_VERSION, models: MODELS, results });
      });
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
