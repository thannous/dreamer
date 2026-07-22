import { corsHeaders } from './constants.ts';

export const AI_REQUEST_LIMITS = {
  transcriptChars: 600,
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

const SUPPORTED_AI_LANGUAGES = new Set(['en', 'fr', 'es', 'de', 'it']);

export const normalizeAiLanguage = (value: string): string => {
  const base = value.toLowerCase().split(/[-_]/)[0];
  return SUPPORTED_AI_LANGUAGES.has(base) ? base : 'en';
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
