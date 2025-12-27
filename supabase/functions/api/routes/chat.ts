import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders, GUEST_LIMITS } from '../lib/constants.ts';
import { buildDreamContextPrompt } from '../lib/prompts.ts';
import { callGeminiWithFallback, classifyGeminiError } from '../services/gemini.ts';
import { requireGuestSession } from '../lib/guards.ts';
import type { ApiContext } from '../types.ts';

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
        chatHistory?: { role: string; text: string }[];
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
      chat_history: { role: string; text: string }[];
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
      ? (dream.chat_history as { role: string; text: string }[])
      : [];
    const newUserMessage = { role: 'user', text: userMessage };
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

    const contents: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];
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
      const t = String(turn.text ?? '');
      if (t) contents.push({ role: r, parts: [{ text: t }] });
    }

    const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3-flash-preview';
    const { text: reply } = await callGeminiWithFallback(
      apiKey,
      primaryModel,
      'gemini-2.5-flash-lite',
      contents,
      systemPreamble,
      { temperature: 0.7 }
    );

    if (typeof reply !== 'string' || !reply.trim()) {
      throw new Error('Empty model response');
    }

    const modelMessage = { role: 'model', text: reply.trim() };
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

    return new Response(JSON.stringify({ text: reply.trim() }), {
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
