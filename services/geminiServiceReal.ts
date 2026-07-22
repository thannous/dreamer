// Backend proxy integration for RN app. Configure base URL via EXPO_PUBLIC_API_URL
// or app.json extra.apiUrl. Endpoints expected:
// - POST /analyzeDream { transcript } -> AnalysisResult
// - POST /generateImage { prompt } -> { imageUrl?: string, imageBytes?: string }
// - POST /analyzeDreamFull { transcript } -> AnalysisResult & { imageBytes?: string, imageUrl?: string }
// - POST /chat { dreamId, message, lang } -> { text: string }  [✅ UPDATED: now requires dreamId, enforces quotas]
// - POST /tts { text } -> { audioBase64: string }

import { fetch as streamingFetch } from 'expo/fetch';

import { getApiBaseUrl } from '@/lib/config';
import { fetchJSONWithSession, getSessionAuthHeaders } from '@/lib/apiSession';
import { HttpError, type HttpOptions } from '@/lib/http';
import {
  classifyImageError,
  type ImageGenerationErrorResponse,
} from '@/lib/errors';
import { NETWORK_REQUEST_POLICIES } from '@/lib/networkPolicy';
import type {
  ChatMessage,
  DreamCategorization,
  DreamEmotionInsight,
  DreamSymbolInsight,
  DreamTheme,
  DreamType,
  ReferenceImageGenerationRequest,
} from '@/lib/types';

export type AnalysisResult = {
  title: string;
  interpretation: string;
  shareableQuote: string;
  theme: DreamTheme;
  dreamType: DreamType;
  imagePrompt: string;
  symbols?: DreamSymbolInsight[];
  emotions?: DreamEmotionInsight[];
  reflectionQuestions?: string[];
  quotaUsed?: { analysis: number };
};

export type AnalysisRequestContext = {
  remoteDreamId?: number | null;
  analysisRequestId?: string | null;
};

export type ImageJobCommandRequest = {
  clientRequestId: string;
  dreamId?: number;
  prompt?: string;
  transcript?: string;
  previousImageUrl?: string;
};

export type ImageJobCommandResponse = {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  clientRequestId: string;
};

export type ImageJobStatusResponse = {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  clientRequestId: string;
  resultPayload?: {
    imageUrl?: string;
    imageBytes?: string;
    prompt?: string;
  } | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

export type AnalysisJobCommandRequest = {
  dreamId: number;
  analysisRequestId: string;
  lang?: string;
  replaceExistingImage?: boolean;
};

export type AnalysisJobCommandResponse = {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  clientRequestId: string;
  duplicate?: boolean;
  quotaUsed?: { analysis: number };
};

export type AnalysisImageJobPayload = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  client_request_id: string;
  dream_id?: number | null;
};

export type AnalysisJobStatusResponse = {
  jobId: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  clientRequestId: string;
  resultPayload?: {
    dreamId?: number;
    imageJob?: AnalysisImageJobPayload | null;
    imageJobErrorCode?: string | null;
  } | null;
  errorCode?: string | null;
  errorMessage?: string | null;
};

async function fetchWithSessionHeaders<T>(
  path: string,
  options: HttpOptions & { signal?: AbortSignal }
): Promise<T> {
  const base = getApiBaseUrl();
  return fetchJSONWithSession<T>(`${base}${path}`, options);
}

function buildAnalysisRequestBody(
  transcript: string,
  lang: string,
  fingerprint?: string,
  context?: AnalysisRequestContext
) {
  return {
    transcript,
    lang,
    ...(fingerprint && { fingerprint }),
    ...(context?.remoteDreamId != null ? { remoteDreamId: context.remoteDreamId } : {}),
    ...(context?.analysisRequestId ? { analysisRequestId: context.analysisRequestId } : {}),
  };
}

export async function analyzeDream(
  transcript: string,
  lang: string = 'en',
  fingerprint?: string,
  context?: AnalysisRequestContext
): Promise<AnalysisResult> {
  return fetchWithSessionHeaders<AnalysisResult>('/analyzeDream', {
    method: 'POST',
    body: buildAnalysisRequestBody(transcript, lang, fingerprint, context),
    ...NETWORK_REQUEST_POLICIES.analyzeDream,
  });
}

export type CategorizeDreamResult = DreamCategorization;

