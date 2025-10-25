// Deno Deploy / Supabase Edge Function (name: api)
// Routes:
// - POST /api/analyzeDream { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt }
// - POST /api/generateImage { prompt } -> { imageUrl }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const { pathname } = new URL(req.url);
  const segments = pathname.split('/').filter(Boolean); // [ 'api', ...]
  const subPath = '/' + segments.slice(1).join('/'); // '/analyzeDream'

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });

  const { data: authData } = await supabase.auth.getUser().catch(() => ({ data: null }));
  const user = authData?.user ?? null;

  if (req.method === 'POST' && subPath === '/transcribe') {
    try {
      const body = (await req.json()) as {
        contentBase64?: string;
        encoding?: string;
        languageCode?: string;
        sampleRateHertz?: number;
      };

      const contentBase64 = String(body?.contentBase64 ?? '');
      if (!contentBase64) throw new Error('Missing contentBase64');

      const encoding = String(body?.encoding ?? 'LINEAR16');
      const languageCode = String(body?.languageCode ?? 'fr-FR');
      const sampleRateHertz = body?.sampleRateHertz;

      console.log('[api] /transcribe request', {
        userId: user?.id ?? null,
        encoding,
        languageCode,
        sampleRateHertz,
        contentLength: contentBase64.length,
      });

      const apiKey = Deno.env.get('GOOGLE_CLOUD_STT_API_KEY') || Deno.env.get('GOOGLE_API_KEY');
      if (!apiKey) throw new Error('GOOGLE_CLOUD_STT_API_KEY not set');

      const config: Record<string, unknown> = {
        encoding,
        languageCode,
        enableAutomaticPunctuation: true,
      };
      if (typeof sampleRateHertz === 'number' && sampleRateHertz > 0) {
        config.sampleRateHertz = sampleRateHertz;
      }

      const sttRes = await fetch(
        `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ config, audio: { content: contentBase64 } }),
        }
      );
      if (!sttRes.ok) {
        const t = await sttRes.text();
        console.error('[api] /transcribe google error', sttRes.status, t);
        throw new Error(`Google STT error ${sttRes.status}: ${t}`);
      }
      const sttJson = (await sttRes.json()) as any;
      const transcript: string = sttJson?.results?.[0]?.alternatives?.[0]?.transcript ?? '';

      console.log('[api] /transcribe success', {
        userId: user?.id ?? null,
        transcriptLength: transcript.length,
        hasResults: Boolean(sttJson?.results?.length),
      });

      return new Response(JSON.stringify({ transcript }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e) {
      console.error('[api] /transcribe error', e);
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Public analyzeDream: allow without auth (skip DB insert when user is null)
  if (req.method === 'POST' && subPath === '/analyzeDream') {
    try {
      const body = (await req.json()) as { transcript?: string };
      const transcript = String(body?.transcript ?? '').trim();
      if (!transcript) throw new Error('Missing transcript');

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      console.log('[api] /analyzeDream request', {
        userId: user?.id ?? null,
        transcriptLength: transcript.length,
        snippet: transcript.slice(0, 80),
      });

      // Ask the model to return strict JSON to avoid schema features
      const prompt = `You analyze user dreams. Return ONLY strict JSON with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string}.\nDream transcript:\n${transcript}`;

      const apiBase = Deno.env.get('GEMINI_API_BASE') ?? 'https://generativelanguage.googleapis.com';
      const apiVersion = Deno.env.get('GEMINI_API_VERSION') ?? 'v1';
      const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-pro';
      const endpoint = `${apiBase}/${apiVersion}/models/${model}:generateContent?key=${apiKey}`;

      let gemRes = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            // responseMimeType/responseSchema are not supported on some endpoints; rely on prompt-enforced JSON
            temperature: 0.7,
          },
        }),
      });
      // Fallbacks if model or version not found
      if (!gemRes.ok && gemRes.status === 404) {
        const fallbackModel = 'gemini-2.5-flash';
        const fallbackEndpoint = `${apiBase}/${apiVersion}/models/${fallbackModel}:generateContent?key=${apiKey}`;
        console.warn('[api] /analyzeDream retry with', fallbackModel);
        gemRes = await fetch(fallbackEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
            },
          }),
        });
      }
      if (!gemRes.ok) {
        const t = await gemRes.text();
        console.error('[api] /analyzeDream gemini error', gemRes.status, t);
        throw new Error(`Gemini error ${gemRes.status}: ${t}`);
      }
      const gemJson = (await gemRes.json()) as any;
      const text: string = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      console.log('[api] /analyzeDream model raw length', text.length);

      let analysis: any;
      try {
        analysis = JSON.parse(text);
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) analysis = JSON.parse(match[0]);
      }
      if (!analysis) throw new Error('Failed to parse Gemini response');

      const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(analysis.theme)
        ? analysis.theme
        : 'surreal';

      // Optional DB insert if user is authenticated
      if (user) {
        console.log('[api] /analyzeDream insert for user', user.id);
        await supabase.from('dreams').insert({
          user_id: user.id,
          transcript,
          title: String(analysis.title ?? ''),
          interpretation: String(analysis.interpretation ?? ''),
          shareable_quote: String(analysis.shareableQuote ?? ''),
          theme,
          dream_type: String(analysis.dreamType ?? 'Dream'),
          image_url: null,
          chat_history: [],
        });
      }

      console.log('[api] /analyzeDream success', {
        userId: user?.id ?? null,
        theme,
        titleLength: String(analysis.title ?? '').length,
      });

      return new Response(
        JSON.stringify({
          title: String(analysis.title ?? ''),
          interpretation: String(analysis.interpretation ?? ''),
          shareableQuote: String(analysis.shareableQuote ?? ''),
          theme,
          dreamType: String(analysis.dreamType ?? 'Dream'),
          imagePrompt: String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere'),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (e) {
      console.error('[api] /analyzeDream error', e);
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {

    if (req.method === 'POST' && subPath === '/analyzeDream') {
      const body = (await req.json()) as { transcript?: string };
      const transcript = String(body?.transcript ?? '').trim();
      if (!transcript) throw new Error('Missing transcript');

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      // Ask Gemini to return strict JSON with our fields
      const prompt = `You analyze user dreams. Return ONLY strict JSON with keys: 
{"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string}.
Dream transcript: \n${transcript}`;

      const gemRes = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
        }
      );
      if (!gemRes.ok) {
        const t = await gemRes.text();
        throw new Error(`Gemini error ${gemRes.status}: ${t}`);
      }
      const gemJson = (await gemRes.json()) as any;
      const text: string = gemJson?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      let analysis: any;
      try {
        analysis = JSON.parse(text);
      } catch {
        // Fallback if model wrapped JSON in code fences
        const match = text.match(/\{[\s\S]*\}/);
        if (match) analysis = JSON.parse(match[0]);
      }
      if (!analysis) throw new Error('Failed to parse Gemini response');

      const theme = ['surreal', 'mystical', 'calm', 'noir'].includes(analysis.theme)
        ? analysis.theme
        : 'surreal';

      // Store in DB (best-effort)
      await supabase.from('dreams').insert({
        user_id: user.id,
        transcript,
        title: String(analysis.title ?? ''),
        interpretation: String(analysis.interpretation ?? ''),
        shareable_quote: String(analysis.shareableQuote ?? ''),
        theme,
        dream_type: String(analysis.dreamType ?? 'Dream'),
        image_url: null,
        chat_history: [],
      });

      return new Response(
        JSON.stringify({
          title: String(analysis.title ?? ''),
          interpretation: String(analysis.interpretation ?? ''),
          shareableQuote: String(analysis.shareableQuote ?? ''),
          theme,
          dreamType: String(analysis.dreamType ?? 'Dream'),
          imagePrompt: String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere'),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (req.method === 'POST' && subPath === '/generateImage') {
      const body = (await req.json()) as { prompt?: string };
      const prompt = String(body?.prompt ?? '').trim();
      if (!prompt) {
        return new Response(JSON.stringify({ error: 'Missing prompt' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      // Use Imagen 4, same as your React setup
      const apiBase = Deno.env.get('GEMINI_API_BASE') ?? 'https://generativelanguage.googleapis.com';
      const imageModel = Deno.env.get('IMAGEN_MODEL') ?? 'imagen-4.0-generate-001';
      const endpoint = `${apiBase}/v1beta/models/${imageModel}:predict`;

      const imgRes = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '9:16',
            // Some SDKs support outputMimeType; backend may infer PNG/JPEG. We'll accept imageBytes as base64.
          },
        }),
      });
      if (!imgRes.ok) {
        const t = await imgRes.text();
        throw new Error(`Imagen error ${imgRes.status}: ${t}`);
      }
      const imgJson = (await imgRes.json()) as any;

      // Try multiple shapes depending on response format
      let imageBase64: string | undefined;
      const firstPred = imgJson?.predictions?.[0];
      if (firstPred?.bytesBase64Encoded) imageBase64 = firstPred.bytesBase64Encoded;
      const gen0 = imgJson?.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBase64 && gen0) imageBase64 = gen0;

      if (!imageBase64) {
        // Return raw response for debugging if needed
        console.warn('[api] /generateImage unknown response shape');
        return new Response(JSON.stringify({ error: 'No image returned', raw: imgJson }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ imageBytes: imageBase64 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});
