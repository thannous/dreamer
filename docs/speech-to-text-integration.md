# Speech-to-Text Integration Guide

## Current Implementation

The recording screen (`app/recording.tsx`) records audio using `expo-av` with formats optimized for Speech-to-Text:
- iOS: WAV Linear PCM (`LINEAR16`, 16kHz, mono)
- Android: 3GP AMR-WB (`AMR_WB`, 16kHz, mono)
- Web: WebM/Opus (`WEBM_OPUS`)

Transcription is implemented via a secure backend proxy (Supabase Edge Function) that calls Google Cloud Speech-to-Text. The mobile/web client never exposes a Google API key.

## Recommended Integration Options

### Option 1: OpenAI Whisper API
Still an excellent option for accuracy and multi-language support. Use a backend proxy to keep keys secure.

### Option 2: Google Cloud Speech-to-Text (Implemented)
We route recordings to a Supabase Edge Function at `/transcribe`, which forwards to Google STT and returns the recognized text.

Client (`services/speechToText.ts`):
```ts
import * as FileSystem from 'expo-file-system';
import { getApiBaseUrl } from '@/lib/config';
import { fetchJSON } from '@/lib/http';

export async function transcribeAudio({ uri, languageCode = 'fr-FR' }) {
  const contentBase64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const base = getApiBaseUrl();
  const res = await fetchJSON(`${base}/transcribe`, {
    method: 'POST',
    body: { contentBase64, encoding: 'LINEAR16', languageCode, sampleRateHertz: 16000 },
  });
  return res.transcript ?? '';
}
```

Supabase Edge Function (`supabase/functions/api/index.ts`):
```ts
if (req.method === 'POST' && subPath === '/transcribe') {
  const { contentBase64, encoding, languageCode, sampleRateHertz } = await req.json();
  const apiKey = Deno.env.get('GOOGLE_CLOUD_STT_API_KEY');
  const config: any = { encoding, languageCode, enableAutomaticPunctuation: true };
  if (sampleRateHertz) config.sampleRateHertz = sampleRateHertz;
  const sttRes = await fetch(`https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, audio: { content: contentBase64 } }),
  });
  const json = await sttRes.json();
  const transcript = json?.results?.[0]?.alternatives?.[0]?.transcript ?? '';
  return new Response(JSON.stringify({ transcript }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
```

## Integration Steps

1. Ensure API base URL is set (env `EXPO_PUBLIC_API_URL` or `app.json` `extra.apiUrl`).
2. Set Google key as a Supabase secret (never in the client):
   ```
   supabase secrets set GOOGLE_CLOUD_STT_API_KEY=your_google_api_key
   ```
3. Deploy/update the `api` Edge Function.
4. Use the recording screen: stop recording triggers `/transcribe` and fills the dream text.

## Cost Considerations

- Google Cloud: First 60 minutes free per month, then billed per 15 seconds
- OpenAI Whisper/Azure: similar cost profiles; choose based on language/accuracy needs

## Notes

- Audio format matters for STT compatibility:
  - iOS recorded as `LINEAR16` (WAV) 16kHz mono
  - Android recorded as `AMR_WB` (3GP) 16kHz mono
  - Web recorded as `WEBM_OPUS`
- Consider a loading indicator during transcription
- Handle network errors gracefully
- Cache/store recordings for retries
