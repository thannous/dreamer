import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { buildDreamContextPrompt } from '../lib/prompts.ts';
import {
  callGeminiWithFallback,
  classifyGeminiError,
  extractModelParts,
  GEMINI_FLASH_LITE_MODEL,
  type GeminiGenerationConfig,
  type GeminiPart,
  requestGeminiStream,
  resolveTextModel,
} from '../services/gemini.ts';
import { requireGuestSession } from '../lib/guards.ts';
import {
  AI_REQUEST_LIMITS,
  aiInputErrorResponse,
  isValidUuid,
  normalizeAiLanguage,
  validateBoundedText,
} from '../lib/aiRequestPolicy.ts';
import { admitSynchronousAiRequest } from '../services/aiAdmission.ts';
import type { ApiContext } from '../types.ts';

const MAX_HISTORY_TURNS = 20;

type ChatDependencies = {
  admitRequest?: typeof admitSynchronousAiRequest;
};

type StoredChatMessage = {
  id?: string;
  role: string;
  text?: string;
  parts?: GeminiPart[];
  createdAt?: number;
  meta?: StoredChatMessageMeta;
};

type AuthenticatedChatTurnAdmission = {
  allowed?: boolean;
  duplicate?: boolean;
  completed?: boolean;
  code?: string;
  retry_after_seconds?: number;
  attemptCount?: number;
  used?: number;
  limit?: number;
  modelMessage?: StoredChatMessage | null;
  history?: StoredChatMessage[];
  dream?: {
    id: string | number;
    transcript?: string;
    title?: string;
    interpretation?: string;
    shareable_quote?: string;
    dream_type?: string;
    theme?: string | null;
  };
};

type StoredChatMessageMeta = {
  category?: 'symbols' | 'emotions' | 'growth' | 'general';
  exploration360Synthesis?: boolean;
  isError?: boolean;
  retry?: {
    messageText: string;
    displayText?: string;
    clientRequestId?: string;
  };
};

type ClientDreamContext = {
  transcript?: unknown;
  title?: unknown;
  interpretation?: unknown;
  shareableQuote?: unknown;
  dreamType?: unknown;
  theme?: unknown;
  chatHistory?: unknown;
};

const ALLOWED_CHAT_CATEGORIES = new Set(['symbols', 'emotions', 'growth', 'general']);
const GUEST_CONTEXT_LIMITS = {
  transcript: 6000,
  interpretation: 4000,
  title: 200,
  shareableQuote: 500,
  dreamType: 120,
  theme: 120,
  chatHistoryMessages: GUEST_LIMITS.messagesPerDream * 2,
  chatMessageText: 4000,
} as const;

