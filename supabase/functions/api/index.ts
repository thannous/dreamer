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

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user ?? null;

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }

  try {
    if (req.method === 'POST' && subPath === '/transcribe') {
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
        throw new Error(`Google STT error ${sttRes.status}: ${t}`);
      }
      const sttJson = (await sttRes.json()) as any;
      const transcript: string = sttJson?.results?.[0]?.alternatives?.[0]?.transcript ?? '';

      return new Response(JSON.stringify({ transcript }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

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
      // Placeholder image; swap with your generator (keep key as a secret)
      return new Response(
        JSON.stringify({ imageUrl: 'https://picsum.photos/800/1200?random' }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
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
