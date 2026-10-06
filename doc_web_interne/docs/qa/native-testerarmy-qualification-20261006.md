# Native TesterArmy qualification — 2026-10-06

The selected Release journeys below passed on a dedicated Android emulator and
an iOS Simulator. This qualifies those journeys and their identified local
binaries. Physical-device qualification is pending: no physical Android was
connected and the user's iPhone was unavailable and left untouched.

## Source and build identity

Base app source: `5e877ffbcd39c0bc29223caca790f8dea8949987`. The later
`01c6e683d9b291a034dbb0397e53bd09d877c18d` changes only documentation and the
Dreamer browser suite, so it does not change these embedded native app inputs.
Local source changes qualified here are the iOS Reanimated flag and opt-in mock
theme persistence described below. The canonical Android runner also refreshed
the root `app.json` version-code mirror from 82 to the existing EAS counter 83.
No build was published. The version checker first rejected the copied iOS
Info.plist build-variable placeholders; the canonical sync normalized them to
the same already-resolved binary values, 3.4.5 (11), in the ignored native
project only.

| App | Android Release | iOS Simulator Release | Services |
| --- | --- | --- | --- |
| Dreamer / Noctalia | `com.tanuki75.noctalia`, 3.4.5 (83), arm64 | same bundle, 3.4.5 (11), arm64 | Android existing production-apk profile; iOS mock services with opt-in local persistence and feature sheets |
| Lucid | `com.tanuki75.noctalia.lucid`, 1.0.0 (1), arm64 | same bundle, 1.0.0 (1), arm64, ad hoc simulator signing | distinct existing `.env.lucid.mock` profile; native encrypted local trainer storage |
| Meditation | `com.noctalia.meditation`, 0.1.0 (3), arm64 | same bundle, 0.1.0 (1) | mock mode/audio disabled; real bundled audio and local state |

Android target: dedicated `Pixel_9_API_37` / `emulator-5588`. iOS target:
dedicated `Noctalia_Native_QA`, iPhone 18 Pro / iOS 27.0. One native worker per
device, existing ownership guards, identified installed Release and
`app.open()` at every test start. The locked Expo SDK is 57.0.23. Offline bundled compatibility checks passed for
root and Meditation; the online check recommended 57.0.26 and module patches
that were already absent from this base. No dependency upgrade was applied.

No model calls, hosted sessions, replay claims,
feedback exports or account submissions were used.

Dreamer Android's copied generated manifest enabled OTA updates. The initial
APK was retained, then only the ignored native `expo.modules.updates.ENABLED`
metadata was disabled and the APK rebuilt. These reports qualify embedded JS,
not an OTA channel. Dreamer iOS already had updates disabled. Its native,
`app.json` and read-only EAS iOS counter agreed on build 11; this is the reused
project's counter, not a Store candidate. Meditation's existing Android counter
3 and newly generated iOS counter 1 are local project identities, not release
publication claims.

Lucid's unsigned initial simulator build could not access SecureStore and its
onboarding writes failed with `ERR_KEY_CHAIN`. The same app was rebuilt with
`CODE_SIGNING_ALLOWED=YES`, `CODE_SIGN_IDENTITY=-`, the existing entitlements and
Release configuration. Xcode embedded the simulator entitlements including the
app-specific application identifier; no new certificate, Store provisioning
profile, device install or encryption fallback was introduced. Both journeys,
including activation after restart, passed on this candidate. The unsigned
failures and both candidate identities are retained.

## Passed journeys and reports

Reports, failed attempts, screenshots, videos, JUnit and command/source/device
receipts are retained under `tools/e2e/.e2e/<target>/<run>/`; a separate local
qualification manifest retains binary hashes, build logs, source patches and
archives. Counts are cumulative distinct journeys across the report selections,
not a claim that an earlier failed whole-suite run passed.

