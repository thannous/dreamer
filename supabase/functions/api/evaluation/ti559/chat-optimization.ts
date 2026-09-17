/** Paired replay: same historical inputs and corrected policy, only thinking level changes. */
import { requestGeminiStream, type GeminiPart } from '../../services/gemini.ts';
import { buildChatSystem, buildChatHistory } from '../../services/chatContext.ts';
import { buildDreamContextPrompt } from '../../lib/prompts.ts';
import { atomicWriteJson, budgetedFetch } from './core.ts';
const output = '/private/tmp/ti559-chat-optimization-run';
if (Deno.args.some(x => x !== '--execute' && x !== `--output=${output}`)) throw new Error('Unknown argument.');
const baseline = JSON.parse(await Deno.readTextFile('doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json'));
const checkpoints = [1, 5, 10, 15, 19, 20];
if (baseline.results.length !== 20) throw new Error('Expected complete baseline.');
if (!Deno.args.includes('--execute')) { console.log(JSON.stringify({ output, checkpoints, models: ['gemini-3.5-flash-lite'], levels: ['low', 'minimal'], cap: 12 })); Deno.exit(0); }
const key = Deno.env.get('GEMINI_API_KEY');
if (!key) throw new Error('Missing key.');
await Deno.mkdir(output, { mode: 0o700 });
const original = globalThis.fetch;
globalThis.fetch = budgetedFetch(original, async requests => atomicWriteJson(`${output}/request-count.json`, { requests, model: 'gemini-3.5-flash-lite' }));
const results: unknown[] = [];
const preparedInputs: Record<string, unknown> = {};
let minimalUnavailable = false;
try {
  for (const [index, checkpoint] of checkpoints.entries()) {
    const history: { role: 'user' | 'model'; text: string; parts: GeminiPart[] }[] = [];
    for (const previous of baseline.results.filter((r: any) => r.turn < checkpoint)) {
      history.push({ role: 'user', text: previous.message, parts: [{ text: previous.message }] });
      history.push({ role: 'model', text: previous.text, parts: [{ text: previous.text }] });
    }
    const message = baseline.results.find((r: any) => r.turn === checkpoint).message;
    history.push({ role: 'user', text: message, parts: [{ text: message }] });
    const prepared = buildChatHistory(history);
    const context = buildDreamContextPrompt({ transcript: baseline.fixtures[0].transcript, title: '', interpretation: '', shareable_quote: '', dream_type: 'Unknown' }, 'fr').prompt;
    const contents = [
      { role: 'user' as const, parts: [{ text: context }] },
      ...(prepared.olderUserNotes ? [{ role: 'user' as const, parts: [{ text: prepared.olderUserNotes }] }] : []),
      ...prepared.recentMessages.map(m => ({ role: m.role, parts: m.parts?.length ? m.parts : [{ text: m.text ?? '' }] })),
    ];
    preparedInputs[checkpoint] = { contents, system: buildChatSystem('fr'), model: 'gemini-3.5-flash-lite', maxOutputTokens: 2048 };
    await atomicWriteJson(`${output}/inputs.json`, { baseline: 'bbcfd7283', preparedInputs });
    const levels = index % 2 === 0 ? ['low', 'minimal'] as const : ['minimal', 'low'] as const;
    for (const level of levels) {
      if (level === 'minimal' && minimalUnavailable) continue;
      const start = performance.now();
      let firstTextMs: number | null = null;
      let text = '';
      let final: any = null;
      try {
        const events = await requestGeminiStream({ apiKey: key, model: 'gemini-3.5-flash-lite', contents, systemInstruction: buildChatSystem('fr'), config: { thinkingLevel: level, maxOutputTokens: 2048 } });
        for await (const event of events) {
          if (event?.event_type === 'step.delta' && event?.delta?.type === 'text' && typeof event.delta.text === 'string') {
            if (firstTextMs === null && event.delta.text.trim()) firstTextMs = Math.round(performance.now() - start);
            text += event.delta.text;
          }
          if (event?.event_type === 'interaction.completed') final = event.interaction;
        }
        results.push({ checkpoint, level, firstTextMs, totalMs: Math.round(performance.now() - start), text, completed: !!final, usage: final?.usage ?? null });
        await atomicWriteJson(`${output}/results.json`, { checkpoints, results });
        if (!final || !text.trim()) throw new Error('Incomplete stream');
        console.log(JSON.stringify({ checkpoint, level, firstTextMs }));
      } catch (error) {
        const status = typeof (error as any)?.status === 'number' ? (error as any).status : null;
        results.push({ checkpoint, level, failed: true, status, text, firstTextMs });
        await atomicWriteJson(`${output}/results.json`, { checkpoints, results });
        if (level === 'minimal' && status === 400) { minimalUnavailable = true; console.log('Minimal rejected (400); remaining minimal calls skipped.'); }
        else throw new Error('Probe stopped; no automatic retry.');
      }
    }
  }
} finally { globalThis.fetch = original; }
