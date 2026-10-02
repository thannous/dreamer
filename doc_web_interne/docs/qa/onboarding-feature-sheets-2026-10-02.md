# Onboarding feature sheets — local qualification, 2026-10-02

Integration owner: current local Noctalia task. The approved pillars are
**Raconter · Comprendre · Explorer**. Scope: explanations opened from the welcome
screen, adapted from the existing landing; local build and iPhone testing.
After testing all three sheets on the iPhone, the user confirmed the interactions
worked and requested fewer explanations, with images and interaction doing most
of the work. This iteration starts with **Raconter**.
Unrelated work in this checkout is preserved. No public deployment or store release
is included.

## Result and reference

| Before | After |
| --- | --- |
| Three passive labels with overlapping “Repérer / Relier” descriptions | Three accessible buttons, each opening a sheet and returning to the same onboarding step |
| A globe followed by three explanatory blocks | Raconter: a larger globe; tapping artwork reveals an illustrated journal entry; a single return action restores the gallery |
| No demonstration of recurring symbols | Comprendre: three landing stories progressively add symbol nodes, counts and links; selecting a symbol lists its related stories |
| No distinct third pillar | Explorer: an illustrative guided dialogue and concrete reflection benefits |

The reference was inspected in source and on the live
[French landing](https://noctalia.app/fr/). Its globe uses CSS 3D cards;
its symbol section builds a constellation progressively and opens associated
stories on selection. The app reuses the artwork and relationships through native
components. Examples are explicitly illustrative. This change adds no network,
account, AI-generation or payment action.

Sources: [welcome screen](../../../app/onboarding.tsx),
[feature sheet](../../../components/onboarding/OnboardingFeatureSheet.tsx),
[globe](../../../components/onboarding/DreamGlobe.tsx), and
[constellation](../../../components/onboarding/SymbolConstellation.tsx).
Copy is translated in all six supported languages, reusing localized landing
stories. Raconter keeps a short voice/text label and optional illustration caption;
the three benefit paragraphs are removed. Motion is limited to interaction;
reduced motion replaces the globe with a static, touchable image gallery. Controls are at least
44 points high; the feature-sheet close control is now 48 × 48 points and stays
above its scrolling body.

## Candidate and evidence

- Source base: `5833c3ae4b59f6147f38fc9510276cd07a7ed6b5` plus the local patch.
  The checkout is dirty; private evidence records SHA-256 for every affected source
  and verifies those files stayed unchanged between validation and native installation.
- Web: Chromium, English locale, mocked services and fresh onboarding fixtures;
  viewports 390 × 844 and 320 × 568. The earlier iteration passed seven E2E journeys;
  the close-control correction below passed **eight** on the current local sources.
- Previous native candidate: **Noctalia 3.4.8 (14)**, existing Xcode workspace, embedded JS, local
  mock service mode, remote JS updates disabled. Installed through CoreDevice over
  the local network; installed metadata, running process and welcome screenshot
  were read back from the physical iPhone.
- The native welcome displays the three approved French labels. The user confirmed
  the three original sheets and offered interactions work; they requested the
  visual simplification after that test.
- Release candidate: **3.4.9 (15)** was built, signed and installed locally;
  installed metadata was read back from the iPhone. Its source fingerprint matches
  the seven tested web journeys. The first launch attempt was denied because the
  physical phone locked during compilation; unlocking and native Raconter testing
  were pending at that stage. This was a device-state blocker, not an observed app failure.
- The phone now runs **3.4.9 (16), Debug**, connected to Metro through private
  Tailscale HTTPS. The physical save/refresh/revert journey passed: a temporary
  `Raconter · DIRECT` label appeared without Reload or reinstallation, and the
  normal label returned after exact source restoration. The native process stayed
  unchanged. The private iPhone live-editing record includes the rerun
  commands and `.tmp/ios-fast-refresh/verification.json` records private evidence.
- Previous 3.4.8 (14) app-container comparison before first launch: 49 files before and after;
  43 identical, four system snapshots replaced and two cache shared-memory files
  changed. Persistent app-container files were preserved. No uninstall or reset.
- Current update 3.4.9 (15) used no uninstall or reset. A fresh full-container copy
  was rejected by automatic approval review because it could export private journal
  entries or sensitive credentials. That copy was not performed or retried; no
  before/after app-data comparison is claimed for this candidate.
- The private Tailscale HTTPS portal serves candidate 3.4.9 (15).
  Nine HTTP checks passed, including the signed IPA hash. That proves delivery
  availability, not Safari OTA installation of this candidate.
- App typecheck, focused lint and `git diff --check` passed. Android motion quality,
  VoiceOver, enlarged native text and real backend journeys remain unqualified.

## Repeatable web verification

From the repository root, using the existing dependencies:

```sh
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_PORT=8095 PLAYWRIGHT_HTML_OUTPUT_DIR=.tmp/onboarding-features/close-fix/report PLAYWRIGHT_JUNIT_OUTPUT_FILE=.tmp/onboarding-features/close-fix/junit.xml mise exec -- npm run test:e2e:web -- e2e/web/onboarding-features.spec.ts --workers=1 --output=.tmp/onboarding-features/close-fix/web
```

The [E2E specification](../../../e2e/web/onboarding-features.spec.ts) asserts:

1. In light and dark themes, all three previews open with a localized, accessible
   top-right cross, a 48 × 48 target and no Done button; closing restores trigger
   focus, and Start still continues onboarding. These are two journeys.
2. Escape closes each of the three sheets without skipping onboarding and restores focus.
3. A globe arrow actually changes a card's position while the sheet stays open.
4. Tapping an illustration opens the corresponding entry; returning restores the
   globe and focus on that illustration. The preview uses the available sheet width.
5. The reduced-motion gallery opens an entry and returns to the selected image.
6. All sheets remain closable after scrolling on the small viewport with reduced
   motion, with trigger focus restored; the static gallery replaces globe controls.
7. Symbol counts accumulate from 1/1 to 3/3, symbol selection filters related
   stories, and moving backward recalculates the count.

Private artifacts: `test-results/e2e-web/` (seven traces and screenshots),
`test-results/e2e-web-report/` (HTML report), and
`.tmp/onboarding-features/verification.json` (source fingerprint, environment and
results). The simplified gallery evidence is also preserved in
`.tmp/onboarding-features/capture-v2-web-evidence/`. The first native iteration is
recorded in `verification-v1-native14.json`. Native capture, installation metadata and preservation comparison live
alongside that private record. These files are ignored and are not committed.

## Close control and one surface — current local correction

The user requested removal of the bottom Done action, a top-right cross on all
three explanatory sheets, and a visually uniform background. Delivery is local
only: no commit, push, merge, EAS build, native rebuild, submission or publication.

`StandardBottomSheet` now accepts an optional localized `closeButton` and optional
footer actions. Its fixed header keeps the 48-point cross outside the body scroller.
Existing footer callers retain their actions. The onboarding parent still owns
focus restoration; web Escape and native gesture dismissal keep the existing path.

Both backgrounds already resolved to `colors.backgroundCard` / `p.raised`.
Explicitly passing the same color to both layers still left a visible native seam.
The targeted `transparentContent` option removes the content's opaque background;
`StandardBottomSheet` also omits its content shadow for that option. The platform
host alone paints `colors.backgroundCard`, including its handle and safe area.
The same option works with the web host. No palette, platform-host implementation,
globe, constellation, dialogue, onboarding setting or animation was changed.

Validation on base `5833c3ae4b59f6147f38fc9510276cd07a7ed6b5` plus local sources:

- Eight targeted Chromium E2E journeys passed in **26.5 seconds**. Traces, settled
  screenshots, HTML and JUnit reports are private under
  `.tmp/onboarding-features/close-fix/`. Light/dark screenshots and the small
  reduced-motion screen were inspected. Captures await the drawer's actual CSS
  animations instead of using a fixed delay; geometry is read in one frame.
- App typecheck, focused lint and `git diff --check` passed. No unit tests or full
  suite were added/run. Earlier failed measurements and the successful intermediate
  run are preserved under `attempt-1/` and `attempt-2/`; the final report is authoritative.
- Native installed metadata confirms **Noctalia 3.4.9 (16)**,
  `com.tanuki75.noctalia`. The existing Debug/Metro 8086 connection applied the
  changes by Fast Refresh. The native process identity stayed unchanged between
  opening the existing app and the final observation; no reload or installation
  was issued after source edits.
- Physical Raconter capture: the cross is visible, Done is absent, and the dark
  surface is uniform. Four blank-background samples around the handle, body and
  bottom safe area all read RGB **20, 19, 26** (`#14131A`). Before removing the second
  layer/shadow, those locations differed. Captures and sample coordinates are in
  `native-host-only.png` and `native-background-samples.json`.
- Agent-browser inspected the three web sheets without browser errors. This
  browser evidence is separate from the physical iPhone capture.

Exact source fingerprints, candidate identity, preconditions, rerun commands,
assertions and outcomes: `.tmp/onboarding-features/close-fix/verification.json`.
The independent web rerun command above starts its own server on a free 8095;
the recorded final run reused only this task's web server. Metro 8086 and the
private Tailscale services were preserved. No app-data container was copied.

Remaining native limits: light-theme sheets, Comprendre/Explorer, physical cross
taps, native gesture dismissal, VoiceOver focus, enlarged text and Android have
not been qualified in this correction. The iPhone capture proves Raconter's final
rendering in the observed dark palette, not those other journeys. Continue with
Debug 3.4.9 (16) and Fast Refresh for those checks; no IPA rebuild is needed.


## Motion stories — Raconter, Comprendre, Explorer

The user approved implementing the narrative in this order and requested care in
motion design. This iteration remains local in the shared checkout. Existing
Meditation/Android work and the previous cross/single-surface fix are preserved.
No commit, push, merge, store action, deployment or native build was performed.

The same blue-door dream connects the three explanations:

1. **Raconter:** a remembered fragment appears over dim artwork; the illustration
   moves behind a journal page; it becomes the foreground image, then joins the
   existing touchable globe. The illustrated entry and return-to-gallery flow remain.
2. **Comprendre:** three familiar dream accounts progressively introduce symbols.
   Links draw along their actual paths, new nodes appear, and the recurring house
   gains a visible count. The constellation remains selectable throughout.
3. **Explorer:** the door becomes the dialogue's visual anchor; a personal reply and
   follow-up arrive in sequence. In the free example, choosing a new beginning or
   the childhood home changes the reply and the next question. All of this is an
   explicitly illustrative, local exchange; it performs no AI/backend/payment request.

Each introduction has three 2.4-second scenes, plays once, then hands over to its
free example. Previous/next, pause/play, direct access to the example and replay
use 48-point controls. Touching or focusing the scene stops playback immediately.
Closing/unmounting clears the timer; leaving the foreground also pauses playback.
Reduced motion offers the same scenes manually, with opacity only. Native screen
reader detection disables autoplay; browser accessibility remains governed by the
reduced-motion preference and the available pause/manual controls. React Native Web
hardcodes its screen-reader query to true, so that native-only detector is not used
as a browser screen-reader signal.

Motion uses existing Reanimated/Worklets dependencies and theme/motion tokens:
200ms opacity/transform transitions and entrances, plus a 400ms SVG path reveal.
Scene changes occur once per 2.4 seconds; no frame-by-frame React state updates or
new native dependency is introduced. The sheet's native opening/gesture and uniform
host background retain their previous implementation. Story controls retain their
positions at the transition to the free example.

Current evidence, base `5833c3ae4b59f6147f38fc9510276cd07a7ed6b5` plus local sources:

- **13 focused Chromium journeys passed** in about one minute: the existing cross,
  Escape, focus, globe and constellation checks, plus playback of all three stories,
  pause/back/skip/replay, manual reduced-motion scenes at 320 × 568, interruption by
  symbol selection, and both personal dialogue choices. Light/dark and small-screen
  captures were inspected. Fixtures block external billing/backend requests.
- App typecheck, focused lint, six-language story-key parity and `git diff --check`
  passed. New coverage is E2E; no unit tests or unrelated suites were added/run.
- A separate, already-qualified playback journey was recorded with Playwright:
  **1 passed**, producing a web video. Agent-browser could not record because its
  recorder needs a host ffmpeg; Playwright's bundled recorder was used without
  installing another dependency. This video is browser evidence, not native proof.
- Source SHA-256 fingerprints were recorded before the final E2E run and verified
  unchanged afterward. The story copy adds 13 keys to each of the six existing
  language packs while preserving their prior local edits.
- Physical iPhone metadata reread: `com.tanuki75.noctalia`, **3.4.9 (16)**, existing
  locally signed Debug. A Raconter screenshot after Fast Refresh shows the new
  story progress/replay and caption with the globe. That capture uses an earlier
  replay-control arrangement; the exact final native revision and the complete
  three native motion journeys remain unqualified. No native video or physical
  close/gesture/VoiceOver/reduced-motion journey is claimed. Release smoothness,
  Android and enlarged native text remain unqualified.

Private evidence is consolidated in `.tmp/onboarding-features/motion-story/`:
`verification.json`, `tested-sources.json`, `junit.xml`, `report/index.html`,
`web/**/trace.zip` and screenshots, `video/**/video.webm`, and native metadata/captures.
The earlier pilot exposed the RN Web screen-reader constant; the corrected pilot
passed before the 13-journey run. Temporary E2E source restoration incidents were
resolved before validation, and the final tested-source fingerprints stayed stable.

Standalone rerun (8095 must be free):

```sh
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_PORT=8095 PLAYWRIGHT_HTML_OUTPUT_DIR=.tmp/onboarding-features/motion-story/report PLAYWRIGHT_JUNIT_OUTPUT_FILE=.tmp/onboarding-features/motion-story/junit.xml mise exec -- npm run test:e2e:web -- e2e/web/onboarding-features.spec.ts --workers=1 --output=.tmp/onboarding-features/motion-story/web
```

The recorded runs reused only this task's mock web server. Metro 8086 and the
private iPhone Tailscale relay are kept active for further Fast Refresh checks.


## Feature sheets disabled by default — 2026-10-03

The user considers the feature sheets unfinished and requested a feature flag to
stop opening them from the introduction. `EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED`
is now false when absent or when its value is anything other than `true`.

With the flag off, Raconter / Comprendre / Explorer retain their text, icons and
order as static views: no press handler, press animation, button role or opening
hint. The sheet mount also checks the flag, so an existing active-feature state
cannot keep a sheet visible after a refresh with the flag disabled. Privacy and
the main onboarding path keep their existing behavior. The motion stories remain
in the source for later iteration; this does not mark their design approved.

Set `EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true` before starting Metro or
creating a bundle to opt in. Expo embeds this public flag in the JavaScript bundle;
restart the server and reload the app when changing its environment. No local
profile was changed to enable the flag.

Both focused Chromium journeys passed (one default-off, one opt-in). Focused lint,
app typecheck and the scoped whitespace check passed. Focused evidence is under
`.tmp/onboarding-features/flag-off-2026-10-03/` and
identifies the base revision, dirty state and SHA-256 of the tested local sources.
The default-off browser journey clicks all three rows, verifies no sheet opens
and no button role remains, opens/closes privacy, and continues to the path screen.
An opt-in browser journey opens/closes all three sheets and verifies focus return
and continuation. Captures wait for the startup overlay to leave. Existing story
journeys require explicit opt-in and are skipped in the default configuration.

Rerun with port 8095 free, using a new server for each configuration:

```sh
env -u EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED E2E_WEB_PORT=8095 PLAYWRIGHT_HTML_OUTPUT_DIR=.tmp/onboarding-features/flag-off-2026-10-03/off-report PLAYWRIGHT_JUNIT_OUTPUT_FILE=.tmp/onboarding-features/flag-off-2026-10-03/off-junit.xml mise exec -- npm run test:e2e:web -- e2e/web/onboarding-features.spec.ts --grep 'feature sheets stay disabled by default' --workers=1 --output=.tmp/onboarding-features/flag-off-2026-10-03/off
EXPO_PUBLIC_ONBOARDING_FEATURE_SHEETS_ENABLED=true E2E_WEB_PORT=8095 PLAYWRIGHT_HTML_OUTPUT_DIR=.tmp/onboarding-features/flag-off-2026-10-03/on-report PLAYWRIGHT_JUNIT_OUTPUT_FILE=.tmp/onboarding-features/flag-off-2026-10-03/on-junit.xml mise exec -- npm run test:e2e:web -- e2e/web/onboarding-features.spec.ts --grep 'each promise closes.*light theme' --workers=1 --output=.tmp/onboarding-features/flag-off-2026-10-03/on
```

This is a local source change with browser evidence. Physical iPhone/Android
verification of this flag and any delivery of a new bundle remain unqualified.
No native build, publication or store submission is part of this change.


## Commit and push scope — 2026-10-03

The user requested commit and push after disabling the feature sheets. Delivery
uses `codex/onboarding-feature-flag`, based on current remote master `c877d6a1`.
It includes the feature sheets and their supporting translations, close/surface
options, flag gate and E2E coverage. Journal, Meditation, Android tooling, iOS
build scripts and other local edits are excluded. Existing remote translations
are retained; only the 82 onboarding keys per language are added.

The flag is absent from tracked production configuration and from the local mock
profile; only literal `true` enables it. A new production bundle will therefore
keep feature sheets disabled by default. A branch push alone does not update the
currently installed mobile binaries or production bundle. No merge, production
deployment, native build, OTA publication or store submission is authorized here.

Verification of the committed branch uses `npm run test:prepush`, focused lint
and the two flag configurations above. Delivery evidence is consolidated in the
worktree's ignored `.tmp/onboarding-feature-flag-delivery/` directory, including
candidate identity, exact commands, source hashes, results and browser traces.


The first pre-push check exposed an eager import of the optional previews in the
existing onboarding route test: its native gesture-handler module could not load
in that isolated Jest environment. Preview code now loads lazily only when the
flag is enabled and a sheet is opened. The disabled onboarding avoids initializing
these optional motion/gesture modules. No test mocks or CI filters were changed.
