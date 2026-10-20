/**
 * Synthetic-only comparison of candidate analysis and illustration models
 * (October 2026). Default is a no-generation preview; `--execute` spends a
 * fixed budget of 15 provider requests and never retries.
 *
 * Analysis: the production prompt, system instruction and JSON schema, sent to
 * gemini-3.8-flash (current), gemini-3.5-flash-lite and claude-haiku-5-5.
 * Illustration: the current Gemini analysis image prompt, rendered at 1K 9:16
 * by gemini-3.1-flash-lite-image (current) and gemini-nano-banana-2.1, both
 * with minimal thinking.
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.132.1';
import { aiLanguageName } from '../../lib/aiLanguage.ts';
import { ANALYZE_DREAM_SCHEMA, withoutArrayBounds } from '../../lib/schemas.ts';
import {
  ANALYSIS_PROMPT_VERSION,
  analysisSystemInstruction,
  buildAnalysisPrompt,
  keepAcceptedQuoteExcerpts,
  normalizeDreamAnalysis,
} from '../../services/dreamAnalysis.ts';
import {
  extractInteractionImage,
  extractText,
  requestGeminiGenerateContent,
} from '../../services/gemini.ts';
import { atomicWriteJson, validateFixtures } from '../ti559/core.ts';
import { arrayBoundViolations } from './bounds.ts';

const TEXT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'claude-haiku-5-5'] as const;
const IMAGE_MODELS = ['gemini-3.1-flash-lite-image', 'gemini-nano-banana-2.1'] as const;
// Three of the six synthetic accounts, so each text model starts first once.
const FIXTURE_IDS = ['fr-rich', 'en-nightmare-short', 'es-diagnosis-short'];
const MAX_REQUESTS = 15;
const ALLOWED_HOSTS = new Set(['generativelanguage.googleapis.com', 'api.anthropic.com']);

type TextModel = typeof TEXT_MODELS[number];
type ImageModel = typeof IMAGE_MODELS[number];

/** Rotate the start model per fixture so no model always runs first. */
export const rotate = <T>(items: readonly T[], offset: number): T[] =>
  items.map((_, index) => items[(index + offset) % items.length]);

const parseArgs = (args: string[]) => {
  const execute = args.includes('--execute');
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  if (args.some((arg) => arg !== '--execute' && arg !== outputArg)) {
    throw new Error('Usage: compare.ts [--execute --output=<new directory>]');
  }
  if (execute && !outputArg?.slice('--output='.length)) throw new Error('--execute requires --output=<new directory>.');
  return { execute, output: outputArg?.slice('--output='.length) };
};