| Target | Passed selected journeys | Successful report directory IDs |
| --- | --- | --- |
| Dreamer Android | 6: empty save/draft/input modes; language/theme/draft persistence; language row; journal layout/backdrop/full settings; sign-in destination; Plus error recovery and close | `1791270430608-44909` (2 passed, earlier preference failure retained); `1791270986589-23229` (3 passed); `1791271802454-43532` (1 passed) |
| Dreamer iOS | 7: same 6, plus opt-in animated capture/connect/explore story | `1791271275046-63693` (5 passed, earlier story assertion failure retained); `1791271436871-99944` (story passed); `1791271870733-49666` (Plus passed) |
| Lucid Android | 2: intention/experience gate; native time fields, local plan, restart and main tabs | `1791271281909-64212` (2 passed on final bundle) |
| Lucid iOS | same 2, with encrypted native storage and restart | `1791271774222-37388` (2 passed on signed final candidate) |
| Meditation Android | 4: onboarding/restart/tabs; breathing pause/resume/close; language restart; bundled audio pause/+15s seek/resume after restart | `1791269366151-61002` (4 passed) |
| Meditation iOS | same 4 | `1791270324126-19010` (3 passed, earlier partially covered session-card tap failure retained); `1791271198228-55467` (audio passed) |

The Android production emulator has no Store account. Opening Plus exposes the
existing catalogue-error sheet; the test explicitly dismisses it, verifies the
paywall and closes back to Capture. This is navigation and error recovery, not
purchase, pricing or store-entitlement qualification. Selecting French exposes
the optional Android speech-pack prompt: cancelling it preserves the saved UI
language. No speech pack or model inference was requested.

## Reproduced corrections

- `IOS_SYNCHRONOUSLY_UPDATE_UI_PROPS=true` made the animated Dreamer drawer's
  language-row tap miss its control. Exact before report:
  `dreamer-ios/1791269859238-86244`; exact after flag=false report:
  `dreamer-ios/1791270580409-72652`. The other drawer radios, scrolling, backdrop,
  close button, full settings, sign-in and Plus destinations, capture controls
  and animated onboarding story were then checked on the final candidate.
  Lucid iOS was rebuilt with the same flag. Meditation has a separate package
  and already uses the default false value; Android's flag is unchanged.
- The opt-in persistent mock profile saved theme only in memory. Its exact
  restart failure is `dreamer-ios/1791270912496-1519`. The existing namespaced
  `getMockItem`/`setMockItem` helpers now persist only this additional mock
  preference; the final restart journey passed. This was a QA-profile defect,
  not a demonstrated defect in production storage.
- Native harness adaptations follow observed controls: iOS selected state is on
  the semantic parent radio; Android's time picker has two unnamed buttons and
  a visible Done label; UIKit retains outgoing Meditation onboarding scenes,
  so only iOS chooses the last visible CTA and verifies the next screen after
  every transition. The partially visible iOS session card is scrolled above
  floating tabs before tapping. The French paused-player label is `Lecture`.

The disabled iOS fast path returns transform updates to the ShadowTree commit
path. Reanimated documents its hit-detection tradeoff. No quantitative frame-rate
or physical-device performance claim is made here. See the official
[performance guide](https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/)
and [feature flags](https://docs.swmansion.com/react-native-reanimated/docs/guides/feature-flags/).

## Rerun

Install the matching identified local Release first using the existing device
protocol. The test runner does not build or install. From the repository root:

```sh
E2E_DEVICE=emulator-5588 mise exec -- npm run test:testerarmy:mobile -- dreamer android run --video
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_DEVICE=Noctalia_Native_QA mise exec -- npm run test:testerarmy:mobile -- dreamer ios run --video
E2E_DEVICE=emulator-5588 mise exec -- npm run test:testerarmy:mobile -- lucid android run --video
E2E_DEVICE=Noctalia_Native_QA mise exec -- npm run test:testerarmy:mobile -- lucid ios run --video
E2E_DEVICE=emulator-5588 mise exec -- npm run test:testerarmy:mobile -- meditation android run --video
E2E_DEVICE=Noctalia_Native_QA mise exec -- npm run test:testerarmy:mobile -- meditation ios run --video
```

Dreamer's Android feature story is disabled in the tested production profile
and is explicitly skipped unless an identified opt-in build is selected. This
skip is not a passed story journey. Existing Playwright, Maestro, API and
required CI coverage are retained. This selected native qualification does not
replace historical parity checks or qualify hosted authentication, store
transactions, push/background delivery, HealthKit, microphone or physical-device
motion/performance.
