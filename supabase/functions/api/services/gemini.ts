import {
  ApiError as GoogleGenAiApiError,
  GoogleGenAI,
} from 'https://esm.sh/@google/genai@2.12.0?target=deno';

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
  responseMimeType?: string;
  responseJsonSchema?: unknown;
  responseModalities?: ('TEXT' | 'IMAGE' | 'AUDIO')[];
  imageConfig?: {
    aspectRatio?: string;
  };
  thinkingLevel?: GeminiThinkingLevel;
  maxOutputTokens?: number;
};

export const GEMINI_FLASH_MODEL = 'gemini-3.6-flash';
export const GEMINI_FLASH_LITE_MODEL = 'gemini-3.5-flash-lite';
export const GEMINI_FLASH_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const GEMINI_FLASH_LITE_IMAGE_MODEL = 'gemini-3.1-flash-lite-image';

const RETIRED_TEXT_PREVIEW_MODELS = new Set([
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
]);

// Every 1.x/2.x text model is deprecated on the Interactions API; requesting
// one 404s, so stale env overrides silently fall back to current defaults.
export const isRetiredTextModel = (model: string): boolean =>
  model.startsWith('gemini-1.') ||
  model.startsWith('gemini-2.') ||
  RETIRED_TEXT_PREVIEW_MODELS.has(model);

export const resolveTextModel = (
  envNames: string | string[],
  fallbackModel: string,
  readEnv: (name: string) => string | undefined = (name) => Deno.env.get(name)
): string => {
  for (const envName of Array.isArray(envNames) ? envNames : [envNames]) {
    const value = readEnv(envName)?.trim();
    if (!value) continue;
    if (isRetiredTextModel(value)) {
      console.warn('[api] Ignoring retired model override', { envName, model: value });
      continue;
    }
    return value;
  }
  return fallbackModel;
};

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

  const client = new GoogleGenAI({ apiKey });
  clients.set(apiKey, client);
  return client;
};

type InteractionContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mime_type: string };

type InteractionInputStep = {
  type: 'user_input' | 'model_output';
  content: InteractionContentBlock[];
};

// Thought parts are dropped on input: stateless Interactions turns carry plain
// content blocks, and this API has no tool calls that would need signatures.
const toContentBlocks = (parts: GeminiPart[]): InteractionContentBlock[] => {
  const blocks: InteractionContentBlock[] = [];
  for (const part of parts) {
    if (part?.inlineData?.data) {
      blocks.push({
        type: 'image',
        data: part.inlineData.data,
        mime_type: part.inlineData.mimeType || 'image/png',
      });
      continue;
    }
    if (part?.thought === true) continue;
    if (typeof part?.text === 'string' && part.text.length > 0) {
      blocks.push({ type: 'text', text: part.text });
    }
  }
  return blocks;
};

// The steps-based Interactions API rejects `{role, content}` turn lists
// ("use step_list input format instead of turn_list").
const toInteractionInput = (
  contents: GeminiContent[] | string
): string | InteractionInputStep[] => {
  if (!Array.isArray(contents)) return String(contents);

  const steps: InteractionInputStep[] = [];
  for (const content of contents) {
    const blocks = toContentBlocks(content?.parts ?? []);
    if (blocks.length === 0) continue;
    steps.push({
      type: content.role === 'model' ? 'model_output' : 'user_input',
      content: blocks,
    });
  }
  return steps;
};

const toSystemInstruction = (
  systemInstruction?: string | GeminiContent
): string | undefined => {
  if (!systemInstruction) return undefined;
  if (typeof systemInstruction === 'string') return systemInstruction;
  if (typeof systemInstruction === 'object' && Array.isArray(systemInstruction.parts)) {
    const text = systemInstruction.parts
      .map((part) => (typeof part?.text === 'string' ? part.text : ''))
      .filter(Boolean)
      .join('\n');
    return text || undefined;
  }
  return String(systemInstruction);
};

// gemini-3.5-flash-lite rejects 'minimal' ("Allowed values are: low, high"),
// so the lowest level callers can request is normalized to 'low'.
const toThinkingLevel = (
  thinkingLevel?: GeminiThinkingLevel
): 'low' | 'medium' | 'high' | undefined => {
  if (!thinkingLevel) return undefined;
  return thinkingLevel === 'minimal' ? 'low' : thinkingLevel;
};

const toResponseFormat = (
  config?: GeminiGenerationConfig
): Record<string, unknown> | undefined => {
  if (config?.responseModalities?.includes('IMAGE')) {
    return {
      type: 'image',
      ...(config.imageConfig?.aspectRatio
        ? { aspect_ratio: config.imageConfig.aspectRatio }
        : {}),
    };
  }
  if (config?.responseJsonSchema) {
    return {
      type: 'text',
      mime_type: config.responseMimeType ?? 'application/json',
      schema: config.responseJsonSchema,
    };
  }
  if (config?.responseMimeType) {
    return { type: 'text', mime_type: config.responseMimeType };
  }
  return undefined;
};

