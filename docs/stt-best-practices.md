# STT (Speech-to-Text) Best Practices

Guidelines we follow for speech recognition in the app.

## Capture & Permissions
- Always request mic permissions before starting.
- Configure audio mode for speech: allowsRecording: true, playsInSilentMode: true.
- Prefer 16 kHz mono, moderate bitrate (~64 kbps) for compatibility with cloud STT.
- Use continuous mode on web to avoid premature stop.

## Fallback Audio
- Keep the Expo recorder running unless the native session guarantees persisted audio (`hasRecording === true`).
- Use the recorded file as a fallback to backend STT (Google) when the native transcript is empty.
- If both native transcript and audio URI are missing, surface a “no speech detected” alert.

## Transcript Merging
- Native engines often resend the full transcript as “final” chunks. Merge by replacing when the new chunk is a superset of the last, ignore identical/shorter repeats.
- Allow small end-of-line corrections (e.g., last word changed) and replace the last line instead of stacking lines.
- Apply the same guard to partial previews to avoid flickering duplicates.

## Locale & On-device
- Pass exact BCP47 codes (e.g., `fr-FR`, `en-US`) to match installed locales.
- Use on-device recognition when supported; otherwise fall back to network.
- Log supported locales to help diagnostics.

## Errors & Timeouts
- Treat Android `error: client` at stop as benign noise.
- Use an end timeout (~4–5s) to decide when to fall back to backend STT.
- Alert on transcription failure instead of silently failing.

## Web Notes
- Require secure context (HTTPS or localhost) for mic access.
- If Web Speech API is missing/unreliable, always rely on recorded audio + backend STT.

## Testing
- Validate on real devices (iOS/Android) with phrases that change in the last word to ensure merge heuristics avoid duplication.
- Keep a regression case for “full sentence rewritten” to confirm we don’t stack duplicate lines.