const toCount = (value: unknown): number => {
  if (typeof value !== 'number') return 0;
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const serviceUnavailable = (message = 'Service unavailable') =>
  new Response(JSON.stringify({ error: message }), {
    status: 503,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const trimToLimit = (value: unknown, maxChars: number): string => {
  const text = String(value ?? '').trim();
  return text.length > maxChars ? text.slice(0, maxChars).trimEnd() : text;
};

const sanitizeMessageMeta = (meta: unknown): StoredChatMessageMeta | undefined => {
  if (!meta || typeof meta !== 'object') return undefined;

  const candidate = meta as Record<string, unknown>;
  const sanitized: StoredChatMessageMeta = {};

  if (typeof candidate.category === 'string' && ALLOWED_CHAT_CATEGORIES.has(candidate.category)) {
    sanitized.category = candidate.category as StoredChatMessageMeta['category'];
  }

  if (typeof candidate.exploration360Synthesis === 'boolean') {
    sanitized.exploration360Synthesis = candidate.exploration360Synthesis;
  }

  if (typeof candidate.isError === 'boolean') {
    sanitized.isError = candidate.isError;
  }

  if (candidate.retry && typeof candidate.retry === 'object') {
    const retry = candidate.retry as Record<string, unknown>;
    const retryMessageText = trimToLimit(
      retry.messageText,
      AI_REQUEST_LIMITS.chatMessageChars
    );
    if (retryMessageText) {
      const retryDisplayText = trimToLimit(
        retry.displayText,
        AI_REQUEST_LIMITS.chatMessageChars
      );
      const retryClientRequestId = typeof retry.clientRequestId === 'string'
        && isValidUuid(retry.clientRequestId.trim())
        ? retry.clientRequestId.trim()
        : undefined;
      sanitized.retry = {
        messageText: retryMessageText,
        ...(retryDisplayText ? { displayText: retryDisplayText } : {}),
        ...(retryClientRequestId ? { clientRequestId: retryClientRequestId } : {}),
      };
    }
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
};

const sanitizeParts = (parts: unknown): GeminiPart[] | undefined => {
  if (!Array.isArray(parts)) return undefined;

  const sanitized = parts
    .map((part) => {
      if (!part || typeof part !== 'object') return null;
      const candidate = part as Record<string, unknown>;
      const text = typeof candidate.text === 'string' ? candidate.text : undefined;
      const thought = typeof candidate.thought === 'boolean' ? candidate.thought : undefined;
      const thoughtSignature = typeof candidate.thoughtSignature === 'string'
        ? candidate.thoughtSignature
        : undefined;
      const inlineData =
        candidate.inlineData
        && typeof candidate.inlineData === 'object'
        && typeof (candidate.inlineData as Record<string, unknown>).data === 'string'
        && typeof (candidate.inlineData as Record<string, unknown>).mimeType === 'string'
          ? {
              data: String((candidate.inlineData as Record<string, unknown>).data),
              mimeType: String((candidate.inlineData as Record<string, unknown>).mimeType),
            }
          : undefined;

      if (!text && thought == null && !thoughtSignature && !inlineData) return null;
      return {
        ...(text ? { text } : {}),
        ...(thought != null ? { thought } : {}),
        ...(thoughtSignature ? { thoughtSignature } : {}),
        ...(inlineData ? { inlineData } : {}),
      };
    })
    .filter((part): part is GeminiPart => part !== null);

  return sanitized.length > 0 ? sanitized : undefined;
};

const normalizeEffectiveSubscriptionTier = (tier: unknown): 'free' | 'plus' => {
  return tier === 'plus' ? 'plus' : 'free';
};

const getEffectiveSubscriptionTier = async (
  supabase: ApiContext['supabase'],
  userId: string | null
): Promise<'free' | 'plus'> => {
  if (!userId) return 'free';

  const { data, error } = await supabase.rpc('get_effective_subscription_tier', {
    p_user_id: userId,
  });

  if (error) {
    console.warn('[api] /chat: failed to resolve subscription tier for synthesis gate', {
      code: error?.code ?? null,
    });
    return 'free';
  }

  return normalizeEffectiveSubscriptionTier(data);
};

const createSynthesisUpgradeRequiredResponse = () =>
  new Response(
    JSON.stringify({
      error: 'EXPLORATION_360_SYNTHESIS_PLUS_REQUIRED',
      code: 'EXPLORATION_360_SYNTHESIS_PLUS_REQUIRED',
      userMessage: 'Upgrade to Noctalia Plus to generate the 360 synthesis.',
    }),
    {
      status: 402,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    }
  );

const getMessageText = (message: StoredChatMessage): string => {
  if (typeof message.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }

  const parts = sanitizeParts(message.parts);
  if (!parts) return '';

  return parts
    .map((part) => (part.thought === true ? '' : part.text ?? ''))
    .join('')
    .trim();
};

const toContentParts = (message: StoredChatMessage): GeminiPart[] => {
  const parts = sanitizeParts(message.parts);
  if (parts) return parts;

  const text = getMessageText(message);
  return text ? [{ text }] : [];
};

const sanitizeClientHistoryMessage = (message: unknown): StoredChatMessage | null => {
  if (!message || typeof message !== 'object') return null;

  const candidate = message as Record<string, unknown>;
  const role = candidate.role === 'model' ? 'model' : candidate.role === 'user' ? 'user' : null;
  if (!role) return null;

  const text = trimToLimit(getMessageText(candidate as StoredChatMessage), GUEST_CONTEXT_LIMITS.chatMessageText);
  if (!text) return null;

  const meta = sanitizeMessageMeta(candidate.meta);
  return {
    role,
    text,
    parts: [{ text }],
    ...(meta ? { meta } : {}),
  };
};

const sanitizeGuestChatHistory = (chatHistory: unknown, currentUserMessage: string): StoredChatMessage[] => {
  if (!Array.isArray(chatHistory)) return [];

  const sanitized = chatHistory
    .slice(-GUEST_CONTEXT_LIMITS.chatHistoryMessages)
    .map(sanitizeClientHistoryMessage)
    .filter((message): message is StoredChatMessage => message !== null);

  const lastMessage = sanitized[sanitized.length - 1];
  if (lastMessage?.role === 'user' && getMessageText(lastMessage) === currentUserMessage) {
    return sanitized.slice(0, -1);
  }

  return sanitized;
};

const normalizeGuestDreamContext = (
  dreamId: string,
  dreamContext: ClientDreamContext,
  currentUserMessage: string
) => ({
  id: dreamId,
  user_id: null,
  chat_history: sanitizeGuestChatHistory(dreamContext.chatHistory, currentUserMessage),
  transcript: trimToLimit(dreamContext.transcript, GUEST_CONTEXT_LIMITS.transcript),
  title: trimToLimit(dreamContext.title || 'Untitled Dream', GUEST_CONTEXT_LIMITS.title),
  interpretation: trimToLimit(dreamContext.interpretation, GUEST_CONTEXT_LIMITS.interpretation),
  shareable_quote: trimToLimit(dreamContext.shareableQuote, GUEST_CONTEXT_LIMITS.shareableQuote),
  dream_type: trimToLimit(dreamContext.dreamType || 'Dream', GUEST_CONTEXT_LIMITS.dreamType),
  theme: dreamContext.theme == null ? null : trimToLimit(dreamContext.theme, GUEST_CONTEXT_LIMITS.theme),
});

const markAuthenticatedTurnFailed = async (
  supabase: ApiContext['supabase'],
  turn: { dreamId: number; requestId: string; attemptCount: number } | null,
  errorCode: string
) => {
  if (!turn) return;
  const { error } = await supabase.rpc('fail_authenticated_chat_turn', {
    p_dream_id: turn.dreamId,
    p_request_id: turn.requestId,
    p_attempt_count: turn.attemptCount,
    p_error_code: errorCode,
  });
  if (error) {
    console.warn('[api] /chat: failed to release chat turn', {
      code: error?.code ?? null,
    });
  }
};

export async function handleChat(
  ctx: ApiContext,
  dependencies: ChatDependencies = {}
): Promise<Response> {
  const { req, supabase, user, supabaseUrl, supabaseServiceRoleKey } = ctx;
  let authenticatedTurn: {
    dreamId: number;
    requestId: string;
    attemptCount: number;
  } | null = null;

  try {
    const body = (await req.json()) as {
      dreamId?: string;
      message?: string;
      lang?: string;
      fingerprint?: string;
      messageMeta?: unknown;
      dreamContext?: unknown;
      clientRequestId?: unknown;
      stream?: unknown;
    };

    const guestCheck = await requireGuestSession(req, body, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const fingerprint = guestCheck.fingerprint;
    const dreamIdInput = validateBoundedText(body?.dreamId, {
      field: 'dreamId',
      maxChars: AI_REQUEST_LIMITS.dreamIdChars,
    });
    if (!dreamIdInput.ok) return aiInputErrorResponse(dreamIdInput);
    const messageInput = validateBoundedText(body?.message, {
      field: 'message',
      maxChars: AI_REQUEST_LIMITS.chatMessageChars,
    });
    if (!messageInput.ok) return aiInputErrorResponse(messageInput);
    const languageInput = validateBoundedText(body?.lang, {
      field: 'lang',
      maxChars: AI_REQUEST_LIMITS.languageChars,
      required: false,
    });
    if (!languageInput.ok) return aiInputErrorResponse(languageInput);
    const dreamId = dreamIdInput.value;
    const userMessage = messageInput.value;
    const lang = normalizeAiLanguage(languageInput.value || 'en');
    const requestIdInput = validateBoundedText(body.clientRequestId, {
      field: 'clientRequestId',
      maxChars: AI_REQUEST_LIMITS.clientRequestIdChars,
      required: false,
    });
    if (!requestIdInput.ok) return aiInputErrorResponse(requestIdInput);
    if (requestIdInput.value && !isValidUuid(requestIdInput.value)) {
      return aiInputErrorResponse({
        ok: false,
        code: 'INVALID_INPUT',
        field: 'clientRequestId',
      });
    }
    const clientRequestId = requestIdInput.value || crypto.randomUUID();
    const wantsStream = body.stream === true;

    const admission = await (dependencies.admitRequest ?? admitSynchronousAiRequest)({
      ctx,
      capability: 'chat',
      guestFingerprint: fingerprint,
    });
    if (admission instanceof Response) return admission;

    const currentUserId = user?.id ?? null;
    const messageMeta = sanitizeMessageMeta(body?.messageMeta);
    if (messageMeta?.exploration360Synthesis) {
      const effectiveTier = await getEffectiveSubscriptionTier(supabase, currentUserId);
      if (effectiveTier !== 'plus') {
        console.log('[api] /chat: blocked non-plus Exploration 360 synthesis', {
          effectiveTier,
        });
        return createSynthesisUpgradeRequiredResponse();
      }
    }

    const clientDreamContext = body.dreamContext
      && typeof body.dreamContext === 'object'
      && !Array.isArray(body.dreamContext)
      ? (body.dreamContext as ClientDreamContext)
      : null;
    if (body.dreamContext && !clientDreamContext) {
      return new Response(JSON.stringify({ error: 'dreamContext must be an object' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    let dream: {
      id: string;
      user_id: string | null;
      chat_history: StoredChatMessage[];
      transcript: string;
      title: string;
      interpretation: string;
      shareable_quote: string;
      dream_type: string;
      theme: string | null;
    };
    let shouldPersist = true;
    let historyWithUserMsg: StoredChatMessage[] = [];
    let cachedModelMessage: StoredChatMessage | null = null;
    const newUserMessage: StoredChatMessage = {
      id: clientRequestId,
      role: 'user',
      text: userMessage,
      parts: [{ text: userMessage }],
      createdAt: Date.now(),
      ...(messageMeta ? { meta: messageMeta } : {}),
    };

    if (clientDreamContext && !user) {
      console.log('[api] /chat: guest mode with bounded dream context');
      shouldPersist = false;
      dream = normalizeGuestDreamContext(dreamId, clientDreamContext, userMessage);
      const existingHistory = Array.isArray(dream.chat_history)
        ? (dream.chat_history as StoredChatMessage[])
        : [];
      historyWithUserMsg = [...existingHistory, newUserMessage];
    } else {
      if (clientDreamContext && user) {
        console.warn('[api] /chat: ignoring client dreamContext for authenticated request');
      }
      if (!user) {
        return new Response(JSON.stringify({ error: 'Guest dreamContext is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const remoteDreamId = Number(dreamId);
      if (!Number.isSafeInteger(remoteDreamId) || remoteDreamId <= 0) {
        return aiInputErrorResponse({ ok: false, code: 'INVALID_INPUT', field: 'dreamId' });
      }

      const { data: turnData, error: turnError } = await supabase.rpc(
        'begin_authenticated_chat_turn',
        {
          p_dream_id: remoteDreamId,
          p_request_id: clientRequestId,
          p_user_message: newUserMessage,
        }
      );
      if (turnError) {
        console.warn('[api] /chat: atomic turn admission failed', {
          code: turnError?.code ?? null,
        });
        return serviceUnavailable('Chat state unavailable');
      }

      const turn = (turnData ?? {}) as AuthenticatedChatTurnAdmission;
      if (!turn.allowed) {
        if (turn.code === 'DREAM_NOT_FOUND') {
          return new Response(JSON.stringify({ error: 'Dream not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (
          turn.code === 'CHAT_TURN_IN_PROGRESS'
          || turn.code === 'CHAT_DREAM_BUSY'
          || turn.code === 'CHAT_ACTOR_CONCURRENCY_LIMIT'
        ) {
          const retryAfter = Math.max(1, Math.floor(turn.retry_after_seconds ?? 5));
          return new Response(JSON.stringify({
            error: turn.code === 'CHAT_ACTOR_CONCURRENCY_LIMIT'
              ? 'Too many chat turns are already in progress'
              : 'Chat turn is already in progress',
            code: turn.code,
            retryAfter,
          }), {
            status: 409,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': String(retryAfter),
              ...corsHeaders,
            },
          });
        }
        if (turn.code === 'CHAT_TURN_ATTEMPTS_EXHAUSTED') {
          return new Response(JSON.stringify({
            error: 'This chat turn can no longer be retried',
            code: turn.code,
          }), {
            status: 409,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (turn.code === 'QUOTA_MESSAGE_LIMIT_REACHED') {
          return new Response(JSON.stringify({
            error: 'QUOTA_MESSAGE_LIMIT_REACHED',
            userMessage: 'You have reached your message limit for this dream.',
            usage: { messages: { used: toCount(turn.used), limit: turn.limit ?? null } },
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        if (turn.code === 'QUOTA_EXPLORATION_LIMIT_REACHED') {
          return new Response(JSON.stringify({
            error: 'Exploration limit reached',
            code: turn.code,
            usage: { exploration: { used: toCount(turn.used), limit: turn.limit ?? null } },
          }), {
            status: 429,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }
        return serviceUnavailable('Chat admission unavailable');
      }

      const admittedDream = turn.dream;
      if (!admittedDream) return serviceUnavailable('Chat context unavailable');
      dream = {
        id: String(admittedDream.id),
        user_id: currentUserId,
        chat_history: Array.isArray(turn.history) ? turn.history : [],
        transcript: String(admittedDream.transcript ?? ''),
        title: String(admittedDream.title ?? ''),
        interpretation: String(admittedDream.interpretation ?? ''),
        shareable_quote: String(admittedDream.shareable_quote ?? ''),
        dream_type: String(admittedDream.dream_type ?? 'Dream'),
        theme: admittedDream.theme == null ? null : String(admittedDream.theme),
      };
      historyWithUserMsg = dream.chat_history;
      cachedModelMessage = turn.completed ? turn.modelMessage ?? null : null;
      if (!turn.completed) {
        const attemptCount = Number(turn.attemptCount);
        if (!Number.isSafeInteger(attemptCount) || attemptCount < 1 || attemptCount > 10) {
          return serviceUnavailable('Chat attempt unavailable');
        }
        authenticatedTurn = {
          dreamId: remoteDreamId,
          requestId: clientRequestId,
          attemptCount,
        };
      }
    }

    if (!user && !shouldPersist) {
      if (!supabaseServiceRoleKey || !fingerprint) {
        console.error('[api] /chat: guest quota unavailable before provider work', {
          hasServiceRoleKey: !!supabaseServiceRoleKey,
          hasFingerprint: !!fingerprint,
        });
        return serviceUnavailable('Guest quota unavailable');
      }

      const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const { data: quotaResult, error: quotaError } = await adminClient.rpc('claim_guest_chat_message', {
        p_fingerprint: fingerprint,
        p_dream_key: dreamId,
        p_request_id: clientRequestId,
        p_limit: GUEST_LIMITS.messagesPerDream,
      });

      if (quotaError) {
        console.error('[api] /chat: guest message safety claim failed before provider work', {
          code: quotaError?.code ?? null,
        });
        return serviceUnavailable('Guest quota unavailable');
      }

      if (!quotaResult?.allowed) {
        const used = toCount((quotaResult as any)?.new_count);
        const effectiveLimit = toCount((quotaResult as any)?.limit);
        const payload = {
          error: 'QUOTA_MESSAGE_LIMIT_REACHED',
          code: 'QUOTA_MESSAGE_LIMIT_REACHED',
          userMessage: 'You have reached the safety limit for this dream.',
          usage: { messages: { used, limit: effectiveLimit } },
        };

        console.log('[api] /chat: guest message safety limit reached before provider work', {
          fingerprint: '[redacted]',
          used,
          riskLevel: (quotaResult as any)?.risk_level ?? 'unknown',
        });
        return new Response(JSON.stringify(payload), {
          status: 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    if (cachedModelMessage) {
      const cachedReply = getMessageText(cachedModelMessage);
      if (!cachedReply) return serviceUnavailable('Cached chat response unavailable');
      if (!wantsStream) {
        return new Response(JSON.stringify({ text: cachedReply, message: cachedModelMessage }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const encoder = new TextEncoder();
      return new Response(new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ done: true, text: cachedReply, message: cachedModelMessage })}\n\n`
          ));
          controller.close();
        },
      }), {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...corsHeaders,
        },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const systemPreamble =
      lang === 'fr'
        ? 'Tu es un assistant empathique qui aide à interpréter les rêves. Sois clair, bienveillant et évite les affirmations médicales. Réponds en français.'
        : lang === 'es'
          ? 'Eres un asistente empático que ayuda a interpretar sueños. Sé claro y amable, evita afirmaciones médicas. Responde en español.'
          : lang === 'de'
            ? 'Du bist ein einfühlsamer Assistent, der bei der Traumdeutung hilft. Sei klar und freundlich, vermeide medizinische Aussagen. Antworte auf Deutsch.'
            : lang === 'it'
              ? 'Sei un assistente empatico che aiuta a interpretare i sogni. Sii chiaro e gentile, evita affermazioni mediche. Rispondi in italiano.'
              : 'You are an empathetic assistant helping interpret dreams. Be clear and kind, avoid medical claims. Reply in English.';

    const contents: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];
    const { prompt: dreamContextPrompt, debug: contextDebug } = buildDreamContextPrompt(dream, lang);
    contents.push({ role: 'user', parts: [{ text: dreamContextPrompt }] });

    console.log('[api] /chat: injected dream context', {
      lang,
      transcriptLength: String(dream.transcript ?? '').length,
      interpretationLength: String(dream.interpretation ?? '').length,
      transcriptTruncated: contextDebug.transcriptTruncated,
      interpretationTruncated: contextDebug.interpretationTruncated,
      historyLength: historyWithUserMsg.length,
    });

    // Cap resent history: stateless calls resend every turn, so long chats
    // grow token cost linearly. The dream context plus recent turns is enough.
    for (const turn of historyWithUserMsg.slice(-MAX_HISTORY_TURNS)) {
      const r = turn.role === 'model' ? 'model' : 'user';
      const parts = toContentParts(turn);
      if (parts.length > 0) contents.push({ role: r, parts });
    }

    const primaryModel = resolveTextModel(
      ['GEMINI_CHAT_MODEL', 'GEMINI_LITE_MODEL'],
      GEMINI_FLASH_LITE_MODEL
    );
    const fallbackModel = resolveTextModel('GEMINI_LITE_MODEL', GEMINI_FLASH_LITE_MODEL);
    const chatConfig: GeminiGenerationConfig = { thinkingLevel: 'minimal', maxOutputTokens: 2048 };

    const buildModelMessage = (reply: string, rawParts: GeminiPart[] | null): StoredChatMessage => {
      const modelParts = sanitizeParts(rawParts);
      return {
        id: crypto.randomUUID(),
        role: 'model',
        text: reply,
        createdAt: Date.now(),
        ...(modelParts ? { parts: modelParts } : {}),
      };
    };

    const persistModelMessage = async (modelMessage: StoredChatMessage) => {
      if (!shouldPersist || !authenticatedTurn) return;
      const { data, error } = await supabase.rpc('complete_authenticated_chat_turn', {
        p_dream_id: authenticatedTurn.dreamId,
        p_request_id: authenticatedTurn.requestId,
        p_attempt_count: authenticatedTurn.attemptCount,
        p_model_message: modelMessage,
      });
      if (error || (data as { completed?: boolean } | null)?.completed !== true) {
        console.warn('[api] /chat: failed to commit atomic chat turn', {
          code: error?.code ?? (data as { code?: string } | null)?.code ?? null,
        });
        throw new Error('Failed to persist chat response');
      }
    };

    if (wantsStream) {
      // Stream setup errors (including a one-shot model fallback) happen before
      // the response starts, so they still surface as normal JSON errors.
      let events: AsyncIterable<any>;
      const streamOptions = (model: string) => ({
        apiKey,
        model,
        contents,
        systemInstruction: systemPreamble,
        config: chatConfig,
      });
      try {
        events = await requestGeminiStream(streamOptions(primaryModel));
      } catch (streamError) {
        if (primaryModel === fallbackModel) throw streamError;
        console.warn('[api] /chat: primary stream failed, retrying with fallback', {
          primaryModel,
        });
        events = await requestGeminiStream(streamOptions(fallbackModel));
      }

      const encoder = new TextEncoder();
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          const send = (payload: unknown) =>
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
          let accumulated = '';
          let finalInteraction: any = null;
          try {
            for await (const event of events) {
              if (
                event?.event_type === 'step.delta'
                && event?.delta?.type === 'text'
                && typeof event.delta.text === 'string'
              ) {
                accumulated += event.delta.text;
                send({ delta: event.delta.text });
              } else if (event?.event_type === 'interaction.completed') {
                finalInteraction = event?.interaction ?? null;
              }
            }

            const reply = accumulated.trim();
            if (!reply) throw new Error('Empty model response');

            const rawParts = finalInteraction ? extractModelParts(finalInteraction) : null;
            const modelMessage = buildModelMessage(
              reply,
              rawParts && rawParts.length > 0 ? rawParts : [{ text: reply }]
            );
            await persistModelMessage(modelMessage);
            send({ done: true, text: reply, message: modelMessage });
          } catch (streamError) {
            console.error('[api] /chat stream failed');
            await markAuthenticatedTurnFailed(supabase, authenticatedTurn, 'CHAT_STREAM_FAILED');
            const errorInfo = classifyGeminiError(streamError);
            send({ error: errorInfo.userMessage, status: errorInfo.status });
          } finally {
            controller.close();
          }
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          ...corsHeaders,
        },
      });
    }

    const { text: reply, raw } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      fallbackModel,
      contents,
      systemPreamble,
      chatConfig
    );

    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('Empty model response');
    }

    const modelMessage = buildModelMessage(reply.trim(), extractModelParts(raw));
    await persistModelMessage(modelMessage);

    return new Response(JSON.stringify({ text: reply.trim(), message: modelMessage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    await markAuthenticatedTurnFailed(supabase, authenticatedTurn, 'CHAT_REQUEST_FAILED');
    console.error('[api] /chat request failed');
    const errorInfo = classifyGeminiError(e);
    return new Response(JSON.stringify({ error: errorInfo.userMessage }), {
      status: errorInfo.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
