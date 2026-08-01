# Android minSdk and speech capability

## Decision

`minSdkVersion` moves from **33 to 28**. Voice dictation stays available on every
supported Android version through an explicit capability ladder, and is blocked
only when the device genuinely cannot capture audio.

Set in [`app.json`](../../../app.json) under the `expo-build-properties` plugin.

## Why 33 was wrong

`minSdkVersion: 33` was introduced by commit `30308eb43` (2025-12-13), whose
message covers three backend security fixes — tier bypass, chat quota, and
subscription expiration — and never mentions Android, minSdk, or device
coverage. No architecture note accompanied it. The value excluded every device
below Android 13 with no recorded rationale.

Nothing in the codebase required it:

- `expo-speech-recognition@3.0.1` declares its own floor at
  `minSdkVersion safeExtGet("minSdkVersion", 21)`.
- Every `android.speech` call in that library is guarded at runtime, not at
  build time: `SDK_INT >= S` (31) for `isOnDeviceRecognitionAvailable`,
  `SDK_INT >= TIRAMISU` (33) for `createOnDeviceSpeechRecognizer`,
  `triggerModelDownload` and `checkRecognitionSupport`,
  `SDK_INT >= UPSIDE_DOWN_CAKE` (34) for the newer overloads.
- `getSupportedLocales` resolves to empty lists below API 33 instead of
  throwing.
- The app already carried its own runtime guard in `ensureOfflineSttModel`.

## The API levels that actually matter

| API | What it unlocks | Below it |
|---|---|---|
| 31 (`S`) | `isOnDeviceRecognitionAvailable`, `createOnDeviceSpeechRecognizer` | No on-device factory; the default recognizer still works |
| 33 (`TIRAMISU`) | `checkRecognitionSupport` — backs installed-locale introspection, `triggerModelDownload` | The installed-locale list is **empty, not authoritative** |

The second row is the subtle one. Below API 33 we cannot prove a language model
is present locally. Absence of evidence is not evidence of absence, so the
ladder treats it as *unknown* and picks a recognizer that can reach the network
— it never forces on-device recognition, which would throw
`UnsupportedOperationException`.

## The capability ladder

Implemented as a pure function in [`lib/speechCapability.ts`](../../../lib/speechCapability.ts),
resolved against the device in `resolveDeviceSpeechCapability()`
([`services/nativeSpeechRecognition.ts`](../../../services/nativeSpeechRecognition.ts)).

| Tier | Condition | Behaviour |
|---|---|---|
| `on_device` | API ≥ 33, on-device supported, requested locale installed | Dictation never leaves the device |
| `network` | Recognizer present, local model unproven | Default recognizer, may use the network |
| `server_only` | No `RecognitionService` on the device | Record audio, transcribe via `POST /transcribe` |
| `unavailable` | Device cannot capture audio | Voice control hidden, text capture only |

Only the last tier blocks the feature. An old Android version never does.

### Language substitution is offered, never applied

`localAlternatives` lists the app's own languages (`APP_TRANSCRIPTION_LOCALES`)
that the user already has installed locally, minus the requested one. It is
surfaced as a choice and never applied automatically: recognizing French audio
with an English model produces fluent, confident nonsense, which is worse for a
dream journal than an honest fallback.

`android.hardware.microphone` is already declared optional by
[`plugins/withOptionalAndroidHardwareFeatures.js`](../../../plugins/withOptionalAndroidHardwareFeatures.js),
so mic-less devices can install the app. The `unavailable` tier exists for them.

## What degrades below API 33

| Behaviour | Effect | Severity |
|---|---|---|
| `getSupportedLocales` returns empty | Falls to `network` tier | Works |
| `ensureOfflineSttModel` returns `false` | No offline model download | Feature absent, not broken |
| Missing-language-pack alert | `installedLocales` empty → generic message | Cosmetic |
| API 31–32 | On-device never selected even when available | Minor |

`ensureOfflineSttModel` is reached from the language-change flow, not a
dedicated toggle, so there is no dead control in Settings on older devices.

## Package visibility

The `<queries>` element for `android.speech.RecognitionService` is required for
`targetSdk` 30+ and is already present in the merged manifest, alongside a
`<package>` entry for `com.google.android.googlequicksearchbox`. This is a
`targetSdk` obligation and is unaffected by the `minSdk` change.

## Verification

```bash
npm run test:file -- lib/__tests__/speechCapability.test.ts services/__tests__/nativeSpeechRecognition.test.ts
```

The suites pin the ladder at API 28, 29, 30, 31, 32, 33 and 34, cover a native
module that is missing or throws, and assert that voice is blocked only on
microphone failure.

## Open items

- **Device coverage is not yet measured.** Play Console → *Statistics → Active
  devices by OS version* is the only source for what lowering the floor
  recovers. Record the figure here once read.
- **Physical testing on API 28–30 has not been done.** The code paths are
  covered by unit tests; ROMs without Google services and OEM recognizer
  variance are not.
- **The chat composer** (`components/chat/Composer.tsx`) has its own microphone
  and does not consult the capability ladder. On a mic-less device its control
  is still shown.
- **Privacy declaration.** The `network` and `server_only` tiers can send audio
  off-device — the default recognizer to the system service, `/transcribe` to
  Supabase. Confirm both are reflected in the Play Console Data safety form.
