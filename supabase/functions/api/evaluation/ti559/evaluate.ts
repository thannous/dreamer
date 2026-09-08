/** Synthetic-only, paired prompt evaluation. Default is a no-generation preview. */
import { aiLanguageName, localizedForAi } from '../../lib/aiLanguage.ts';
import { buildAnalysisPrompt, REFLECTION_POLICY, ANALYSIS_PROMPT_VERSION } from '../../services/dreamAnalysis.ts';
import { ANALYZE_DREAM_SCHEMA } from '../../lib/schemas.ts';
import { callGeminiWithFallback, GEMINI_FLASH_MODEL, resolveTextModel } from '../../services/gemini.ts';
import { ANALYSIS_SYSTEM_INSTRUCTIONS as beforeSystem, buildAnalysisPrompt as beforePrompt } from './baseline.ts';
import { ANALYZE_DREAM_SCHEMA as beforeSchema } from './baseline-schema.ts';

import { validateFixtures, planPairs, preserveResponse, budgetedFetch, atomicWriteJson } from './core.ts';

const fixtures = validateFixtures(JSON.parse(await Deno.readTextFile(new URL('./fixtures.json', import.meta.url))));
const plan = planPairs(fixtures);
const model = resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL);
const execute = Deno.args.includes('--execute');
const output = Deno.args.find((x) => x.startsWith('--output='))?.slice(9);
console.log(JSON.stringify({ model, calls: 12, execute, cases: plan.map(({ fixture, versions }) => ({ id: fixture.id, kind: fixture.kind, versions })), promptVersion: ANALYSIS_PROMPT_VERSION }));
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
globalThis.fetch = budgetedFetch(realFetch, async (requests) => {
  await atomicWriteJson(`${output}/request-count.json`, { requests, model });
});
const results: unknown[] = [];
try {
  for (const { fixture, versions } of plan) {
    for (const version of versions) {
      const before = version === 'before';
      const prompt = (before ? beforePrompt : buildAnalysisPrompt)(fixture.transcript, aiLanguageName(fixture.lang));
      const system = before ? localizedForAi(fixture.lang, beforeSystem) : `${afterSystem[fixture.lang]} ${REFLECTION_POLICY}`;
      const start = performance.now();
      // Identical model for both sides; identical fallback disables fallback generations.
      const { text, raw } = await callGeminiWithFallback(key, model, model,
        [{ role: 'user', parts: [{ text: prompt }] }], system,
        { responseMimeType: 'application/json', responseJsonSchema: before ? beforeSchema : ANALYZE_DREAM_SCHEMA, thinkingLevel: 'low', maxOutputTokens: 4096 });
      const slot = results.length;
      await preserveResponse({ id: fixture.id, version, model, milliseconds: Math.round(performance.now() - start),
        rawText: text, usage: raw.usage ?? raw.usage_metadata ?? null }, async (evidence) => {
        results[slot] = evidence;
        await atomicWriteJson(`${output}/results.json`, { promptVersion: ANALYSIS_PROMPT_VERSION, baseline: 'd2bc25936', results });
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
