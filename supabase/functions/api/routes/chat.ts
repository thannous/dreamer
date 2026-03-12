import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { buildDreamContextPrompt } from '../lib/prompts.ts';
import {
  callGeminiWithFallback,
  classifyGeminiError,
  GEMINI_FLASH_LITE_MODEL,
  GEMINI_FLASH_MODEL,
  type GeminiPart,
} from '../services/gemini.ts';
import { requireGuestSession } from '../lib/guards.ts';
import type { ApiContext } from '../types.ts';

type StoredChatMessage = {
  role: string;
  text?: string;
  parts?: GeminiPart[];
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

export async function handleChat(ctx: ApiContext): Promise<Response> {
  const { req, supabase, user, supabaseUrl, supabaseServiceRoleKey } = ctx;

  try {
    const body = (await req.json()) as {
      dreamId?: string;
      message?: string;
      lang?: string;
      fingerprint?: string;
      dreamContext?: {
        transcript: string;
        title: string;
        interpretation: string;
        shareableQuote: string;
        dreamType: string;
        theme?: string;
        chatHistory?: StoredChatMessage[];
      };
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

    if (body.dreamContext) {
      console.log('[api] /chat: guest mode with dreamContext', { dreamId });
      shouldPersist = false;
      dream = {
        id: dreamId,
        user_id: null,
        chat_history: body.dreamContext.chatHistory ?? [],
        transcript: body.dreamContext.transcript,
        title: body.dreamContext.title,
        interpretation: body.dreamContext.interpretation,
        shareable_quote: body.dreamContext.shareableQuote,
        dream_type: body.dreamContext.dreamType,
        theme: body.dreamContext.theme ?? null,
      };
    } else {
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

    if (!user && supabaseServiceRoleKey && fingerprint) {
      const userMessagesInContext = Array.isArray(dream.chat_history)
        ? (dream.chat_history as { role?: string }[]).filter((msg) => msg?.role === 'user').length
        : 0;

      if (userMessagesInContext === 1) {
        const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: quotaResult, error: quotaError } = await adminClient.rpc('increment_guest_quota', {
          p_fingerprint: fingerprint,
          p_quota_type: 'exploration',
          p_limit: GUEST_LIMITS.exploration,
        });

        if (quotaError) {
          console.error('[api] /chat: guest exploration quota check failed', quotaError);
        } else if (!quotaResult?.allowed) {
          console.log('[api] /chat: guest exploration quota exceeded', {
            fingerprint: '[redacted]',
            used: quotaResult?.new_count,
          });
          return new Response(
            JSON.stringify({
              error: 'Guest exploration limit reached',
              code: 'QUOTA_EXCEEDED',
              usage: {
                exploration: { used: quotaResult?.new_count ?? GUEST_LIMITS.exploration, limit: GUEST_LIMITS.exploration },
              },
            }),
            { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }
      }
    }

    const existingHistory = Array.isArray(dream.chat_history)
      ? (dream.chat_history as StoredChatMessage[])
      : [];
    const newUserMessage: StoredChatMessage = {
      role: 'user',
      text: userMessage,
      parts: [{ text: userMessage }],
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

    const modelParts = sanitizeParts(raw?.candidates?.[0]?.content?.parts);
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
