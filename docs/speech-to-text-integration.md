# Speech-to-Text Integration Guide

## Overview
- **Primary path:** Native STT (iOS/Android/Browser) via [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition).
- **Backup:** Google Cloud Speech-to-Text through the Supabase Edge Function at `/transcribe`.
- The client never exposes Google credentials; the Edge Function owns `GOOGLE_CLOUD_STT_API_KEY`/`GOOGLE_API_KEY`.

## Runtime Flow
1. When the mic starts, `startNativeSpeechSession(locale)` begins a native recognition session (punctuation on, on-device when available).
2. On stop, we first use the native transcript if it exists.
3. If native STT is not available (no session), we send the recorded file to the `/transcribe` endpoint (Google STT) as a backup.

## Key Files
- `app/recording.tsx`  
  - Starts native STT alongside the recording session.  
  - Prefers native STT when available; falls back to Google only when native STT is unavailable.  
  - Relevant excerpt:
  ```ts
  nativeSessionRef.current = await startNativeSpeechSession(transcriptionLocale);
  // ...
  const nativeResult = await nativeSession?.stop();
  let transcriptText = nativeResult?.transcript?.trim() ?? '';
  if (!nativeSession && uri) {
    transcriptText = await transcribeAudio({ uri, languageCode: transcriptionLocale });
  }
  ```
- `services/nativeSpeechRecognition.ts`  
  - Thin helper over `ExpoSpeechRecognitionModule` to start/stop a session and stitch final chunks together.
- `services/speechToText.ts`  
  - Google backup path: reads the recorded file, base64-encodes it, and posts to `/transcribe`.
- `supabase/functions/api/index.ts`  
  - `/transcribe` proxy that calls `https://speech.googleapis.com/v1/speech:recognize` with `enableAutomaticPunctuation`.  
  - Expects `contentBase64`, `encoding`, `languageCode`, optional `sampleRateHertz`.

## Setup
1. Dependency: `expo-speech-recognition` (already added). Plugin is declared in `app.json` under `plugins`.
2. If you change native configuration, rebuild the dev client (`expo run:ios` / `expo run:android`) so the plugin permissions apply.
3. Backend secret: set `GOOGLE_CLOUD_STT_API_KEY` (or `GOOGLE_API_KEY`) in Supabase, then deploy/update the `api` Edge Function.
4. API base: `EXPO_PUBLIC_API_URL` or `app.json` `extra.apiUrl` must point to the Supabase Edge Function host.

## Platform Notes
- **iOS/Android:** Native STT is attempted first; on-device recognition is requested when supported. Google backup is used only when native STT cannot start.
- **Web:** Uses the browser SpeechRecognition API through `expo-speech-recognition`; if unavailable, the Google backup is used.
- **Error handling:** If both native and backup paths return no transcript, the UI shows the “No Speech Detected” alert.

## Cost Considerations (backup path)
- Google Cloud: 60 minutes free/month, then billed per 15 seconds.
- Keep recordings short; we set 16kHz mono for compatibility with STT services.