export async function categorizeDream(transcript: string, lang: string = 'en'): Promise<CategorizeDreamResult> {
  return fetchWithSessionHeaders<CategorizeDreamResult>('/categorizeDream', {
    method: 'POST',
    body: { transcript, lang },
    ...NETWORK_REQUEST_POLICIES.categorizeDream,
  });
}

export async function analyzeDreamWithImage(
  transcript: string,
  lang: string = 'en',
  fingerprint?: string,
  context?: AnalysisRequestContext
): Promise<AnalysisResult & { imageUrl: string }> {
  const res = await fetchWithSessionHeaders<AnalysisResult & { imageUrl?: string; imageBytes?: string }>(
    '/analyzeDreamFull',
    {
      method: 'POST',
      body: buildAnalysisRequestBody(transcript, lang, fingerprint, context),
      ...NETWORK_REQUEST_POLICIES.analyzeDreamFull,
    }
  );
  const imageUrl = res.imageUrl ?? (res.imageBytes ? `data:image/webp;base64,${res.imageBytes}` : undefined);
  if (!imageUrl) throw new Error('Invalid combined response from backend');
  // Return merged object with a guaranteed imageUrl
  return { ...res, imageUrl };
}

/**
 * Resilient version that attempts combined analysis+image,
 * but falls back to analysis-only if image generation fails.
 * Returns analysis result with imageUrl or null if image failed.
 */
export async function analyzeDreamWithImageResilient(
  transcript: string,
  lang: string = 'en',
  fingerprint?: string,
  context?: AnalysisRequestContext
): Promise<AnalysisResult & { imageUrl: string | null; imageGenerationFailed: boolean }> {
  try {
    // Try combined analysis + image generation first
    const res = await fetchWithSessionHeaders<AnalysisResult & { imageUrl?: string; imageBytes?: string }>(
      '/analyzeDreamFull',
      {
        method: 'POST',
        body: buildAnalysisRequestBody(transcript, lang, fingerprint, context),
        ...NETWORK_REQUEST_POLICIES.analyzeDreamFull,
      }
    );
    const imageUrl = res.imageUrl ?? (res.imageBytes ? `data:image/webp;base64,${res.imageBytes}` : undefined);

    if (imageUrl) {
      return { ...res, imageUrl, imageGenerationFailed: false };
    } else {
      // Combined call succeeded but no image returned, try separate image generation
      try {
        const separateImageUrl = await generateImageForDream(res.imagePrompt);
        return { ...res, imageUrl: separateImageUrl, imageGenerationFailed: false };
      } catch {
        // Image generation failed, return analysis without image
        return { ...res, imageUrl: null, imageGenerationFailed: true };
      }
    }
  } catch {
    // Combined call failed entirely, try analysis only as fallback
    try {
      // Note: fingerprint already consumed on combined call if it was provided,
      // so we don't pass it again for fallback analysis-only call
      const analysisOnly = await analyzeDream(transcript, lang, undefined, context);

      // Try to generate image separately
      try {
        const imageUrl = await generateImageForDream(analysisOnly.imagePrompt);
        return { ...analysisOnly, imageUrl, imageGenerationFailed: false };
      } catch {
        // Image failed, return analysis without image
        return { ...analysisOnly, imageUrl: null, imageGenerationFailed: true };
      }
    } catch (analysisError) {
      // Both combined and separate analysis failed, re-throw the analysis error
      throw analysisError;
    }
  }
}

export async function generateImageForDream(prompt: string, previousImageUrl?: string): Promise<string> {
  try {
    const res = await fetchWithSessionHeaders<{ imageUrl?: string; imageBytes?: string }>('/generateImage', {
      method: 'POST',
      body: { prompt, previousImageUrl },
      ...NETWORK_REQUEST_POLICIES.generateImage,
    });
    if (res.imageUrl) return res.imageUrl;
    if (res.imageBytes) return `data:image/webp;base64,${res.imageBytes}`;
    throw new Error('Invalid image response from backend');
  } catch (error) {
    if (error instanceof HttpError && error.body && typeof error.body === 'object' && error.body !== null) {
      const body = error.body as Partial<ImageGenerationErrorResponse>;
      if (typeof body.error === 'string') {
        if (__DEV__) {
          console.warn('[geminiService] generateImageForDream failed', {
            status: error.status,
            blockReason: body.blockReason ?? null,
            finishReason: body.finishReason ?? null,
            retryAttempts: body.retryAttempts ?? null,
            isTransient: body.isTransient ?? null,
          });
        }
        const classified = classifyImageError(body as ImageGenerationErrorResponse);
        throw new Error(classified.userMessage);
      }
    }
    throw error;
  }
}

