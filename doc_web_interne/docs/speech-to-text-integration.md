# Speech-to-Text Integration Guide

## Overview
- **Primary path:** Native STT (iOS/Android/Browser) via [`expo-speech-recognition`](https://github.com/jamsch/expo-speech-recognition).
- **Backup:** Google Cloud Speech-to-Text through the Supabase Edge Function at `/transcribe`.
- The client never exposes Google credentials; the Edge Function owns `GOOGLE_CLOUD_STT_API_KEY`/`GOOGLE_API_KEY`.

## Runtime Flow
1. When the mic starts, `startNativeSpeechSession(locale)` begins a native recognition session (punctuation on, on-device when available).
2. On stop, we first use the native transcript if it exists.
3. If the native transcript is empty and a recorded URI exists, we send that file to `/transcribe` as a backup. This also covers a native session that starts but ends with no transcript.
4. The recorded temporary file is deleted in a `finally` block after stop, whether transcription succeeds or fails.

## Key Files
- `hooks/useRecordingSession.ts`
  - Starts native STT alongside the recording session.
  - Prefers a non-empty native transcript, then tries the server fallback when audio is available.
  - Deletes the temporary recording after processing.
  - Relevant excerpt:
  ```ts
  nativeSessionRef.current = await startNativeSpeechSession(transcriptionLocale);
  // ...
  const nativeResult = await nativeSession?.stop();
  let transcriptText = nativeResult?.transcript?.trim() ?? "";
  if (!transcriptText && recordedUri) {
    transcriptText = await transcribeAudio({
      uri: recordedUri,
      languageCode: transcriptionLocale,
    });
  }
  ```
- `services/nativeSpeechRecognition.ts`
  - Thin helper over `ExpoSpeechRecognitionModule` to start/stop a session and stitch final chunks together.
- `services/speechToText.ts`
  - Google backup path: reads the recorded file, base64-encodes it, rejects payloads above 4,000,000 base64 characters, and posts to `/transcribe`.
- `lib/apiSession.ts`
  - Authenticates the request with the current Supabase access token or a verified, short-lived guest session. A rejected guest session is refreshed once, then fails closed.
- `supabase/functions/api/index.ts`
  - Registers the `POST /transcribe` route.
- `supabase/functions/api/routes/transcribe.ts`
  - Requires an authenticated user or a verified guest session before provider work.
  - Validates base64 content, encoding, language and sample rate; rejects payloads above 8 MiB of base64 text.
  - Calls `https://speech.googleapis.com/v1/speech:recognize` with automatic punctuation and returns generic provider errors without leaking credentials or response bodies.

## Setup
1. Dependency: `expo-speech-recognition` (already added). Plugin is declared in `app.json` under `plugins`.
2. If you change native configuration, rebuild the dev client (`expo run:ios` / `expo run:android`) so the plugin permissions apply.
3. Backend secret: set `GOOGLE_CLOUD_STT_API_KEY` (or `GOOGLE_API_KEY`) in Supabase, then deploy/update the `api` Edge Function.
4. API base: `EXPO_PUBLIC_API_URL` or `app.json` `extra.apiUrl` must point to the Supabase Edge Function host.
5. A local source change is not production evidence: deploy the Edge Function and rebuild/reinstall the APK before qualifying the fallback at runtime.

## Platform Notes
- **iOS/Android:** Native STT is attempted first; on-device recognition is requested when supported. Google backup is used whenever the resulting transcript is empty and recorded audio is available.
- **Web:** Uses the browser SpeechRecognition API through `expo-speech-recognition`. The current recording hook refuses to start when that API is unavailable, so the server fallback is primarily a native safety net.
- **Error handling:** If both native and backup paths return no transcript, the UI shows the “No Speech Detected” alert.

## Cost Considerations (backup path)
- Keep recordings short and monitor the current Google Cloud Speech-to-Text pricing and quotas for the configured project.
- The client and server payload limits prevent accidental multi-minute inline uploads; they do not replace provider-side quotas or billing alerts.
