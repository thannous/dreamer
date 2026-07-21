import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { buildDreamContextPrompt } from '../lib/prompts.ts';
import {
  callGeminiWithFallback,
  classifyGeminiError,
  extractModelParts,
  GEMINI_FLASH_LITE_MODEL,
  type GeminiPart,
} from '../services/gemini.ts';
import { requireGuestSession } from '../lib/guards.ts';
import type { ApiContext } from '../types.ts';

type StoredChatMessage = {
  role: string;
  text?: string;
  parts?: GeminiPart[];
  meta?: StoredChatMessageMeta;
};

type StoredChatMessageMeta = {
  category?: 'symbols' | 'emotions' | 'growth' | 'general';
  exploration360Synthesis?: boolean;
  isError?: boolean;
  retry?: {
    messageText: string;
    displayText?: string;
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
    if (typeof retry.messageText === 'string' && retry.messageText.trim()) {
      sanitized.retry = {
        messageText: retry.messageText,
        ...(typeof retry.displayText === 'string' && retry.displayText.trim()
          ? { displayText: retry.displayText }
          : {}),
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
      userId,
      message: error?.message ?? String(error),
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

export async function handleChat(ctx: ApiContext): Promise<Response> {
  const { req, supabase, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json()) as {
      dreamId?: string;
      message?: string;
      lang?: string;
      fingerprint?: string;
      messageMeta?: unknown;
      dreamContext?: unknown;
    };

    const dreamId = String(body?.dreamId ?? '').trim();
    const userMessage = String(body?.message ?? '').trim();
    const guestCheck = await requireGuestSession(req, body, user);
    if (guestCheck instanceof Response) {
      return guestCheck;
    }
    const fingerprint = guestCheck.fingerprint;

    if (!dreamId) {
      return new Response(JSON.stringify({ error: 'dreamId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    if (!userMessage) {
      return new Response(JSON.stringify({ error: 'message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const currentUserId = user?.id ?? null;
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

    if (clientDreamContext && !user) {
      console.log('[api] /chat: guest mode with dreamContext', { dreamId });
      shouldPersist = false;
      dream = normalizeGuestDreamContext(dreamId, clientDreamContext, userMessage);
    } else {
      if (clientDreamContext && user) {
        console.warn('[api] /chat: ignoring client dreamContext for authenticated request', {
          dreamId,
          userId: currentUserId,
        });
      }

      const { data: dbDream, error: dreamError } = await supabase
        .from('dreams')
        .select('id, chat_history, user_id, transcript, title, interpretation, shareable_quote, dream_type, theme')
        .eq('id', dreamId)
        .single();

      if (dreamError || !dbDream) {
        return new Response(JSON.stringify({ error: 'Dream not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      if (dbDream.user_id !== currentUserId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      dream = dbDream;
    }

    const existingHistory = Array.isArray(dream.chat_history)
      ? (dream.chat_history as StoredChatMessage[])
      : [];
    const messageMeta = sanitizeMessageMeta(body?.messageMeta);

    if (messageMeta?.exploration360Synthesis) {
      const effectiveTier = await getEffectiveSubscriptionTier(supabase, currentUserId);
      if (effectiveTier !== 'plus') {
        console.log('[api] /chat: blocked non-plus Exploration 360 synthesis', {
          dreamId,
          userId: currentUserId,
          effectiveTier,
        });
        return createSynthesisUpgradeRequiredResponse();
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

      const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
        p_fingerprint: fingerprint,
        p_quota_type: 'exploration',
        p_limit: GUEST_LIMITS.exploration,
      });

      if (quotaError) {
        console.error('[api] /chat: guest exploration quota claim failed before provider work', quotaError);
        return serviceUnavailable('Guest quota unavailable');
      }

      if (!quotaResult?.allowed) {
        const used = toCount((quotaResult as any)?.new_count);
        const isUpgraded = Boolean((quotaResult as any)?.is_upgraded);
        const payload = isUpgraded
          ? {
              error: 'Login required',
              code: 'GUEST_DEVICE_UPGRADED',
              isUpgraded: true,
              usage: { exploration: { used, limit: GUEST_LIMITS.exploration } },
            }
          : {
              error: 'Guest exploration limit reached',
              code: 'QUOTA_EXCEEDED',
              usage: { exploration: { used, limit: GUEST_LIMITS.exploration } },
            };

        console.log('[api] /chat: guest exploration quota blocked before provider work', {
          fingerprint: '[redacted]',
          used,
          isUpgraded,
        });
        return new Response(JSON.stringify(payload), {
          status: isUpgraded ? 403 : 429,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    const newUserMessage: StoredChatMessage = {
      role: 'user',
      text: userMessage,
      parts: [{ text: userMessage }],
      ...(messageMeta ? { meta: messageMeta } : {}),
    };
    const historyWithUserMsg = [...existingHistory, newUserMessage];

    let userMessagePersisted = false;
    if (shouldPersist) {
      try {
        const { error: updateError } = await supabase
          .from('dreams')
          .update({ chat_history: historyWithUserMsg })
          .eq('id', dreamId);

        if (updateError) throw updateError;
        userMessagePersisted = true;
      } catch (updateError) {
        const pgMessage = (updateError as any)?.message ?? '';

        if (typeof pgMessage === 'string' && pgMessage.includes('QUOTA_MESSAGE_LIMIT_REACHED')) {
          console.log('[api] /chat: quota exceeded for dream', dreamId, 'user', currentUserId);
          return new Response(
            JSON.stringify({
              error: 'QUOTA_MESSAGE_LIMIT_REACHED',
              userMessage: 'You have reached your message limit for this dream.',
            }),
            {
              status: 429,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        console.warn('[api] /chat: failed to append user message', {
          code: (updateError as any)?.code ?? null,
          message: pgMessage,
        });
        throw updateError;
      }
    }

    const lang = String(body?.lang ?? 'en')
      .toLowerCase()
      .split(/[-_]/)[0];

    const systemPreamble =
      lang === 'fr'
        ? 'Tu es un assistant empathique qui aide à interpréter les rêves. Sois clair, bienveillant et évite les affirmations médicales. Réponds en français.'
        : lang === 'es'
          ? 'Eres un asistente empático que ayuda a interpretar sueños. Sé claro y amable, evita afirmaciones médicas. Responde en español.'
          : 'You are an empathetic assistant helping interpret dreams. Be clear and kind, avoid medical claims. Reply in English.';

    const contents: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];
    const { prompt: dreamContextPrompt, debug: contextDebug } = buildDreamContextPrompt(dream, lang);
    contents.push({ role: 'user', parts: [{ text: dreamContextPrompt }] });

    console.log('[api] /chat: injected dream context', {
      dreamId,
      lang,
      transcriptLength: String(dream.transcript ?? '').length,
      interpretationLength: String(dream.interpretation ?? '').length,
      transcriptTruncated: contextDebug.transcriptTruncated,
      interpretationTruncated: contextDebug.interpretationTruncated,
      historyLength: historyWithUserMsg.length,
    });

    for (const turn of historyWithUserMsg) {
      const r = turn.role === 'model' ? 'model' : 'user';
      const parts = toContentParts(turn);
      if (parts.length > 0) contents.push({ role: r, parts });
    }

    const primaryModel =
      Deno.env.get('GEMINI_CHAT_MODEL')
      ?? Deno.env.get('GEMINI_LITE_MODEL')
      ?? GEMINI_FLASH_LITE_MODEL;
    const { text: reply, raw } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      Deno.env.get('GEMINI_LITE_MODEL') ?? GEMINI_FLASH_LITE_MODEL,
      contents,
      systemPreamble,
      { thinkingLevel: 'minimal' }
    );

    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('Empty model response');
    }

    const modelParts = sanitizeParts(extractModelParts(raw));
    const modelMessage: StoredChatMessage = {
      role: 'model',
      text: reply.trim(),
      ...(modelParts ? { parts: modelParts } : {}),
    };
    const finalHistory = [...historyWithUserMsg, modelMessage];

    if (shouldPersist) {
      const persistWithClient = async (client: typeof supabase) => {
        const { error: persistError } = await client
          .from('dreams')
          .update({ chat_history: finalHistory })
          .eq('id', dreamId);
        if (persistError) throw persistError;
      };

      try {
        if (userMessagePersisted) {
          await persistWithClient(supabase);
        } else if (supabaseServiceRoleKey) {
          const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          await persistWithClient(adminClient);
        }
      } catch (persistError) {
        console.warn('[api] /chat: failed to persist model message', {
          code: (persistError as any)?.code ?? null,
          message: (persistError as any)?.message ?? String(persistError ?? ''),
        });
      }
    }

    return new Response(JSON.stringify({ text: reply.trim(), message: modelMessage }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    console.error('[api] /chat error', e);
    const errorInfo = classifyGeminiError(e);
    return new Response(JSON.stringify({ error: errorInfo.userMessage }), {
      status: errorInfo.status,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
}
