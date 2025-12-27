import { ApiError, requestGeminiGenerateContent } from './gemini.ts';

/**
 * Normalize the image model to a supported Gemini image model. Avoids using Imagen
 * models that are not available on the Gemini API endpoints.
 */
export const resolveImageModel = (): string => {
  return Deno.env.get('IMAGEN_MODEL') ?? 'gemini-2.5-flash-image';
};

export async function generateImageFromPrompt(options: {
  prompt: string;
  apiKey: string;
  aspectRatio?: string;
  model?: string;
}): Promise<{ imageBase64?: string; mimeType?: string; raw: any; retryAttempts?: number }> {
  const { prompt, apiKey, aspectRatio = '9:16', model = resolveImageModel() } = options;

  const extractInlineData = (
    response: any
  ): { data?: string; mimeType?: string; finishReason?: string | null; promptFeedback?: any } => {
    const parts = response?.candidates?.[0]?.content?.parts;
    const inlinePart = Array.isArray(parts) ? parts.find((p: any) => p?.inlineData?.data) : undefined;
    return {
      data: inlinePart?.inlineData?.data as string | undefined,
      mimeType: inlinePart?.inlineData?.mimeType as string | undefined,
      finishReason: response?.candidates?.[0]?.finishReason ?? null,
      promptFeedback: response?.promptFeedback ?? null,
    };
  };

  // Retry configuration with exponential backoff
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 500;
  const attempts: { blockReason: string | null; finishReason: string | null; promptFeedback: any }[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let response: any;
    try {
      response = await requestGeminiGenerateContent({
        apiKey,
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio },
        },
      });
    } catch (error) {
      const err = error as any;
      const msg = String(err?.message ?? error);
      const status = err instanceof ApiError ? err.status : (typeof err?.httpStatus === 'number' ? err.httpStatus : null);
      const isTransient =
        (typeof status === 'number' && (status === 429 || status >= 500)) ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('fetch failed');

      if (err && typeof err === 'object') {
        err.isTransient = isTransient;
        if (typeof err.httpStatus !== 'number' && typeof status === 'number') err.httpStatus = status;
        if (err.retryAttempts == null) err.retryAttempts = attempt;
      }

      attempts.push({
        blockReason: null,
        finishReason: null,
        promptFeedback: { requestError: msg, httpStatus: status },
      });

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 100;
        console.log(
          `[api] Gemini image request error on attempt ${attempt}/${MAX_RETRIES}, retrying in ${Math.round(delay + jitter)}ms...`,
          { httpStatus: status }
        );
        await new Promise((r) => setTimeout(r, delay + jitter));
        continue;
      }
      throw err ?? error;
    }
    const extracted = extractInlineData(response);
    if (extracted.data) {
      if (attempt > 1) {
        console.log(`[api] Gemini image succeeded on attempt ${attempt}/${MAX_RETRIES}`);
      }
      return {
        imageBase64: extracted.data,
        mimeType: extracted.mimeType ?? 'image/png',
        raw: response,
        retryAttempts: attempt,
      };
    }

    const blockReason =
      (response?.promptFeedback?.blockReason ?? response?.promptFeedback?.block_reason ?? null) as string | null;
    const finishReason = extracted.finishReason ?? null;
    const promptFeedback = extracted.promptFeedback ?? null;

    attempts.push({ blockReason, finishReason, promptFeedback });

    // If there's a blockReason, the content was explicitly blocked - don't retry
    if (blockReason) {
      console.warn(`[api] Gemini image blocked on attempt ${attempt}`, {
        blockReason,
        finishReason,
        promptFeedback,
      });
      const err = new Error(`Gemini image error: content blocked (blockReason=${blockReason})`);
      (err as any).blockReason = blockReason;
      (err as any).finishReason = finishReason;
      (err as any).promptFeedback = promptFeedback;
      (err as any).retryAttempts = attempt;
      (err as any).isTransient = false;
      throw err;
    }

    // Transient failure - retry with exponential backoff + jitter
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100; // Add 0-100ms jitter
      console.log(`[api] Gemini image no inlineData on attempt ${attempt}/${MAX_RETRIES}, retrying in ${Math.round(delay + jitter)}ms...`);
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }

  // All retries exhausted - transient failure
  const lastAttempt = attempts[attempts.length - 1];
  console.warn(`[api] Gemini image failed after ${MAX_RETRIES} attempts`, { attempts });

  const err = new Error(
    `Gemini image error: no inlineData returned after ${MAX_RETRIES} attempts${lastAttempt?.finishReason ? ` (finishReason=${lastAttempt.finishReason})` : ''}`
  );
  (err as any).blockReason = null;
  (err as any).finishReason = lastAttempt?.finishReason ?? null;
  (err as any).promptFeedback = lastAttempt?.promptFeedback ?? null;
  (err as any).retryAttempts = MAX_RETRIES;
  (err as any).isTransient = true;
  throw err;
}

/**
 * Generate image with inline reference images (for person/animal reference)
 */
