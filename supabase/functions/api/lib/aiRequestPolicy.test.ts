import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  isValidClientRequestId,
  isValidUuid,
  normalizeAiLanguage,
  parseDreamTextInput,
  validateBoundedText,
} from './aiRequestPolicy.ts';
import { boundTranscriptForPrompt } from './prompts.ts';

Deno.test('bounded AI text rejects oversized input with a stable 413 payload', async () => {
  const validation = validateBoundedText('x'.repeat(AI_REQUEST_LIMITS.transcriptChars + 1), {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptChars,
  });
  assertEquals(validation.ok, false);
  if (validation.ok) return;

  const response = aiInputErrorResponse(validation);
  assertEquals(response.status, 413);
  assertEquals(await response.json(), {
    error: 'transcript exceeds the allowed size',
    code: 'INPUT_TOO_LARGE',
    field: 'transcript',
    maxChars: 600,
  });
});

Deno.test('stored dream transcripts accept values past 600 and reject only the request-abuse bound', () => {
  const accepted = validateBoundedText('x'.repeat(601), {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptRequestChars,
  });
  assertEquals(accepted, { ok: true, value: 'x'.repeat(601) });

  const longAccepted = validateBoundedText('y'.repeat(10_000), {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptRequestChars,
  });
  assertEquals(longAccepted.ok, true);
  if (longAccepted.ok) {
    assertEquals(longAccepted.value.length, 10_000);
  }

  const rejected = validateBoundedText('z'.repeat(AI_REQUEST_LIMITS.transcriptRequestChars + 1), {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptRequestChars,
  });
  assertEquals(rejected.ok, false);
  if (rejected.ok) return;
  assertEquals(rejected.code, 'INPUT_TOO_LARGE');
  assertEquals(rejected.maxChars, 100_000);
});

Deno.test('synchronous dream input keeps a long stored transcript and derives a bounded AI copy', async () => {
  const stored = 'x'.repeat(10_000);
  const parsed = parseDreamTextInput({ transcript: stored, lang: 'fr' });
  assertEquals(parsed instanceof Response, false);
  if (parsed instanceof Response) return;

  assertEquals(parsed.transcript, stored);
  assertEquals(parsed.lang, 'fr');
  const promptCopy = boundTranscriptForPrompt(parsed.transcript);
  assertEquals(promptCopy.truncated, true);
  assertEquals(promptCopy.text.length, 6000);
  assertEquals(parsed.transcript.length, 10_000);

  const overAbuse = parseDreamTextInput({
    transcript: 'z'.repeat(AI_REQUEST_LIMITS.transcriptRequestChars + 1),
  });
  assertEquals(overAbuse instanceof Response, true);
  if (!(overAbuse instanceof Response)) return;
  assertEquals(overAbuse.status, 413);
  assertEquals((await overAbuse.json()).maxChars, 100_000);
});

Deno.test('bounded AI text rejects non-string values and trims accepted input', () => {
  assertEquals(
    validateBoundedText({ text: 'dream' }, { field: 'transcript', maxChars: 600 }),
    { ok: false, code: 'INVALID_INPUT', field: 'transcript' }
  );
  assertEquals(
    validateBoundedText('  dream  ', { field: 'transcript', maxChars: 600 }),
    { ok: true, value: 'dream' }
  );
});

Deno.test('AI request identifiers are bounded and restricted to transport-safe characters', () => {
  assertEquals(isValidClientRequestId('3f73ab45-9a14-4db9-94a3-d24724457d9e'), true);
  assertEquals(isValidClientRequestId('request:retry_1'), true);
  assertEquals(isValidClientRequestId('spaces are invalid'), false);
  assertEquals(isValidClientRequestId('x'.repeat(129)), false);
});

Deno.test('UUID validation accepts canonical request identifiers only', () => {
  assertEquals(isValidUuid('3f73ab45-9a14-4db9-94a3-d24724457d9e'), true);
  assertEquals(isValidUuid('analysis-request-1'), false);
  assertEquals(isValidUuid('3f73ab45-9a14-4db9-14a3-d24724457d9e'), false);
});

Deno.test('AI languages normalize supported locale tags and fail safely to English', () => {
  assertEquals(normalizeAiLanguage('fr-FR'), 'fr');
  assertEquals(normalizeAiLanguage('IT_it'), 'it');
  assertEquals(normalizeAiLanguage('unknown'), 'en');
});
