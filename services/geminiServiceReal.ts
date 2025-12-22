// Backend proxy integration for RN app. Configure base URL via EXPO_PUBLIC_API_URL
// or app.json extra.apiUrl. Endpoints expected:
// - POST /analyzeDream { transcript } -> AnalysisResult
// - POST /generateImage { prompt } -> { imageUrl?: string, imageBytes?: string }
// - POST /analyzeDreamFull { transcript } -> AnalysisResult & { imageBytes?: string, imageUrl?: string }
// - POST /chat { dreamId, message, lang } -> { text: string }  [✅ UPDATED: now requires dreamId, enforces quotas]
// - POST /tts { text } -> { audioBase64: string }

import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON, HttpError } from '@/lib/http';
import { classifyImageError, type ImageGenerationErrorResponse } from '@/lib/errors';
import type { ChatMessage, DreamTheme, DreamType, ReferenceImageGenerationRequest } from '@/lib/types';
import { getGuestHeaders } from '@/lib/guestSession';

export type AnalysisResult = {
  title: string;
  interpretation: string;
  shareableQuote: string;
  theme: DreamTheme;
  dreamType: DreamType;
  imagePrompt: string;
  quotaUsed?: { analysis: number };
};

export async function analyzeDream(
  transcript: string,
  lang: string = 'en',
  fingerprint?: string
): Promise<AnalysisResult> {
  const base = getApiBaseUrl();
  const headers = await getGuestHeaders();
  return fetchJSON<AnalysisResult>(`${base}/analyzeDream`, {
    method: 'POST',
    body: { transcript, lang, ...(fingerprint && { fingerprint }) },
    headers,
    retries: 1, // One automatic retry
  });
}

export type CategorizeDreamResult = Pick<AnalysisResult, 'title' | 'theme' | 'dreamType'> & {
  hasPerson?: boolean | null;
  hasAnimal?: boolean | null;
};

export async function categorizeDream(transcript: string, lang: string = 'en'): Promise<CategorizeDreamResult> {
  const base = getApiBaseUrl();
  const headers = await getGuestHeaders();
  return fetchJSON<CategorizeDreamResult>(`${base}/categorizeDream`, {
    method: 'POST',
    body: { transcript, lang },
    headers,
    retries: 1,
  });
}

