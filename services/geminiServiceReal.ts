// Backend proxy integration for RN app. Configure base URL via EXPO_PUBLIC_API_URL
// or app.json extra.apiUrl. Endpoints expected:
// - POST /analyzeDream { transcript } -> AnalysisResult
// - POST /generateImage { prompt } -> { imageUrl?: string, imageBytes?: string }
// - POST /analyzeDreamFull { transcript } -> AnalysisResult & { imageBytes?: string, imageUrl?: string }
// - POST /chat { history, message, lang } -> { text: string }
// - POST /tts { text } -> { audioBase64: string }

import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON, HttpError } from '@/lib/http';
import { classifyImageError, type ImageGenerationErrorResponse } from '@/lib/errors';
import type { DreamTheme, DreamType } from '@/lib/types';

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
  return fetchJSON<AnalysisResult>(`${base}/analyzeDream`, {
    method: 'POST',
    body: { transcript, lang, ...(fingerprint && { fingerprint }) },
    retries: 1, // One automatic retry
  });
}

export async function categorizeDream(transcript: string, lang: string = 'en'): Promise<Pick<AnalysisResult, 'title' | 'theme' | 'dreamType'>> {
  const base = getApiBaseUrl();
  return fetchJSON<Pick<AnalysisResult, 'title' | 'theme' | 'dreamType'>>(`${base}/categorizeDream`, {
    method: 'POST',
    body: { transcript, lang },
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
    const res = await fetchJSON<{ imageUrl?: string; imageBytes?: string }>(`${base}/generateImage`, {
      method: 'POST',
      body: { prompt, previousImageUrl },
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
    const res = await fetchJSON<{ imageUrl?: string; imageBytes?: string; prompt?: string }>(`${base}/generateImage`, {
      method: 'POST',
      // Let the backend generate a short image prompt from the transcript.
      body: { transcript, previousImageUrl },
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

export async function startOrContinueChat(
  history: { role: 'user' | 'model'; text: string }[],
  message: string,
  lang: string,
): Promise<string> {
  const base = getApiBaseUrl();
  const res = await fetchJSON<{ text: string }>(`${base}/chat`, {
    method: 'POST',
    body: { history, message, lang },
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
