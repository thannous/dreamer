import { ApiError, GoogleGenAI } from 'https://esm.sh/@google/genai@1.34.0?target=deno';

/**
 * Classify errors from Gemini API for better error handling
 */
export const classifyGeminiError = (error: any): {
  status: number;
  userMessage: string;
  canRetry: boolean;
  retryAfter?: number;
} => {
  if (error instanceof ApiError) {
    const status = error.status ?? 500;
    if (status === 401) return { status: 401, userMessage: 'Authentication failed', canRetry: false };
    if (status === 403) return { status: 403, userMessage: 'Access denied', canRetry: false };
    if (status === 400) return { status: 400, userMessage: 'Invalid request format', canRetry: false };
    if (status === 404) return { status: 404, userMessage: 'Model not found', canRetry: false };
    if (status === 429) return { status: 429, userMessage: 'Rate limit exceeded', canRetry: true, retryAfter: 60 };
    if (status >= 500) return { status, userMessage: 'Server error, please retry', canRetry: true };
    return { status, userMessage: error.message ?? 'Request failed', canRetry: false };
  }

  const httpStatus = typeof error?.httpStatus === 'number' ? error.httpStatus : null;
  if (httpStatus === 401) return { status: 401, userMessage: 'Authentication failed', canRetry: false };
  if (httpStatus === 403) return { status: 403, userMessage: 'Access denied', canRetry: false };
  if (httpStatus === 400) return { status: 400, userMessage: 'Invalid request format', canRetry: false };
  if (httpStatus === 404) return { status: 404, userMessage: 'Model not found', canRetry: false };
  if (httpStatus === 429) return { status: 429, userMessage: 'Rate limit exceeded', canRetry: true, retryAfter: 60 };
  if (typeof httpStatus === 'number' && httpStatus >= 500) {
    return { status: httpStatus, userMessage: 'Server error, please retry', canRetry: true };
  }

  const message = String(error?.message ?? error);

  // Check for specific error codes in message
  if (message.includes('401')) {
    return { status: 401, userMessage: 'Authentication failed', canRetry: false };
  }
  if (message.includes('403')) {
    return { status: 403, userMessage: 'Access denied', canRetry: false };
  }
  if (message.includes('400') || message.includes('Invalid request')) {
    return { status: 400, userMessage: 'Invalid request format', canRetry: false };
  }
  if (message.includes('404')) {
    return { status: 404, userMessage: 'Model not found', canRetry: false };
  }
  if (message.includes('429') || message.toLowerCase().includes('rate limit')) {
    return { status: 429, userMessage: 'Rate limit exceeded', canRetry: true, retryAfter: 60 };
  }
  if (message.toLowerCase().includes('timeout')) {
    return { status: 504, userMessage: 'Request timeout', canRetry: true };
  }
  if (message.includes('500') || message.includes('502') || message.includes('503')) {
    return { status: 500, userMessage: 'Server error, please retry', canRetry: true };
  }

  return { status: 500, userMessage: 'Unexpected error', canRetry: false };
};

/**
 * Unified helper for Gemini API calls with automatic fallback and structured outputs support
 */
export const callGeminiWithFallback = async (
  apiKey: string,
  primaryModel: string,
  fallbackModel: string,
  contents: any[],
  systemInstruction: string,
  config: {
    temperature?: number;
    responseMimeType?: string;
    responseJsonSchema?: any;
  }
): Promise<{ text: string; raw: any }> => {
  const client = new GoogleGenAI({ apiKey });

  // Lower temperature for JSON generation (more deterministic)
  const temperature = config.responseMimeType === 'application/json' ? 0.2 : (config.temperature ?? 0.7);

  const makeCall = async (modelName: string) => {
    const response = await client.models.generateContent({
      model: modelName,
      contents,
      config: {
        systemInstruction,
        temperature,
        ...(config.responseMimeType ? { responseMimeType: config.responseMimeType } : {}),
        ...(config.responseJsonSchema ? { responseJsonSchema: config.responseJsonSchema } : {}),
      },
    });
    // Return full response object for better observability
    const text = response.text ?? '';
    return { text, raw: response };
  };

  try {
    return await makeCall(primaryModel);
  } catch (err) {
    const error = err as any;
    // Don't fallback on non-retryable errors (per docs, ApiError exposes status codes)
    if (error instanceof ApiError) {
      if ([400, 401, 403, 404].includes(error.status)) throw error;
      if (primaryModel === fallbackModel) throw error;
      console.warn('[api] Primary model failed, retrying with fallback', { primaryModel, status: error.status });
      return await makeCall(fallbackModel);
    }

    const errMsg = String(error?.message ?? error);
    if (errMsg.includes('401') || errMsg.includes('403') || errMsg.includes('Invalid request')) {
      console.error('[api] Non-retryable error, not falling back', { error: errMsg });
      throw err;
    }
    if (primaryModel === fallbackModel) throw err;
    console.warn('[api] Primary model failed, retrying with fallback', primaryModel, err);
    return await makeCall(fallbackModel);
  }
};
