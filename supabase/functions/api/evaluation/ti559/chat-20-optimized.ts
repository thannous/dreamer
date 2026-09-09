/** Fresh, bounded 20-exchange conversation: only user fixtures come from the baseline. */
import { requestGeminiStream, extractModelParts, type GeminiPart } from '../../services/gemini.ts';
import { buildChatSystem, buildChatHistory, MAX_RECENT_CHAT_MESSAGES, MAX_OLDER_CHAT_NOTES_CHARS } from '../../services/chatContext.ts';
import { buildDreamContextPrompt } from '../../lib/prompts.ts';
import { atomicWriteJson } from './core.ts';

const outputName = 'ti559-chat20-optimized-run';
function isSafeLauncherOutput(requested: string): boolean {
  if (!requested || requested.includes('..') || requested.endsWith('/') || requested.endsWith('\\')) return false;
  if (requested.split(/[\\/]/u).pop() !== outputName) return false;
  return requested.startsWith('/') || /^[A-Za-z]:[\\/]/u.test(requested);
}
function resolveOutput(args: string[]): string {
  const requested = args.find((arg) => arg.startsWith('--output='))?.slice(9);
  if (args.some((arg) => arg !== '--execute' && !arg.startsWith('--output='))) throw new Error('Unknown argument.');
  if (requested) {
    if (!isSafeLauncherOutput(requested)) throw new Error('Output does not match the platform temp directory.');
    return requested;
  }
  if (args.includes('--execute')) throw new Error('Execute requires --output under the platform temp directory.');
  throw new Error('Preview requires --output from the launcher.');
}
const output = resolveOutput(Deno.args);
const model = 'gemini-3.5-flash-lite';
const source = 'doc_web_interne/docs/qa/ti559-chat20-2026-09-09/results.json';
const baseline = JSON.parse(await Deno.readTextFile(source));
const fixture = baseline.fixtures?.[0];
if (baseline.fixtures?.length !== 1 || typeof fixture?.transcript !== 'string' || !Array.isArray(fixture.turns) || fixture.turns.length !== 20 || fixture.turns.some((t: unknown) => typeof t !== 'string' || !t.trim())) throw new Error('Expected one synthetic 20-turn fixture.');
const system = buildChatSystem('fr');
const context = buildDreamContextPrompt({ transcript: fixture.transcript, title: '', interpretation: '', shareable_quote: '', dream_type: 'Unknown' }, 'fr').prompt;
if (!Deno.args.includes('--execute')) {
  console.log(JSON.stringify({ output, source, model, thinkingLevel: 'minimal', maxOutputTokens: 2048, requestCap: 20, fixtures: [fixture], freshConversation: true, store: false, recentMessageCap: MAX_RECENT_CHAT_MESSAGES, olderNotesCharCap: MAX_OLDER_CHAT_NOTES_CHARS }));
  Deno.exit(0);
}
const key = Deno.env.get('GEMINI_API_KEY');
if (!key) throw new Error('Missing key; no calls.');
// Existing evidence must never be overwritten or resumed into another paid run.
await Deno.mkdir(output, { mode: 0o700 });
let requests = 0;
let dispatchedTurn = 0;
let currentTurn = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== 'https:' || url.hostname !== 'generativelanguage.googleapis.com' || requests >= 20 || currentTurn <= dispatchedTurn) throw new Error('Provider, retry or budget blocked.');
  dispatchedTurn = currentTurn;
  requests++;
  await atomicWriteJson(`${output}/request-count.json`, { requests, dispatchedTurn, model, cap: 20 });
  return originalFetch(input, init);
};
const history: { role: 'user' | 'model'; text: string; parts: GeminiPart[] }[] = [];
const results: Record<string, unknown>[] = [];
const inputs: Record<string, unknown>[] = [];
const save = () => atomicWriteJson(`${output}/results.json`, { model, thinkingLevel: 'minimal', maxOutputTokens: 2048, store: false, freshConversation: true, fixtures: [fixture], requests, results });
try {
  await save();
  for (const [index, message] of (fixture.turns as string[]).entries()) {
    currentTurn = index + 1;
    history.push({ role: 'user', text: message, parts: [{ text: message }] });
    const prepared = buildChatHistory(history);
    const notesChars = prepared.olderUserNotes?.length ?? 0;
    if (prepared.recentMessages.length > MAX_RECENT_CHAT_MESSAGES || notesChars > MAX_OLDER_CHAT_NOTES_CHARS) throw new Error('Context bounds exceeded.');
    const contents = [
      { role: 'user' as const, parts: [{ text: context }] },
      ...(prepared.olderUserNotes ? [{ role: 'user' as const, parts: [{ text: prepared.olderUserNotes }] }] : []),
      ...prepared.recentMessages.map(m => ({ role: m.role, parts: m.parts })),
    ];
    inputs.push({ turn: currentTurn, contents: contents.map(content => ({ ...content, parts: content.parts.map(part => part.thought ? { thought: true, signatureRedacted: true } : { text: part.text ?? '' }) })), system, model, thinkingLevel: 'minimal', maxOutputTokens: 2048 });
    await atomicWriteJson(`${output}/inputs.json`, { source, inputs });
    const start = performance.now();
    let firstTextMs: number | null = null;
    let text = '';
    let completed: any = null;
    let thoughtSteps = 0;
    let thoughtSignatureDeltas = 0;
    let failureStatus: number | null = null;
    let failed = false;
    try {
      const stream = await requestGeminiStream({ apiKey: key, model, contents, systemInstruction: system, config: { thinkingLevel: 'minimal', maxOutputTokens: 2048 } });
      for await (const event of stream) {
        if (event?.event_type === 'step.delta' && event?.delta?.type === 'thought_signature') thoughtSignatureDeltas++;
        if (event?.event_type === 'step.start' && event?.step?.type === 'thought') thoughtSteps++;
        if (event?.event_type === 'step.delta' && event?.delta?.type === 'text' && typeof event.delta.text === 'string') {
          if (firstTextMs === null && event.delta.text.trim()) firstTextMs = Math.round(performance.now() - start);
          text += event.delta.text;
        }
        if (event?.event_type === 'interaction.completed') completed = event.interaction;
      }
    } catch (error) {
      failed = true;
      failureStatus = typeof (error as { status?: unknown })?.status === 'number' ? (error as { status: number }).status : null;
    }
    const parts = completed ? extractModelParts(completed) : [];
    thoughtSteps = Math.max(thoughtSteps, completed?.steps?.filter((s: any) => s.type === 'thought').length ?? 0);
    const valid = !failed && !!completed && (!completed.status || completed.status === 'completed') && !!text.trim() && firstTextMs !== null;
    results.push({ turn: currentTurn, message, firstTextMs, totalMs: Math.round(performance.now() - start), text, completed: valid, failed, failureStatus, usage: completed?.usage ?? null, thoughtSteps, thoughtSignatureDeltas, extractedPartsCount: parts.length, usedTextFallback: parts.length === 0, recentMessages: prepared.recentMessages.length, olderNotesChars: notesChars, olderUserNotes: prepared.olderUserNotes ? JSON.parse(prepared.olderUserNotes) : null });
    await save();
    if (!valid) throw new Error('Incomplete stream; no retry.');
    history.push({ role: 'model', text, parts: parts.length ? parts : [{ text }] });
    console.log(JSON.stringify({ turn: currentTurn, firstTextMs, thoughtSteps }));
  }
} catch {
  console.error('Probe stopped; inspect preserved synthetic evidence. No retry or fallback.');
  Deno.exitCode = 1;
} finally { globalThis.fetch = originalFetch; }
