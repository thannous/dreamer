import { fetchJSONWithSession } from '@/lib/apiSession';
import { getApiBaseUrl } from '@/lib/config';
import { isMockModeEnabled } from '@/lib/env';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';
import { getTranslator } from '@/lib/i18n';

export async function formatCaptureNarrative(transcript: string, lang: string, signal?: AbortSignal): Promise<string> {
  if (isMockModeEnabled()) return transcript;
  const baseUrl = getApiBaseUrl().replace(
    /(\/functions\/v1|\.functions\.supabase\.co)\/api$/,
    '$1/capture-recall'
  );
  const result = await fetchJSONWithSession<{ transcript: string }>(`${baseUrl}/format-recall`, {
    method: 'POST', body: { transcript, lang }, ...NETWORK_REQUEST_POLICIES.formatRecall, signal,
  });
  if (typeof result?.transcript !== 'string' || !result.transcript.trim() || result.transcript.length > 20000) {
    throw new Error('Invalid formatted narrative');
  }
  return result.transcript.trim();
}

export type CaptureQuestion = { question: string | null; done: boolean };

export async function requestCaptureQuestion(
  transcript: string, lang: string, previousQuestions: string[], signal?: AbortSignal
): Promise<CaptureQuestion> {
  if (isMockModeEnabled()) {
    return { question: String(getTranslator(lang as Parameters<typeof getTranslator>[0])('dream_recall.question.what_else')), done: false };
  }
  // Hosted recall is deployed independently; local/proxied APIs keep their existing route.
  const baseUrl = getApiBaseUrl().replace(
    /(\/functions\/v1|\.functions\.supabase\.co)\/api$/,
    '$1/capture-recall'
  );
  const result = await fetchJSONWithSession<CaptureQuestion>(`${baseUrl}/recall-question`, {
    method: 'POST', body: { transcript, lang, previousQuestions },
    ...NETWORK_REQUEST_POLICIES.recallQuestion, signal,
  });
  if (!result || typeof result.done !== 'boolean' || result.done !== (result.question === null) ||
    (result.question !== null && (typeof result.question !== 'string' || !result.question.trim() || result.question.length > 280))) {
    throw new Error('Invalid recall response');
  }
  return result;
}
