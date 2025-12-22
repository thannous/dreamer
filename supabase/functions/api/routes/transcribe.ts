import { corsHeaders } from '../lib/constants.ts';
import type { ApiContext } from '../types.ts';

export async function handleTranscribe(ctx: ApiContext): Promise<Response> {
  const { req, user } = ctx;

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