const extractText = (interaction: any): string => {
  if (typeof interaction?.output_text === 'string' && interaction.output_text.trim()) {
    return interaction.output_text;
  }

  const steps = interaction?.steps;
  if (!Array.isArray(steps)) return '';
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const text = step.content
      .map((block: any) =>
        block?.type === 'text' && typeof block.text === 'string' ? block.text : ''
      )
      .join('');
    if (text) return text;
  }
  return '';
};

export const extractInteractionImage = (
  interaction: any
): { data?: string; mimeType?: string } => {
  const direct = interaction?.output_image;
  if (typeof direct?.data === 'string' && direct.data) {
    return { data: direct.data, mimeType: direct.mime_type };
  }

  const steps = interaction?.steps;
  if (!Array.isArray(steps)) return {};
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    const image = step.content.find(
      (block: any) => block?.type === 'image' && typeof block?.data === 'string' && block.data
    );
    if (image) return { data: image.data, mimeType: image.mime_type };
  }
  return {};
};

/**
 * Convert an interaction's model steps back to the legacy `GeminiPart[]` shape
 * persisted in chat history (`chat_history` rows predate the Interactions API).
 */
export const extractModelParts = (interaction: any): GeminiPart[] => {
  const steps = interaction?.steps;
  if (!Array.isArray(steps)) return [];

  const parts: GeminiPart[] = [];
  for (const step of steps) {
    if (step?.type === 'thought') {
      parts.push({
        thought: true,
        ...(typeof step.signature === 'string' && step.signature
          ? { thoughtSignature: step.signature }
          : {}),
      });
      continue;
    }
    if (step?.type !== 'model_output' || !Array.isArray(step.content)) continue;
    for (const block of step.content) {
      if (block?.type === 'text' && typeof block.text === 'string' && block.text) {
        parts.push({ text: block.text });
      } else if (block?.type === 'image' && typeof block?.data === 'string' && block.data) {
        parts.push({
          inlineData: { data: block.data, mimeType: block.mime_type ?? 'image/png' },
        });
      }
    }
  }
  return parts;
};

type GeminiRequestOptions = {
  apiKey: string;
  model: string;
  contents: GeminiContent[] | string;
  systemInstruction?: string | GeminiContent;
  config?: GeminiGenerationConfig;
};

const buildInteractionParams = (options: GeminiRequestOptions) => {
  const { model, contents, systemInstruction, config } = options;
  const system = toSystemInstruction(systemInstruction);
  const responseFormat = toResponseFormat(config);
  const thinkingLevel = toThinkingLevel(config?.thinkingLevel);
  const generationConfig = {
    ...(thinkingLevel ? { thinking_level: thinkingLevel } : {}),
    ...(typeof config?.maxOutputTokens === 'number'
      ? { max_output_tokens: config.maxOutputTokens }
      : {}),
  };

  return {
    model,
    input: toInteractionInput(contents),
    // Dream content is sensitive user data — never retain it server-side.
    store: false,
    ...(system ? { system_instruction: system } : {}),
    ...(responseFormat ? { response_format: responseFormat } : {}),
    ...(Object.keys(generationConfig).length > 0
      ? { generation_config: generationConfig }
      : {}),
  };
};

const toApiError = (error: unknown): unknown => {
  if (error instanceof GoogleGenAiApiError) {
    return new ApiError({
      message: error.message ?? 'Gemini API error',
      status: error.status ?? 500,
      body: (error as { error?: unknown }).error,
    });
  }
  return error;
};

export const requestGeminiGenerateContent = async (
  options: GeminiRequestOptions
): Promise<any> => {
  const client = getClient(options.apiKey);
  try {
    return await client.interactions.create(buildInteractionParams(options));
  } catch (error) {
    throw toApiError(error);
  }
};

/**
 * Streaming variant: returns the SDK's async iterable of interaction SSE
 * events (step.delta text chunks, interaction.completed, ...).
 */
export const requestGeminiStream = async (
  options: GeminiRequestOptions
): Promise<AsyncIterable<any>> => {
  const client = getClient(options.apiKey);
  try {
    return (await client.interactions.create({
      ...buildInteractionParams(options),
      stream: true,
    })) as AsyncIterable<any>;
  } catch (error) {
    throw toApiError(error);
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
    if (!text && raw?.status === 'failed') {
      throw new ApiError({
        message: String((raw?.error as { message?: unknown })?.message ?? 'Interaction failed'),
        status: 502,
        body: raw?.error,
      });
    }
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
      console.error('[api] Non-retryable model request failure; fallback disabled');
      throw err;
    }
    if (primaryModel === fallbackModel) throw err;
    console.warn('[api] Primary model failed, retrying with fallback', { primaryModel });
    return await makeCall(fallbackModel);
  }
};
