import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';

import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  isValidClientRequestId,
  isValidUuid,
  normalizeAiLanguage,
  validateBoundedText,
} from './aiRequestPolicy.ts';

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
