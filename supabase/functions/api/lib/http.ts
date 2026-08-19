import { corsHeaders } from './constants.ts';

const buildJsonHeaders = (extraHeaders?: HeadersInit): Headers => {
  const headers = new Headers({ 'Content-Type': 'application/json', ...corsHeaders });
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, key) => headers.set(key, value));
  }
  return headers;
};

export const jsonResponse = (
  body: unknown,
  status = 200,
  extraHeaders?: HeadersInit
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: buildJsonHeaders(extraHeaders),
  });

export const errorResponse = (
  message: string,
  status: number,
  extra?: Record<string, unknown>
): Response => jsonResponse({ error: message, ...(extra ?? {}) }, status);