export async function submitImageGenerationJob(
  request: ImageJobCommandRequest
): Promise<ImageJobCommandResponse> {
  return fetchWithSessionHeaders<ImageJobCommandResponse>('/image-jobs', {
    method: 'POST',
    body: request,
    ...NETWORK_REQUEST_POLICIES.imageJobCommand,
  });
}

export async function getImageGenerationJobStatus(jobId: string): Promise<ImageJobStatusResponse> {
  return fetchWithSessionHeaders<ImageJobStatusResponse>('/image-jobs/status', {
    method: 'POST',
    body: { jobId },
    ...NETWORK_REQUEST_POLICIES.imageJobStatus,
  });
}

export async function submitDreamAnalysisJob(
  request: AnalysisJobCommandRequest
): Promise<AnalysisJobCommandResponse> {
  return fetchWithSessionHeaders<AnalysisJobCommandResponse>('/analysis-jobs', {
    method: 'POST',
    body: request,
    ...NETWORK_REQUEST_POLICIES.analysisJobCommand,
  });
}

export async function getDreamAnalysisJobStatus(
  jobId: string
): Promise<AnalysisJobStatusResponse> {
  return fetchWithSessionHeaders<AnalysisJobStatusResponse>('/analysis-jobs/status', {
    method: 'POST',
    body: { jobId },
    ...NETWORK_REQUEST_POLICIES.analysisJobStatus,
  });
}

export async function generateImageFromTranscript(transcript: string, previousImageUrl?: string): Promise<string> {
  try {
    const res = await fetchWithSessionHeaders<{ imageUrl?: string; imageBytes?: string; prompt?: string }>(
      '/generateImage',
      {
        method: 'POST',
        // Let the backend generate a short image prompt from the transcript.
        body: { transcript, previousImageUrl },
        ...NETWORK_REQUEST_POLICIES.generateImage,
      }
    );
    if (res.imageUrl) return res.imageUrl;
    if (res.imageBytes) return `data:image/webp;base64,${res.imageBytes}`;
    throw new Error('Invalid image response from backend');
  } catch (error) {
    if (error instanceof HttpError && error.body && typeof error.body === 'object' && error.body !== null) {
      const body = error.body as Partial<ImageGenerationErrorResponse>;
      if (typeof body.error === 'string') {
        if (__DEV__) {
          console.warn('[geminiService] generateImageFromTranscript failed', {
            status: error.status,
            blockReason: body.blockReason ?? null,
            finishReason: body.finishReason ?? null,
            retryAttempts: body.retryAttempts ?? null,
            isTransient: body.isTransient ?? null,
          });
        }
        const classified = classifyImageError(body as ImageGenerationErrorResponse);
        throw new Error(classified.userMessage);
      }
    }
    throw error;
  }
}

/**
 * ✅ PHASE 2: Send chat message with server-side quota enforcement
 *
 * CRITICAL CHANGES:
 * - Now requires dreamId for ownership verification and per-dream quota tracking
 * - Client no longer sends history - server reads from dreams.chat_history (source of truth)
 * - Returns 429 if user exceeds message limit
 * - Uses "claim before cost" pattern: message persisted BEFORE Gemini call
 *
 * @param dreamId - ID of the dream to chat about (required for ownership + quota)
 * @param message - Single user message (server appends to history)
 * @param lang - Language for response ('en', 'fr', 'es')
 * @throws HttpError with status 429 if quota exceeded
 */
export async function startOrContinueChat(
  dreamId: string,
  message: string,
  lang: string = 'en',
  dreamContext?: {
    transcript: string;
    title: string;
    interpretation: string;
    shareableQuote: string;
    dreamType: DreamType;
    theme?: DreamTheme;
    chatHistory?: ChatMessage[];
  },
  fingerprint?: string,
  options?: {
    signal?: AbortSignal;
    clientRequestId?: string;
    messageMeta?: ChatMessage['meta'];
    /**
     * When provided, the reply is streamed: called for each text delta with
     * the accumulated text so far. The returned promise still resolves with
     * the complete reply.
     */
    onDelta?: (accumulated: string) => void;
  }
): Promise<{ text: string; message?: Partial<ChatMessage> }> {
  const body = {
    dreamId,
    message,
    lang,
    ...(options?.clientRequestId && { clientRequestId: options.clientRequestId }),
    ...(options?.messageMeta && { messageMeta: options.messageMeta }),
    ...(dreamContext && { dreamContext }),
    ...(fingerprint && { fingerprint }),
  };

  if (options?.onDelta) {
    return streamChatRequest(body, options.onDelta, options.signal);
  }

  const res = await fetchWithSessionHeaders<{ text: string; message?: Partial<ChatMessage> }>('/chat', {
    method: 'POST',
    body,
    ...NETWORK_REQUEST_POLICIES.chat,
    signal: options?.signal,
  });
  return res;
}

