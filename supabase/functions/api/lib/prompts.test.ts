import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import { AI_REQUEST_LIMITS } from './aiRequestPolicy.ts';
import {
  DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS,
  boundTranscriptForPrompt,
  resolveStoredTranscriptForAi,
  truncateForPrompt,
} from './prompts.ts';

Deno.test('prompt truncation leaves short transcripts unchanged', () => {
  const source = 'I was flying over a quiet city.';
  assertEquals(truncateForPrompt(source, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS), {
    text: source,
    truncated: false,
  });
  assertEquals(boundTranscriptForPrompt(source), { text: source, truncated: false });
});

Deno.test('prompt copies bound at 6000 characters without mutating the stored source', () => {
  const stored = 'a'.repeat(10_000);
  const bounded = boundTranscriptForPrompt(stored);

  assertEquals(stored.length, 10_000);
  assertEquals(bounded.truncated, true);
  assertEquals(bounded.text.length, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS);
  assertEquals(bounded.text, stored.slice(0, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS));
});

Deno.test('analysis accepts stored transcripts longer than 600 and derives a separate prompt copy', () => {
  const stored = 'x'.repeat(10_000);
  const resolved = resolveStoredTranscriptForAi(stored, AI_REQUEST_LIMITS.transcriptRequestChars);

  assertEquals(resolved.ok, true);
  if (!resolved.ok) return;
  assertEquals(resolved.storedTranscript, stored);
  assertEquals(resolved.storedTranscript.length > 600, true);
  assertEquals(resolved.storedTranscript.length > 1200, true);
  assertEquals(resolved.truncatedForPrompt, true);
  assertEquals(resolved.promptTranscript.length, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS);
  assertEquals(resolved.promptTranscript, stored.slice(0, DREAM_CONTEXT_TRANSCRIPT_MAX_CHARS));
});

Deno.test('analysis rejects empty transcripts and request-abuse payloads without changing a valid stored source', () => {
  assertEquals(resolveStoredTranscriptForAi('   ', AI_REQUEST_LIMITS.transcriptRequestChars).ok, false);
  assertEquals(
    resolveStoredTranscriptForAi(
      'x'.repeat(AI_REQUEST_LIMITS.transcriptRequestChars + 1),
      AI_REQUEST_LIMITS.transcriptRequestChars
    ).ok,
    false
  );

  const accepted = resolveStoredTranscriptForAi('x'.repeat(601), AI_REQUEST_LIMITS.transcriptRequestChars);
  assertEquals(accepted.ok, true);
  if (!accepted.ok) return;
  assertEquals(accepted.storedTranscript.length, 601);
  assertEquals(accepted.promptTranscript.length, 601);
  assertEquals(accepted.truncatedForPrompt, false);
});