export async function analyzeDreamWithImage(
  transcript: string,
  lang: string = 'en',
  fingerprint?: string
): Promise<AnalysisResult & { imageUrl: string }> {
  const base = getApiBaseUrl();
  const res = await fetchJSON<AnalysisResult & { imageUrl?: string; imageBytes?: string }>(`${base}/analyzeDreamFull`, {
    method: 'POST',
    body: { transcript, lang, ...(fingerprint && { fingerprint }) },
    retries: 1, // One automatic retry
    timeoutMs: 60000, // Increased timeout for combined operation
  });
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
  fingerprint?: string
): Promise<AnalysisResult & { imageUrl: string | null; imageGenerationFailed: boolean }> {
  const base = getApiBaseUrl();

  try {
    // Try combined analysis + image generation first
    const res = await fetchJSON<AnalysisResult & { imageUrl?: string; imageBytes?: string }>(`${base}/analyzeDreamFull`, {
      method: 'POST',
      body: { transcript, lang, ...(fingerprint && { fingerprint }) },
      retries: 1,
      timeoutMs: 60000,
    });
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
  } catch (error) {
    // Combined call failed entirely, try analysis only as fallback
    try {
      // Note: fingerprint already consumed on combined call if it was provided,
      // so we don't pass it again for fallback analysis-only call
      const analysisOnly = await analyzeDream(transcript, lang);

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
  const base = getApiBaseUrl();
  try {
    const headers = await getGuestHeaders();
    const res = await fetchJSON<{ imageUrl?: string; imageBytes?: string }>(`${base}/generateImage`, {
      method: 'POST',
      body: { prompt, previousImageUrl },
      headers,
      timeoutMs: 60000,
      retries: 2,
      retryDelay: 1200,
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

export async function generateImageFromTranscript(transcript: string, previousImageUrl?: string): Promise<string> {
  const base = getApiBaseUrl();
  try {
    const headers = await getGuestHeaders();
    const res = await fetchJSON<{ imageUrl?: string; imageBytes?: string; prompt?: string }>(`${base}/generateImage`, {
      method: 'POST',
      // Let the backend generate a short image prompt from the transcript.
      body: { transcript, previousImageUrl },
      headers,
      timeoutMs: 60000, // Image generation can take time
      retries: 2,
      retryDelay: 1200,
    });
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
  fingerprint?: string
): Promise<string> {
  const base = getApiBaseUrl();
  const headers = await getGuestHeaders();
  const res = await fetchJSON<{ text: string }>(`${base}/chat`, {
    method: 'POST',
    body: {
      dreamId,
      message,
      lang,
      ...(dreamContext && { dreamContext }),
      ...(fingerprint && { fingerprint }),
    },
    headers,
  });
  return res.text;
}

export function resetChat() {
  // stateless backend; nothing to do here
}

export async function generateSpeechForText(text: string): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetchJSON<{ audioBase64: string }>(`${base}/tts`, {
    method: 'POST',
    body: { text },
    timeoutMs: 60000,
  });
  if (!res.audioBase64) throw new Error('No audio returned');
  return res.audioBase64;
}

/**
 * Generate a dream image with reference subjects (person/animal).
 * Reference images should be pre-compressed (512px max, WEBP, quality 0.7)
 * and will be encoded to base64 at send time.
 *
 * @param request - The request containing transcript, prompt, and reference images
 * @returns The generated image URL or base64 data URI
 */
export async function generateImageWithReference(
  request: ReferenceImageGenerationRequest
): Promise<string> {
  const base = getApiBaseUrl();

  // Import FileSystem for reading file URIs on native
  const FileSystem = await import('expo-file-system');
  const FileSystemLegacy = await import('expo-file-system/legacy');

  // Convert reference images to base64 at send time
  const referenceImagesPayload = await Promise.all(
    request.referenceImages.map(async (img) => {
      let base64: string;

      if (img.uri.startsWith('data:')) {
        // Already a data URI, extract base64
        const match = /^data:[^;]+;base64,(.+)$/i.exec(img.uri);
        base64 = match?.[1] ?? '';
      } else if (img.uri.startsWith('file://')) {
        // Read from file system
        const file = new FileSystem.File(img.uri);
        base64 = await file.base64();
      } else {
        // Try legacy API for cache URIs
        base64 = await FileSystemLegacy.readAsStringAsync(img.uri, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });
      }

      return {
        data: base64,
        mimeType: img.mimeType,
        type: img.type,
      };
    })
  );

  try {
    const prompt = request.prompt?.trim();
    const previousImageUrl = request.previousImageUrl?.trim();
    const res = await fetchJSON<{ imageUrl?: string; imageBytes?: string }>(`${base}/generateImageWithReference`, {
      method: 'POST',
      body: {
        transcript: request.transcript,
        ...(prompt ? { prompt } : {}),
        referenceImages: referenceImagesPayload,
        ...(previousImageUrl ? { previousImageUrl } : {}),
        lang: request.lang ?? 'en',
      },
      timeoutMs: 90000, // Longer timeout for reference image processing
      retries: 1,
    });

    if (res.imageUrl) return res.imageUrl;
    if (res.imageBytes) return `data:image/webp;base64,${res.imageBytes}`;
    throw new Error('Invalid image response from backend');
  } catch (error) {
    if (error instanceof HttpError && error.body && typeof error.body === 'object' && error.body !== null) {
      const body = error.body as Partial<ImageGenerationErrorResponse>;
      if (typeof body.error === 'string') {
        if (__DEV__) {
          console.warn('[geminiService] generateImageWithReference failed', {
            status: error.status,
            blockReason: body.blockReason ?? null,
            finishReason: body.finishReason ?? null,
            retryAttempts: body.retryAttempts ?? null,
            isTransient: body.isTransient ?? null,
          });
        }
        const classified = classifyImageError(body as ImageGenerationErrorResponse);
        const enriched = Object.assign(new Error(classified.userMessage), classified, {
          originalError: error instanceof Error ? error : classified.originalError,
        });
        throw enriched;
      }
    }
    throw error;
  }
}
