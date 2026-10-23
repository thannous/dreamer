# Dreamer speech-to-text

The runtime contract is [useRecordingSession](../../hooks/useRecordingSession.ts),
with [nativeSpeechRecognition](../../services/nativeSpeechRecognition.ts) and
[speechToText](../../services/speechToText.ts). Reviewed against these sources on
2026-10-23; this is not a new device qualification.

## Platform behavior

| Platform | Start | Empty transcript |
| --- | --- | --- |
| iOS | Microphone permission, native recognition through `expo-speech-recognition` | No server transcription fallback: `canAskServer` explicitly excludes iOS. The user can retry or keep typing. |
| Android | Microphone permission, native recognition, recorded audio when needed | `/transcribe` is attempted when audio exists and the current scope's server budget is not paused. |
| Web | Secure context and browser speech recognition required before recording | Without the browser API, start fails with `stt_unavailable`. With it, recognition supplies text only: the hook skips the recorder and the installed web SDK supplies no recording URI, so there is no audio fallback to the server. |

A non-empty native transcript takes precedence. Native recognition requests
on-device processing where supported; that does not prove every platform or
locale works offline. Missing language packs, rate limits and empty recordings
remain distinct outcomes in the hook.

A server daily-limit refusal pauses further fallback calls for that account or
guest scope until its retry time. A scope change clears that pause. Temporary
native recordings are cleaned up in `finally` after processing; cleanup failure
is logged. Lucid's retained voice notes are a different feature and are not
covered by this Dreamer flow.

## Server fallback

[services/speechToText.ts](../../services/speechToText.ts) reads the recording,
checks `MAX_TRANSCRIPTION_BASE64_LENGTH` (4,000,000 characters) and posts through
[the API session helper](../../lib/apiSession.ts). Authenticated and verified
short-lived guest sessions are distinct; rejected guest admission fails closed
after the allowed refresh.

[The transcription route](../../supabase/functions/api/routes/transcribe.ts)
validates base64, encoding, locale and sample rate; its base64 limit is 8 MiB.
It calls Google Speech-to-Text with the server's `GOOGLE_CLOUD_STT_API_KEY` or
`GOOGLE_API_KEY`. Provider credentials and response bodies are not returned in
public error messages. These are payload limits, not an unlimited usage budget.

## Configuration and verification

The native plugin is declared in [app.json](../../app.json). A plugin or permission
change needs an isolated native rebuild under the
[native procedure](repository-operations.md#native-journeys-and-inspection).
A client-only change needs a compatible updated client; a server change needs its
own authorized deployment. Record both identities when testing their interaction.
Do not rebuild or deploy solely because this documentation changed.

The API base is resolved by [lib/config.ts](../../lib/config.ts). Secrets and
backend preparation follow [the backend guide](../../README_BACKEND.md).

For an affected journey, verify permission refusal with text still usable,
transcript preservation after stop, empty recognition and repeated/corrected
chunks. For Android fallback, also verify successful transcription and a server
refusal without repeated budget-consuming calls. For iOS, verify that an empty
native result does not upload audio to `/transcribe`. A mock browser pass cannot
qualify a real microphone, OS speech service or remote provider.

The session's `hasRecording` result and actual encoding options determine whether
an audio fallback exists. Recognition merges overlapping final and partial chunks;
check repeated complete sentences and last-word corrections without duplication.
Pass the selected locale through and preserve missing-language-pack and rate-limit
outcomes instead of treating an empty transcript as success.
