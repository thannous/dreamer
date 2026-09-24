# iOS first-use dictation permission regression

Initially diagnosed against `78f51b29652fbf86ac10e8f7f12982e4ae3df245` (3.4.4 release work).
The isolated fix was rebased onto master `c65fb15c` before PR validation; the
affected recording sources are identical in both bases.
Scope: dictation authorization only in `codex/ios-dictation-permission`;
store/version preparation from PR #210 is excluded.

## Failure model recorded before implementation

- Microphone access is not speech-recognition authorization on iOS when the
  recognizer can use Apple's network service. The caller's microphone-only flag
  currently skips both permissions.
- The native `start()` returns before its asynchronous authorization request.
  The screen then focuses the editor and enables its inactive/background cleanup.
  A subsequent iOS speech prompt can steal focus and stop the new session.
- Even an explicit permission result can arrive before iOS returns to active;
  starting then can lose the focus restoration or immediately stop recognition.
- Denying speech authorization must never start recognition or report readiness.
- Already-authorized Android and iOS on-device dictation must keep their existing
  permission behavior; permission success must still deliver partial/final text.

## Validation choice / E2E gap

The existing route tests verify deferred startup, editor focus, selection and
transcript insertion but mock the native session. Device E2E cannot deterministically
control Apple's speech-authorization callback relative to AppState, and the existing
TestFlight binary cannot execute this local change. Add service-level regressions
before implementation for that gap, then reuse the route and recording-hook suites.
These checks do not qualify real microphone transcription on the physical iPhone.

## Correction

The service resolves the recognition mode first. The existing microphone grant
still suffices for Android and on-device iOS recognition. Network-capable iOS
recognition explicitly awaits the combined native authorization, then shares the
existing foreground-settling helper with the microphone flow. Only then can the
session return to the screen and its existing editor-focus restoration run.
No native package, permission description, backend, or store configuration changes.

Native contract checked against the installed `expo-speech-recognition` 56.0.1
sources (`ExpoSpeechRecognitionModule.swift`, `ExpoSpeechRecognizer.swift`) and
[the library permission API](https://github.com/jamsch/expo-speech-recognition#requestpermissionsasync).

## Results

Environment: macOS / Node 24.19.0 / locked dependency tree of the 3.4.4 release.
Physical iPhone checked read-only: `com.tanuki75.noctalia`, 3.4.4 (10).

- Before implementation: 2 regression failures, 42 passes. Missing iOS speech
  authorization and failure to respect its denial reproduced at the service boundary.
- After implementation: 3 suites, **174 tests passed**. Includes first authorization,
  inactive -> active handoff, partial/final French transcript delivery, denied
  authorization, iOS on-device behavior, existing Android microphone behavior,
  deferred editor focus and preservation of the selected insertion range.
- App TypeScript: passed.
- Test TypeScript: passed.
- Focused ESLint: passed.
- `git diff --check`: passed.

Exact behavior rerun command (from this worktree, with Node 24.19.0 on PATH
and dependencies installed from the lockfile):

```sh
npm run test:file -- services/__tests__/nativeSpeechRecognition.test.ts hooks/__tests__/useRecordingSession.test.ts tests/app-routes/recordingScreen.test.tsx --watchman=false --json --outputFile=/private/tmp/noctalia-ios-dictation-after.json
```

Local machine-readable reports: `/private/tmp/noctalia-ios-dictation-before.json`
and `/private/tmp/noctalia-ios-dictation-after.json` (not committed).

The service tests simulate native events. The route tests simulate the editor;
neither is a real-device audio E2E. Physical validation remains pending on a build
containing this correction: accept first-use permissions, confirm editor focus,
speak a French sentence and observe its insertion without tapping the microphone
again. Also confirm denial leaves listening off and a real app background stops it.
No permissions or application data were reset on the connected iPhone.