if (import.meta.main) {
  const { execute, output } = parseArgs(Deno.args);
  const fixtures = validateFixtures(
    JSON.parse(await Deno.readTextFile(new URL('../ti559/followup-fixtures.json', import.meta.url))),
    'followup'
  ).filter((fixture) => FIXTURE_IDS.includes(fixture.id))
    .sort((a, b) => FIXTURE_IDS.indexOf(a.id) - FIXTURE_IDS.indexOf(b.id));
  console.log(JSON.stringify({
    promptVersion: ANALYSIS_PROMPT_VERSION,
    textModels: TEXT_MODELS,
    imageModels: IMAGE_MODELS,
    requests: fixtures.length * (TEXT_MODELS.length + IMAGE_MODELS.length),
    cap: MAX_REQUESTS,
    fixtures: fixtures.map((fixture, index) => ({ id: fixture.id, order: rotate(TEXT_MODELS, index) })),
    execute,
    output: output ?? null,
  }));
  if (!execute || !output) Deno.exit(0);

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!geminiKey || !anthropicKey) throw new Error('GEMINI_API_KEY and ANTHROPIC_API_KEY are required. Nothing was sent.');
  // A new directory prevents accidentally repeating the same paid run.
  await Deno.mkdir(output, { mode: 0o700 });
  await Deno.mkdir(`${output}/images`, { mode: 0o700 });

  let requests = 0;
  const realFetch = globalThis.fetch;
  const budgeted: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) throw new Error('Unexpected provider endpoint blocked.');
    if (requests >= MAX_REQUESTS) throw new Error(`Hard limit of ${MAX_REQUESTS} provider requests reached.`);
    requests += 1;
    await atomicWriteJson(`${output}/request-count.json`, { requests, cap: MAX_REQUESTS });
    return realFetch(input, init);
  };
  globalThis.fetch = budgeted;
  // Explicit base URL: a local ANTHROPIC_BASE_URL must never receive this key.
  const anthropic = new Anthropic({
    apiKey: anthropicKey,
    baseURL: 'https://api.anthropic.com',
    maxRetries: 0,
    // Node and Deno fetch typings differ; the runtime function is the same.
    fetch: budgeted as any,
  });

  const results: Record<string, unknown>[] = [];
  const save = () => atomicWriteJson(`${output}/results.json`, {
    promptVersion: ANALYSIS_PROMPT_VERSION, textModels: TEXT_MODELS, imageModels: IMAGE_MODELS, results,
  });

  const analyze = async (model: TextModel, system: string, prompt: string) => {
    if (model === 'claude-haiku-5-5') {
      const response = await anthropic.messages.create({
        model,
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'adaptive' },
        output_config: {
          effort: 'low',
          format: { type: 'json_schema', schema: withoutArrayBounds(ANALYZE_DREAM_SCHEMA) as Record<string, unknown> },
        },
      } as any) as any;
      const text = (response.content ?? [])
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('');
      return { text, usage: response.usage ?? null, stopReason: response.stop_reason ?? null };
    }
    const raw = await requestGeminiGenerateContent({
      apiKey: geminiKey,
      model,
      // One HTTP request per cell, as for Claude: retries would skew latency and the budget.
      maxRetries: 0,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: system,
      // Production analysis settings.
      config: { responseMimeType: 'application/json', responseJsonSchema: ANALYZE_DREAM_SCHEMA, thinkingLevel: 'low', maxOutputTokens: 4096 },
    });
    return { text: extractText(raw), usage: raw?.usage ?? null, stopReason: raw?.status ?? null };
  };

  const illustrate = async (model: ImageModel, prompt: string) => {
    // Image requests run at minimal thinking, as in production.
    const raw = await requestGeminiGenerateContent({
      apiKey: geminiKey,
      model,
      // One HTTP request per cell, as for Claude: retries would skew latency and the budget.
      maxRetries: 0,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16', imageSize: '1K' } },
    });
    return { image: extractInteractionImage(raw), usage: raw?.usage ?? null, status: raw?.status ?? null };
  };

  try {
    for (const [index, fixture] of fixtures.entries()) {
      const system = analysisSystemInstruction(fixture.lang);
      const prompt = buildAnalysisPrompt(fixture.transcript, aiLanguageName(fixture.lang));
      let imagePrompt = '';
      for (const model of rotate(TEXT_MODELS, index)) {
        const start = performance.now();
        const slot = results.push({ kind: 'analysis', id: fixture.id, model, status: 'pending' }) - 1;
        await save();
        try {
          const { text, usage, stopReason } = await analyze(model, system, prompt);
          const milliseconds = Math.round(performance.now() - start);
          let response: unknown = null;
          try { response = JSON.parse(text); } catch { /* kept as rawText */ }
          // Score what the app would show, with production's clamping (excerpts kept to three,
          // other arrays truncated by normalization). Arrays over the schema bounds Claude was
          // not sent are recorded, not failed, since the app delivers them clamped.
          const boundViolations = arrayBoundViolations(ANALYZE_DREAM_SCHEMA, response);
          let delivered: unknown = null;
          let status = response ? 'valid' : 'invalid (JSON)';
          try {
            if (response) delivered = normalizeDreamAnalysis(keepAcceptedQuoteExcerpts(response as Record<string, unknown>), { transcript: fixture.transcript, lang: fixture.lang });
          } catch {
            status = 'invalid (missing title or interpretation)';
          }
          // Production falls back to Gemini on any other Claude stop, so users never see these.
          if (model.startsWith('claude-') && stopReason !== 'end_turn') status = `invalid (stop: ${stopReason})`;
          results[slot] = { kind: 'analysis', id: fixture.id, model, milliseconds, stopReason, usage, rawText: text, response, delivered, boundViolations, status };
          // Render only a prompt production would have kept.
          if (model === 'gemini-3.8-flash' && status === 'valid') imagePrompt = (delivered as { imagePrompt: string }).imagePrompt;
        } catch (error) {
          results[slot] = { kind: 'analysis', id: fixture.id, model, status: 'error', error: String((error as any)?.status ?? 'request failed') };
        }
        await save();
        console.log(`${fixture.id} ${model}: ${(results[slot] as any).status}`);
      }
      if (!imagePrompt) {
        results.push({ kind: 'image', id: fixture.id, status: 'skipped (no valid gemini-3.8-flash analysis)' });
        await save();
        continue;
      }
      for (const model of rotate(IMAGE_MODELS, index)) {
        const start = performance.now();
        const slot = results.push({ kind: 'image', id: fixture.id, model, imagePrompt, status: 'pending' }) - 1;
        await save();
        try {
          const { image, usage, status } = await illustrate(model, imagePrompt);
          const milliseconds = Math.round(performance.now() - start);
          let file: string | null = null;
          if (image.data) {
            const extension = image.mimeType === 'image/jpeg' ? 'jpg' : 'png';
            file = `images/${fixture.id}--${model}.${extension}`;
            const bytes = Uint8Array.from(atob(image.data), (c) => c.charCodeAt(0));
            await Deno.writeFile(`${output}/${file}`, bytes, { mode: 0o600, createNew: true });
          }
          results[slot] = { kind: 'image', id: fixture.id, model, imagePrompt, milliseconds, usage, file, status: file ? 'valid' : `no image (${status})` };
        } catch (error) {
          results[slot] = { kind: 'image', id: fixture.id, model, imagePrompt, status: 'error', error: String((error as any)?.status ?? 'request failed') };
        }
        await save();
        console.log(`${fixture.id} ${model}: ${(results[slot] as any).status}`);
      }
    }
  } finally {
    globalThis.fetch = realFetch;
  }
  // An incomplete comparison must not read as a successful run.
  const incomplete = results.filter((result) => result.status !== 'valid');
  console.log(`${results.length - incomplete.length}/${results.length} cells valid, ${requests} requests.`);
  if (incomplete.length) Deno.exitCode = 1;
}
