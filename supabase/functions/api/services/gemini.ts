import {
  ApiError as GoogleGenAiApiError,
  GoogleGenAI,
  Modality,
  ThinkingLevel,
} from 'https://esm.sh/@google/genai@1.34.0?target=deno';

export type GeminiInlineData = {
  data: string;
  mimeType: string;
};

export type GeminiPart = {
  text?: string;
  inlineData?: GeminiInlineData;
  thought?: boolean;
  thoughtSignature?: string;
};

export type GeminiContent = {
  role?: string;
  parts: GeminiPart[];
};

type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export type GeminiGenerationConfig = {
  temperature?: number;
  responseMimeType?: string;
  responseJsonSchema?: unknown;
  responseModalities?: ('TEXT' | 'IMAGE' | 'AUDIO')[];
  imageConfig?: {
    aspectRatio?: string;
  };
  thinkingLevel?: GeminiThinkingLevel;
};

export const GEMINI_FLASH_MODEL = 'gemini-3-flash-preview';
export const GEMINI_FLASH_LITE_MODEL = 'gemini-3.1-flash-lite-preview';
export const GEMINI_FLASH_IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

export class ApiError extends Error {
  public readonly status: number;
  public readonly httpStatus: number;
  public readonly body?: unknown;

  constructor(options: { message: string; status: number; body?: unknown }) {
    super(options.message);
    this.name = 'ApiError';
    this.status = options.status;
    this.httpStatus = options.status;
    this.body = options.body;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const clients = new Map<string, GoogleGenAI>();

const getClient = (apiKey: string): GoogleGenAI => {
  const cached = clients.get(apiKey);
  if (cached) return cached;

  const client = new GoogleGenAI({ apiKey, apiVersion: 'v1beta' });
  clients.set(apiKey, client);
  return client;
};

const normalizeContents = (contents: GeminiContent[] | string): GeminiContent[] | string => {
  if (Array.isArray(contents)) return contents;
  return String(contents);
};

const normalizeSystemInstruction = (
  systemInstruction?: string | GeminiContent
): string | GeminiContent | undefined => {
  if (!systemInstruction) return undefined;
  if (typeof systemInstruction === 'string') return systemInstruction;
  if (typeof systemInstruction === 'object' && Array.isArray(systemInstruction.parts)) {
    return systemInstruction;
  }
  return String(systemInstruction);
};

const toSdkModality = (modality: 'TEXT' | 'IMAGE' | 'AUDIO'): Modality => {
  switch (modality) {
    case 'IMAGE':
      return Modality.IMAGE;
    case 'AUDIO':
      return Modality.AUDIO;
    case 'TEXT':
    default:
      return Modality.TEXT;
  }
};

const toSdkThinkingLevel = (thinkingLevel?: GeminiThinkingLevel): ThinkingLevel | undefined => {
  switch (thinkingLevel) {
    case 'minimal':
      return ThinkingLevel.MINIMAL;
    case 'low':
      return ThinkingLevel.LOW;
    case 'medium':
      return ThinkingLevel.MEDIUM;
    case 'high':
      return ThinkingLevel.HIGH;
    default:
      return undefined;
  }
};

const extractText = (response: any): string => {
  if (typeof response?.text === 'string' && response.text.trim()) {
    return response.text;
  }

  const parts = response?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map((part: any) => {
      if (part?.thought === true) return '';
      return typeof part?.text === 'string' ? part.text : '';
    })
    .join('');
};

export const requestGeminiGenerateContent = async (options: {
  apiKey: string;
  model: string;
  contents: GeminiContent[] | string;
  systemInstruction?: string | GeminiContent;
  config?: GeminiGenerationConfig;
}): Promise<any> => {
  const { apiKey, model, contents, systemInstruction, config } = options;
  const client = getClient(apiKey);
  const normalizedSystem = normalizeSystemInstruction(systemInstruction);
  const sdkThinkingLevel = toSdkThinkingLevel(config?.thinkingLevel);

  try {
    return await client.models.generateContent({
      model,
      contents: normalizeContents(contents),
      config: {
        ...(normalizedSystem ? { systemInstruction: normalizedSystem } : {}),
        ...(typeof config?.temperature === 'number' ? { temperature: config.temperature } : {}),
        ...(config?.responseMimeType ? { responseMimeType: config.responseMimeType } : {}),
        ...(config?.responseJsonSchema ? { responseJsonSchema: config.responseJsonSchema } : {}),
        ...(config?.responseModalities?.length
          ? { responseModalities: config.responseModalities.map(toSdkModality) }
          : {}),
        ...(config?.imageConfig ? { imageConfig: config.imageConfig } : {}),
        ...(sdkThinkingLevel ? { thinkingConfig: { thinkingLevel: sdkThinkingLevel } } : {}),
      },
    });
  } catch (error) {
    if (error instanceof GoogleGenAiApiError) {
      throw new ApiError({
        message: error.message ?? 'Gemini API error',
        status: error.status ?? 500,
        body: (error as { error?: unknown }).error,
      });
    }
    throw error;
  }
};

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

  const httpStatus = typeof error?.httpStatus === 'number'
    ? error.httpStatus
    : typeof error?.status === 'number'
      ? error.status
      : null;

  if (httpStatus === 401) return { status: 401, userMessage: 'Authentication failed', canRetry: false };
  if (httpStatus === 403) return { status: 403, userMessage: 'Access denied', canRetry: false };
  if (httpStatus === 400) return { status: 400, userMessage: 'Invalid request format', canRetry: false };
  if (httpStatus === 404) return { status: 404, userMessage: 'Model not found', canRetry: false };
  if (httpStatus === 429) return { status: 429, userMessage: 'Rate limit exceeded', canRetry: true, retryAfter: 60 };
  if (typeof httpStatus === 'number' && httpStatus >= 500) {
    return { status: httpStatus, userMessage: 'Server error, please retry', canRetry: true };
  }

  const message = String(error?.message ?? error);

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
  contents: GeminiContent[],
  systemInstruction: string,
  config: GeminiGenerationConfig
): Promise<{ text: string; raw: any }> => {
  const makeCall = async (modelName: string) => {
    const raw = await requestGeminiGenerateContent({
      apiKey,
      model: modelName,
      contents,
      systemInstruction,
      config,
    });
    const text = extractText(raw);
    return { text, raw };
  };

  try {
    return await makeCall(primaryModel);
  } catch (err) {
    const error = err as any;
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
