// Deno Deploy / Supabase Edge Function (name: api)
// Routes:
// - POST /api/analyzeDream { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt }
// - POST /api/generateImage { prompt } -> { imageUrl }
// - POST /api/analyzeDreamFull { transcript } -> { title, interpretation, shareableQuote, theme, dreamType, imagePrompt, imageBytes }

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GoogleGenerativeAI } from 'https://esm.sh/@google/generative-ai@0.21.0?target=deno';

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

      // Ask the model to return strict JSON (no schema fields here to keep compatibility)
      const prompt = `You analyze user dreams. Return ONLY strict JSON with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string}.\nDream transcript:\n${transcript}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-pro';

      let text = '';
      try {
        const model = genAI.getGenerativeModel({ model: primaryModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      } catch (err) {
        console.warn('[api] /analyzeDream primary model failed, retrying with flash', primaryModel, err);
        const fallbackModel = 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ model: fallbackModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      }

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

  // Combined: analyze dream and generate image in one call (public)
  if (req.method === 'POST' && subPath === '/analyzeDreamFull') {
    try {
      const body = (await req.json()) as { transcript?: string };
      const transcript = String(body?.transcript ?? '').trim();
      if (!transcript) throw new Error('Missing transcript');

      const apiKey = Deno.env.get('GEMINI_API_KEY');
      if (!apiKey) throw new Error('GEMINI_API_KEY not set');

      console.log('[api] /analyzeDreamFull request', {
        userId: user?.id ?? null,
        transcriptLength: transcript.length,
        snippet: transcript.slice(0, 80),
      });

      // 1) Analyze the dream
      const prompt = `You analyze user dreams. Return ONLY strict JSON with keys: {"title": string, "interpretation": string, "shareableQuote": string, "theme": "surreal"|"mystical"|"calm"|"noir", "dreamType": string, "imagePrompt": string}.\nDream transcript:\n${transcript}`;

      const genAI = new GoogleGenerativeAI(apiKey);
      const primaryModel = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-pro';

      let text = '';
      try {
        const model = genAI.getGenerativeModel({ model: primaryModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      } catch (err) {
        console.warn('[api] /analyzeDreamFull primary model failed, retrying with flash', primaryModel, err);
        const fallbackModel = 'gemini-2.5-flash';
        const model = genAI.getGenerativeModel({ model: fallbackModel });
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7 },
        });
        text = result.response.text();
      }

      console.log('[api] /analyzeDreamFull model raw length', text.length);

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

      // 2) Generate image from the prompt
      const imagePrompt = String(analysis.imagePrompt ?? 'dreamlike, surreal night atmosphere');

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
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
            aspectRatio: '9:16',
          },
        }),
      });
      if (!imgRes.ok) {
        const t = await imgRes.text();
        throw new Error(`Imagen error ${imgRes.status}: ${t}`);
      }
      const imgJson = (await imgRes.json()) as any;

      let imageBase64: string | undefined;
      const firstPred = imgJson?.predictions?.[0];
      if (firstPred?.bytesBase64Encoded) imageBase64 = firstPred.bytesBase64Encoded;
      const gen0 = imgJson?.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBase64 && gen0) imageBase64 = gen0;

      if (!imageBase64) {
        return new Response(JSON.stringify({ error: 'No image returned', raw: imgJson }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      // Optional DB insert if user is authenticated (store the dream with image if desired)
      if (user) {
        try {
          await supabase.from('dreams').insert({
            user_id: user.id,
            transcript,
            title: String(analysis.title ?? ''),
            interpretation: String(analysis.interpretation ?? ''),
            shareable_quote: String(analysis.shareableQuote ?? ''),
            theme,
            dream_type: String(analysis.dreamType ?? 'Dream'),
            image_url: null, // storing raw bytes is not ideal; leave null or upload to storage in future
            chat_history: [],
          });
        } catch (dbErr) {
          console.warn('[api] /analyzeDreamFull insert failed (non-fatal)', dbErr);
        }
      }

      return new Response(
        JSON.stringify({
          title: String(analysis.title ?? ''),
          interpretation: String(analysis.interpretation ?? ''),
          shareableQuote: String(analysis.shareableQuote ?? ''),
          theme,
          dreamType: String(analysis.dreamType ?? 'Dream'),
          imagePrompt,
          imageBytes: imageBase64,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    } catch (e) {
      console.error('[api] /analyzeDreamFull error', e);
      return new Response(JSON.stringify({ error: String((e as Error).message || e) }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Public generateImage (temporary public access)
  if (req.method === 'POST' && subPath === '/generateImage') {
    try {
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
          },
        }),
      });
      if (!imgRes.ok) {
        const t = await imgRes.text();
        throw new Error(`Imagen error ${imgRes.status}: ${t}`);
      }
      const imgJson = (await imgRes.json()) as any;

      let imageBase64: string | undefined;
      const firstPred = imgJson?.predictions?.[0];
      if (firstPred?.bytesBase64Encoded) imageBase64 = firstPred.bytesBase64Encoded;
      const gen0 = imgJson?.generatedImages?.[0]?.image?.imageBytes;
      if (!imageBase64 && gen0) imageBase64 = gen0;

      if (!imageBase64) {
        return new Response(JSON.stringify({ error: 'No image returned', raw: imgJson }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      return new Response(JSON.stringify({ imageBytes: imageBase64 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    } catch (e) {
      console.error('[api] /generateImage error', e);
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