/**
 * Streaming /chat transport: POSTs with stream=true and consumes the SSE
 * response incrementally. No automatic transport retry: the UI may retry
 * explicitly with the same request UUID so the server can replay or resume
 * the durable turn without duplicating provider work.
 */
async function streamChatRequest(
  body: Record<string, unknown>,
  onDelta: (accumulated: string) => void,
  signal?: AbortSignal
): Promise<{ text: string; message?: Partial<ChatMessage> }> {
  const url = `${getApiBaseUrl()}/chat`;
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(await getSessionAuthHeaders()),
  };

  const res = await streamingFetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ...body, stream: true }),
    signal,
  });

  if (!res.ok || !res.body) {
    const bodyText = await res.text().catch(() => '');
    let parsed: unknown;
    try {
      parsed = bodyText ? JSON.parse(bodyText) : undefined;
    } catch {
      parsed = undefined;
    }
    throw new HttpError({
      status: res.status,
      statusText: res.statusText ?? '',
      url,
      bodyText,
      body: parsed,
    });
  }

  const decoder = new TextDecoder();
  const reader = res.body.getReader();
  let buffer = '';
  let accumulated = '';
  let final: { text: string; message?: Partial<ChatMessage> } | null = null;
  let streamError: { error?: string; status?: number } | null = null;

  const handleEvent = (payload: unknown) => {
    const event = payload as {
      delta?: string;
      done?: boolean;
      text?: string;
      message?: Partial<ChatMessage>;
      error?: string;
      status?: number;
    };
    if (typeof event?.delta === 'string' && event.delta) {
      accumulated += event.delta;
      onDelta(accumulated);
    } else if (event?.done && typeof event.text === 'string') {
      final = { text: event.text, message: event.message };
    } else if (typeof event?.error === 'string') {
      streamError = event;
    }
  };

  const drainBuffer = (flush = false) => {
    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const rawEvent = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);
      const data = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data: '))
        .map((line) => line.slice(6))
        .join('');
      if (data) {
        try {
          handleEvent(JSON.parse(data));
        } catch {
          // Ignore malformed frames; the done/error frame governs the outcome.
        }
      }
      separatorIndex = buffer.indexOf('\n\n');
    }
    if (flush && buffer.startsWith('data: ')) {
      try {
        handleEvent(JSON.parse(buffer.slice(6)));
      } catch {
        // Ignore a trailing partial frame.
      }
      buffer = '';
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        drainBuffer();
      }
      if (done) break;
    }
  } finally {
    reader.releaseLock?.();
  }
  buffer += decoder.decode();
  drainBuffer(true);

  if (streamError) {
    const failure: { error?: string; status?: number } = streamError;
    throw new HttpError({
      status: failure.status ?? 500,
      statusText: 'Stream error',
      url,
      bodyText: JSON.stringify(failure),
      body: failure,
    });
  }
  if (!final) {
    throw new HttpError({
      status: 502,
      statusText: 'Incomplete stream',
      url,
      bodyText: 'Chat stream ended without a final message',
    });
  }
  return final;
}

export function resetChat() {
  // stateless backend; nothing to do here
}

export async function generateSpeechForText(text: string): Promise<string> {
  const res = await fetchWithSessionHeaders<{ audioBase64: string }>('/tts', {
    method: 'POST',
    body: { text },
    ...NETWORK_REQUEST_POLICIES.textToSpeech,
  });
  if (!res.audioBase64) throw new Error('No audio returned');
  return res.audioBase64;
}

/**
 * Reference-image generation is hard-disabled.
 */
export async function generateImageWithReference(
  request: ReferenceImageGenerationRequest
): Promise<string> {
  void request;
  throw Object.assign(new Error('Reference image generation is disabled'), {
    status: 410,
    body: {
      code: 'FEATURE_DISABLED',
      error: 'Reference image generation is disabled',
    },
  });
}
