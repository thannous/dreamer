import { isAiLanguage } from './aiLanguage.ts';
import { corsHeaders } from './constants.ts';
import { boundTranscriptForPrompt } from './prompts.ts';

export const AI_REQUEST_LIMITS = {
  /** Request-abuse bound for optional image-generation transcript fields. */
  transcriptChars: 600,
  /** Request-abuse bound for stored/source dream transcripts. Prompt copies are bounded separately. */
  transcriptRequestChars: 100_000,
  imagePromptChars: 1000,
  previousImageUrlChars: 2048,
  clientRequestIdChars: 128,
  chatMessageChars: 4000,
  dreamIdChars: 128,
  languageChars: 16,
} as const;

export type TextInputValidation =
  | { ok: true; value: string }
  | {
      ok: false;
      code: 'MISSING_INPUT' | 'INVALID_INPUT' | 'INPUT_TOO_LARGE';
      field: string;
      maxChars?: number;
    };

export const validateBoundedText = (
  value: unknown,
  options: { field: string; maxChars: number; required?: boolean }
): TextInputValidation => {
  const required = options.required !== false;
  if (value == null) {
    return required
      ? { ok: false, code: 'MISSING_INPUT', field: options.field }
      : { ok: true, value: '' };
  }
  if (typeof value !== 'string') {
    return { ok: false, code: 'INVALID_INPUT', field: options.field };
  }
  if (value.length > options.maxChars) {
    return {
      ok: false,
      code: 'INPUT_TOO_LARGE',
      field: options.field,
      maxChars: options.maxChars,
    };
  }

  const normalized = value.trim();
  if (required && !normalized) {
    return { ok: false, code: 'MISSING_INPUT', field: options.field };
  }
  return { ok: true, value: normalized };
};

const CLIENT_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;

export const isValidClientRequestId = (value: string): boolean =>
  value.length > 0
  && value.length <= AI_REQUEST_LIMITS.clientRequestIdChars
  && CLIENT_REQUEST_ID_PATTERN.test(value);

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const isValidUuid = (value: string): boolean => UUID_PATTERN.test(value);

export const normalizeAiLanguage = (value: string): string => {
  const base = value.toLowerCase().split(/[-_]/)[0];
  return isAiLanguage(base) ? base : 'en';
};


export const parseLegacyImageTranscriptInput = (
  value: unknown
): { storedTranscript: string; promptTranscript: string } | Response => {
  const transcriptInput = validateBoundedText(value, {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptRequestChars,
    required: false,
  });
  if (!transcriptInput.ok) return aiInputErrorResponse(transcriptInput);
  return {
    storedTranscript: transcriptInput.value,
    promptTranscript: boundTranscriptForPrompt(transcriptInput.value).text,
  };
};

export const parseDreamTextInput = (
  body: { transcript?: unknown; lang?: unknown }
): { transcript: string; lang: string } | Response => {
  const transcript = validateBoundedText(body?.transcript, {
    field: 'transcript',
    maxChars: AI_REQUEST_LIMITS.transcriptRequestChars,
  });
  if (!transcript.ok) return aiInputErrorResponse(transcript);

  const language = validateBoundedText(body?.lang, {
    field: 'lang',
    maxChars: AI_REQUEST_LIMITS.languageChars,
    required: false,
  });
  if (!language.ok) return aiInputErrorResponse(language);

  return {
    transcript: transcript.value,
    lang: normalizeAiLanguage(language.value || 'en'),
  };
};

export const aiInputErrorResponse = (
  validation: Exclude<TextInputValidation, { ok: true }>
): Response => {
  const status = validation.code === 'INPUT_TOO_LARGE' ? 413 : 400;
  const message = validation.code === 'INPUT_TOO_LARGE'
    ? `${validation.field} exceeds the allowed size`
    : validation.code === 'MISSING_INPUT'
      ? `${validation.field} is required`
      : `${validation.field} is invalid`;

  return new Response(
    JSON.stringify({
      error: message,
      code: validation.code,
      field: validation.field,
      ...(validation.maxChars ? { maxChars: validation.maxChars } : {}),
    }),
    {
      status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );
};