export async function generateImageWithReferences(options: {
  prompt: string;
  apiKey: string;
  referenceImages: Array<{ data: string; mimeType: string; type: string }>;
  aspectRatio?: string;
  model?: string;
}): Promise<{ imageBase64?: string; mimeType?: string; raw: any; retryAttempts?: number }> {
  const { prompt, apiKey, referenceImages, aspectRatio = '9:16', model = resolveImageModel() } = options;

  const extractInlineData = (
    response: any
  ): { data?: string; mimeType?: string; finishReason?: string | null; promptFeedback?: any } => {
    const parts = response?.candidates?.[0]?.content?.parts;
    const inlinePart = Array.isArray(parts) ? parts.find((p: any) => p?.inlineData?.data) : undefined;
    return {
      data: inlinePart?.inlineData?.data as string | undefined,
      mimeType: inlinePart?.inlineData?.mimeType as string | undefined,
      finishReason: response?.candidates?.[0]?.finishReason ?? null,
      promptFeedback: response?.promptFeedback ?? null,
    };
  };

  // Build content parts with text + inline_data for each reference image
  const parts: any[] = [{ text: prompt }];
  for (const ref of referenceImages) {
    parts.push({
      inlineData: {
        data: ref.data,
        mimeType: ref.mimeType,
      },
    });
  }

  // Retry configuration with exponential backoff
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 500;
  const attempts: { blockReason: string | null; finishReason: string | null; promptFeedback: any }[] = [];

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let response: any;
    try {
      response = await requestGeminiGenerateContent({
        apiKey,
        model,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio },
        },
      });
    } catch (error) {
      const err = error as any;
      const msg = String(err?.message ?? error);
      const status = err instanceof ApiError ? err.status : (typeof err?.httpStatus === 'number' ? err.httpStatus : null);
      const isTransient =
        (typeof status === 'number' && (status === 429 || status >= 500)) ||
        msg.toLowerCase().includes('timeout') ||
        msg.toLowerCase().includes('fetch failed');

      if (err && typeof err === 'object') {
        err.isTransient = isTransient;
        if (typeof err.httpStatus !== 'number' && typeof status === 'number') err.httpStatus = status;
        if (err.retryAttempts == null) err.retryAttempts = attempt;
      }

      attempts.push({
        blockReason: null,
        finishReason: null,
        promptFeedback: { requestError: msg, httpStatus: status },
      });

      if (isTransient && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        const jitter = Math.random() * 100;
        console.log(
          `[api] Gemini image with references request error on attempt ${attempt}/${MAX_RETRIES}, retrying in ${Math.round(delay + jitter)}ms...`,
          { httpStatus: status }
        );
        await new Promise((r) => setTimeout(r, delay + jitter));
        continue;
      }
      throw err ?? error;
    }
    const extracted = extractInlineData(response);
    if (extracted.data) {
      if (attempt > 1) {
        console.log(`[api] Gemini image with references succeeded on attempt ${attempt}/${MAX_RETRIES}`);
      }
      return {
        imageBase64: extracted.data,
        mimeType: extracted.mimeType ?? 'image/png',
        raw: response,
        retryAttempts: attempt,
      };
    }

    const blockReason =
      (response?.promptFeedback?.blockReason ?? response?.promptFeedback?.block_reason ?? null) as string | null;
    const finishReason = extracted.finishReason ?? null;
    const promptFeedback = extracted.promptFeedback ?? null;

    attempts.push({ blockReason, finishReason, promptFeedback });

    // If there's a blockReason, the content was explicitly blocked - don't retry
    if (blockReason) {
      console.warn(`[api] Gemini image with references blocked on attempt ${attempt}`, {
        blockReason,
        finishReason,
        promptFeedback,
      });
      const err = new Error(`Gemini image error: content blocked (blockReason=${blockReason})`);
      (err as any).blockReason = blockReason;
      (err as any).finishReason = finishReason;
      (err as any).promptFeedback = promptFeedback;
      (err as any).retryAttempts = attempt;
      (err as any).isTransient = false;
      throw err;
    }

    // Transient failure - retry with exponential backoff + jitter
    if (attempt < MAX_RETRIES) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 100;
      console.log(`[api] Gemini image with references no inlineData on attempt ${attempt}/${MAX_RETRIES}, retrying in ${Math.round(delay + jitter)}ms...`);
      await new Promise((r) => setTimeout(r, delay + jitter));
    }
  }

  // All retries exhausted - transient failure
  const lastAttempt = attempts[attempts.length - 1];
  console.warn(`[api] Gemini image with references failed after ${MAX_RETRIES} attempts`, { attempts });

  const err = new Error(
    `Gemini image error: no inlineData returned after ${MAX_RETRIES} attempts${lastAttempt?.finishReason ? ` (finishReason=${lastAttempt.finishReason})` : ''}`
  );
  (err as any).blockReason = null;
  (err as any).finishReason = lastAttempt?.finishReason ?? null;
  (err as any).promptFeedback = lastAttempt?.promptFeedback ?? null;
  (err as any).retryAttempts = MAX_RETRIES;
  (err as any).isTransient = true;
  throw err;
}
