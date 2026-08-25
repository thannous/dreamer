# Design QA

Source visual: `/Users/tanuki/.codex/generated_images/019e930f-9f65-7131-bc49-b5963e40f541/ig_0cd7b98a92836eb8016a218f907450819085595d87962de403.png`

Target: Noctalia Android journal screen on the connected ADB device.

Test Android Apps workflow:
- Device paired over wireless ADB as `motorola edge 60 fusion`, serial `ZY22LJM555`.
- Initial connect port `192.168.1.176:38445` later refused connections.
- After restarting ADB, mDNS exposed `192.168.1.176:43985`, which connected successfully.
- Initial device screenshot showed a React Native redbox from Google Sign-In:
  `[Auth] Google Sign-In failed Error: DEVELOPER_ERROR`.
- Fix applied: handled Google Sign-In provider/config failures with `log.warn` in `lib/auth.ts` and `components/auth/GoogleSignInButton.tsx`, so the user-facing alert can show without triggering a dev redbox. The button now uses the generic translated auth message for this technical setup error.
- App relaunched from the Expo dev launcher without the redbox returning.

Checks completed:
- `npm run typecheck:app` passed.
- `npm run lint` passed.
- `npm run typecheck:tests` passed.
- `npx jest lib/__tests__/auth.test.ts components/auth/__tests__/GoogleSignInButton.test.tsx lib/__tests__/logger.test.ts --runInBand --watchman=false` passed.

Android visual QA:
- Device: `192.168.1.176:43985`, `motorola_edge_60_fusion`, screen `1220x2712`.
- App loaded after auth fix: `/private/tmp/noctalia-loaded-after-auth-fix.png`.
- Journal Atlas empty state: `/private/tmp/noctalia-journal-atlas-final-device.png`.
- Journal search expanded: `/private/tmp/noctalia-journal-search-open.png`.
- Advanced filters sheet opened: `/private/tmp/noctalia-journal-filter-no-search.png`.
- Google Sign-In native account chooser opened without redbox: `/private/tmp/noctalia-google-error-after-fix.png`.

Web mock QA:
- Server: `http://localhost:8082`, launched with `.env.mock` on a separate port from Android Metro.
- Fallback reason: Browser plugin tools were not exposed in this turn, and Node REPL Playwright was blocked by macOS sandbox permissions. Used a temporary `/private/tmp` Node + Playwright script outside the repo.
- Mock profile: `btn.mockProfile.existing`, loading 8 predefined dreams.
- Populated Atlas journal: `/private/tmp/noctalia-web-mock-journal-populated.png`.
- Search expanded on populated journal: `/private/tmp/noctalia-web-mock-journal-search.png`.
- Advanced filters on populated journal: `/private/tmp/noctalia-web-mock-journal-filters.png`.
- Desktop web populated journal: `/private/tmp/noctalia-web-mock-mobile.png`.
- Console: no relevant `error` or `pageerror` events in the Playwright run.

Mobile web regression QA:
- Server: `http://localhost:8082`, `.env.mock`, Browser in-app runtime.
- Viewport: `390x844`.
- Mock profile: `btn.mockProfile.existing`, confirmed as `mock.existing@dreamer.app`.
- Populated Atlas list with visible transcripts: `/private/tmp/noctalia-journal-mobile-transcripts-fixed.png`.
- Search for `ocean`: `/private/tmp/noctalia-journal-mobile-search-ocean.png`.
- Search + analyzed filter active: `/private/tmp/noctalia-journal-mobile-search-analyzed.png`.
- Console: no relevant `error`; remaining warnings are Expo/react-native-web development warnings (`expo-notifications`, `pointerEvents`, `shadow*`).

Journal layout preference QA:
- Server: `http://localhost:8082`, `.env.mock`, Browser in-app runtime.
- Viewport: `390x844`.
- Default layout: cards, first dream cards measured around `358x361` and `358x316`, with transcript text visible: `/private/tmp/noctalia-journal-cards-default.png`.
- Settings option: `Affichage du journal` exposes `Cartes` and `Compact`; selecting `Compact` switches the mobile journal into the Atlas list.
- Compact layout: rows measured around `156px` tall and still show dream transcript excerpts: `/private/tmp/noctalia-journal-compact-option.png`.
- Return path: selecting `Cartes` restores the classic card layout while keeping the new mobile header: `/private/tmp/noctalia-journal-cards-restored.png`.
- Console: no `error` logs during this flow; remaining warnings are Expo/react-native-web development warnings (`expo-notifications`, `pointerEvents`, `shadow*`).

Journal header follow-up QA:
- Server: `http://192.168.1.52:8082`, `.env.mock`, Browser in-app runtime.
- Viewport: `406x837`.
- Passed: web mock debug rail `H J S G` is hidden from the journal screen.
- Passed: direct navigation to `/journal` stays on `/journal` instead of being replaced by `/recording`.
- Passed: mobile journal header uses the new Atlas header (`Noctalia` + `Journal`) while the selected list layout remains controlled by the cards/compact preference.
- Passed: old `Voyage onirique` title is no longer present on the mobile journal screen.
- Passed: empty journal state now shows only `Encore aucun rêve.`; the secondary `Commencez à les enregistrer !` line and internal add button were removed, leaving the floating add CTA as the single action.
- Passed: weekly/theme insight band was removed from the mobile journal header; `4 rêves cette semaine` and `Le thème Mystique revient souvent` are no longer visible.
- Passed: tapping the journal search icon opens the search bar and focuses `input.searchDreams`; `showSoftInputOnFocus` is enabled so mobile native opens the keyboard on focus.
- Passed: search input focus no longer uses the native orange web outline; the SearchBar container uses theme-aware focus colors (`accentLight` in dark mode, `accentDark` in light mode).
- Passed: shared mobile `NoctaliaScreenHeader` is now used on Journal, Accueil, Stats, and Paramètres; desktop keeps the previous page headers.
- Note: Browser screenshot capture timed out in CDP, so this follow-up used DOM visibility checks instead of an image artifact.

Home and Stats header actions QA:
- Server: `http://192.168.1.52:8082`, `.env.mock`, Browser in-app runtime.
- Viewport: `406x837`.
- Passed: direct navigation to `/statistics` now stays on `/statistics` instead of being replaced by `/recording`.
- Passed: Stats mobile header exposes `Choisir une période` and `Partager les statistiques`.
- Passed: Stats period action opens the period sheet with `Tout`, `7 jours`, `30 jours`, and `12 mois`; selecting `7 jours` closes the sheet and keeps the calendar action visible.
- Passed: Accueil mobile header exposes `Ouvrir le dictionnaire des symboles` and `Ouvrir le rituel du jour`.
- Note: Browser `Pressable` click actionability is inconsistent for some header buttons in this runtime, so verification used exact accessible-role clicks where needed. Console errors observed were RevenueCat Web Billing mock key errors, unrelated to the header changes.

Android follow-up attempt:
- Device reconnected over ADB as `192.168.1.176:43985`.
- Package resolved as `com.tanuki75.noctalia.debug/com.tanuki75.noctalia.MainActivity`.
- Attempted to open the dev-client URL from the mock server. The phone was locked/off-screen, and UI tree showed only `com.android.systemui`, so this run was not counted as visual validation for the transcript regression.

Result:
- Passed: Atlas mobile header matches the selected direction, with large Noctalia branding, compact icon controls, weekly insight band, quick filters, and a scannable empty state.
- Passed: Empty state has a single primary `Ajouter un rêve` CTA; the floating add CTA is hidden in this state.
- Passed: Search control opens the inline search field without overlap.
- Passed: Advanced filter control opens the `Filtres avancés` sheet.
- Passed: No React Native redbox after app relaunch with the auth logging fix.
- Passed: Google Sign-In button opens the native account chooser; canceling returns through warning logs, not `console.error`/redbox. The personal account was not selected during QA.
- Passed: Mock web populated state shows Atlas rows with real thumbnails, month separators, dream metadata, quick actions, and no floating CTA overlap.
- Passed: Mobile Atlas rows now show dream transcripts again, including `I found myself in an enormous library...` and `I was swimming in an ocean...`, with 3 visible excerpt lines on phone width.
- Passed: Mobile search and quick filters keep the transcript preview visible.
- Passed: Mobile journal defaults back to the classic card layout; compact Atlas mode is only enabled after selecting `Compact` in settings, and `Cartes` restores the default.
- Passed: Mobile journal now keeps the new Atlas-style header in both layouts and hides the web mock debug rail.

final result: passed

## Lucid onboarding — horizon à quatre destinations — 2026-08-22

Source and implementation evidence:
- Previous raster: `assets/images/lucid/onboarding/onboarding-step-2.jpg`.
- Replacement raster: `assets/images/lucid/onboarding/onboarding-step-2-waypoints.jpg`.
- Generation provenance: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/02-waypoints-prompt.md`.
- Emulator result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-final.png`.
- Polished emulator result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-polished.png`.
- Energy-bubble emulator result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-energy-bubble.png`.
- Integrated-horizon emulator result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-integrated-horizon.png`.
- Energy-slab emulator result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/02-emulator-393x850-energy-slab.png`.

Comparison and interaction evidence:
- The previous four arched alcoves read as caves and did not align with the native 2-by-2 goal grid.
- The replacement preserves the nocturnal portal, crescent, mountain horizon and branching luminous route, but ends each branch on an open neutral stone waypoint. No icon, text, check, halo or selected state is baked into the raster.
- The normal layout places the native icon layer on the four waypoint centers. The reflow keeps autonomous native surfaces so options remain readable when the artwork can no longer be used as the control geometry.
- All four choices were selected independently on the Android emulator. Each remained an `android.widget.RadioButton`, reported `checked="true"` and `selected="true"` when active, and retained its existing `lucid-goal-*` test ID.
- The selected halo/check and all localized labels remain React Native layers. Persisted goal IDs, single-selection logic, validation and CTA behavior are unchanged.
- Final polish replaces the heavy mixed Ionicons with four consistent thin Feather outlines, follows each stone top with a true SVG ellipse instead of a circular/capsule ring, reduces the check badge, and quiets the onboarding back-button chrome without shrinking its 44 dp target.
- Artistic pass turns the selected waypoint into a translucent energy sphere with a radial core, incomplete light arcs, particles and a grounded elliptical reflection. It breathes twice on selection using UI-thread transform/opacity only, and becomes static under reduced motion.
- Integration pass lowers the sphere into the stone support, replaces the dark active glyph with a smaller ivory outline, turns the external check badge into an internal glint, strengthens the contact filament/reflection, keeps the active label ivory and adds only a broad low-opacity glow over the selected branch. The compact reflow retains its explicit check because each option becomes an autonomous surface there.
- Final slab pass replaces the remaining circular glass treatment with an elliptical radial charge aligned to the stone perspective, makes inactive glyphs smaller but legible in ivory, strengthens the active glyph, restores a mint active label and reduces the title to the `h2` scale. A native branch overlay was tested on Android and removed because its diagonal did not follow the painted path accurately; the neutral raster remains the sole owner of route geometry.
- At the `393x850dp` target layout, the Android hierarchy exposes zero `scrollable="true"` nodes and the enabled `lucid-onboarding-continue` button remains pinned below the stage.
- Passed: focused onboarding Jest suite, 4 tests; app typecheck; tests typecheck; scoped Expo lint; `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: the Expo development `Tools` overlay remains visible in emulator evidence; it is development chrome, not application UI.

final result: passed

## Lucid onboarding — pratique en trois moments — 2026-08-22

Source and implementation evidence:
- Reference: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/01-practice-three-moments.png`
- Physical-device result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/01-motorola-final.png`
- Side-by-side comparison: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/01-reference-vs-motorola.png`
- Generated-background provenance: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/01-background-prompt.md`

State and device:
- Physical Motorola Edge 60 Fusion over Wi-Fi ADB, serial `192.168.1.176:38685`, viewport `1220x2712`, density `450`, font scale `1.0`, French locale.
- Step 1 / 5 in the local Expo development client `com.tanuki75.noctalia.lucid`; this is physical-device development proof, not Play-distributed-binary proof.
- The source is `853x1844`; the full-view comparison normalizes both views to `1356px` height while preserving each device aspect ratio.

Comparison and iteration history:
- The initial implementation used a much wider landscape with a tiny distant portal and a dim route. It also left the title lower than the source and rendered the shared `52dp` CTA without the source’s black leading disc.
- The final pass uses a new neutral `841x1870` raster grounded in the supplied source: the portal, luminous route, crescent, clouds and quiet lower text field now occupy matching visual landmarks. No UI or selection state is baked into the asset.
- Native React Native overlays retain the five-segment progress, three path pictograms, localized copy and CTA. The title has the source’s deliberate two-line break while retaining the original unbroken accessibility label.
- The final pictogram pass replaces the heavier generic symbols with thin source-matched treatments: library icons for the outlined sun and crescent with two small sparkles, plus a transparent generated twilight asset with a hollow half-sun, delicate rays and two horizon lines. The asset remains palette-tinted at runtime; path anchors and the decorative accessibility contract are unchanged.
- The immersive CTA is `60dp` high, full width, fully rounded, independently centers its label and carries the black leading icon disc. The existing `lucid-onboarding-continue` test ID and action remain unchanged.
- The final source-versus-device comparison shows matching portal/path scale, icon landmarks, title block and CTA baseline. Remaining visible differences are Motorola status/GameTime chrome and the source device frame, not application UI.

Primary interactions and runtime evidence:
- Passed: the CTA is a native accessible button at `[56,2341][1164,2510]`; the leading disc is decorative and hidden from assistive technology.
- Passed: the onboarding hierarchy contains zero `scrollable="true"` nodes at this viewport. A physical upward swipe produced a byte-identical accessibility tree before and after.
- Passed: the persisted onboarding data, translations, validation flow and existing Maestro test ID contract are unchanged.
- Passed: focused onboarding Jest suite, 4 tests; app typecheck; tests typecheck; scoped Expo lint; `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none in the tested step-1 scope.

final result: passed

## Lucid onboarding — niveaux d’expérience — 2026-08-21

Source and implementation evidence:
- Reference: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/03-experience-levels.png`
- Physical-device result: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/03-motorola-final.png`
- Side-by-side comparison: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/03-reference-vs-motorola.png`

State and device:
- Physical Motorola Edge 60 Fusion, `1220x2712`, density `450`, French locale.
- Selected state: `Débutant`; the two other options were also selected independently on-device.
- Local Expo development client `com.tanuki75.noctalia.lucid`; this is device QA, not Play-distributed-binary proof.
- Source pixels: `852x1848`; implementation pixels: `1220x2712`. For the full-view comparison, the source was contained at `610x1323` on a `610x1356` half-canvas and the implementation was downsampled to `610x1356`. The small residual aspect-ratio difference comes from the source device frame and Android system chrome, not the app layout; no CSS viewport applies to this native-device capture.

Comparison and interaction evidence:
- The first positioned pass still used flat Ionicons inside bordered circles. The user correctly rejected that effect as materially different from the source. The revised pass replaces only the visual inside each radio with a transparent volumetric moon asset and keeps the selection ring and glow as native state layers.
- The next pass followed the source-image coordinates but left the moons floating beside the stone platforms in the neutral implementation backdrop. Moving the entire horizontal rows onto the real platform centers then compressed the long `Occasionnel` label at the right edge.
- The final composition gives each native radio an ID-specific platform-center anchor and stacks its localized copy below the moon. Physical-device micro-adjustments raised `Régulier` by `3.5%` and `Occasionnel` by `3%` from the first vertical composition, while increasing the clear gap between their radio bounds from `10px` to `20px`: `Régulier` at `[462,895][912,1250]`, `Occasionnel` at `[440,1270][890,1626]`, and unchanged `Débutant` at `[396,1732][846,2088]`. Their moons align with the perspective centers of the stone circles and no label wraps or clips.
- The referenced Ox Alpha orb audit was reviewed against the final implementation. Its core recommendations are present: a transparent volumetric moon asset, native selection halo/ring, true accessible radios, stable IDs/test IDs, neutral backdrop and reflow. The optional check badge and three separate sphere variants were not added because the selected visual reference communicates selection with the halo alone and uses a coherent repeated moon treatment.
- The final readability pass keeps the immersive composition free of opaque cards: the two unselected hints now use the stronger secondary-text token and medium weight, all stage copy receives a restrained dark text shadow, and only the experience backdrop receives a slightly denser `0.34` night scrim. The platform anchors and radio bounds are unchanged.
- A physical upward swipe left all three bounds unchanged; the Android accessibility hierarchy exposed zero `scrollable="true"` nodes in the normal layout.
- All three controls remained `android.widget.RadioButton` nodes and reported their checked/selected state correctly after interaction.
- The persisted IDs, test IDs, copy, CTA behavior, and semantic accessibility order were not changed.
- Passed: 2 focused Jest suites, 18 tests; app and test typechecks; scoped Expo lint; `git diff --check`.
- Typography and copy preserve the existing Fraunces/Space Grotesk hierarchy and localized strings; colors continue to use the Lucid palette; the neutral raster backdrop remains sharp and selection-free; spacing now follows the three visible terraces and luminous route. The generated `512x512` RGBA moon is neutral and selection-free, while the native accent ring and strengthened hint copy remain clearly readable in the full-view comparison. A separate focused crop was not necessary.

Findings:
- P0: none.
- P1: none.
- P2: none in the tested step-3 scope.

final result: passed

## Lucid onboarding sleep window — 2026-08-21

Source visual truth path:
- `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/05-sleep-window.png`

Implementation and comparison evidence:
- Final Motorola capture: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/05-motorola-final.png`
- Native Android time picker: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/05-android-time-picker.png`
- Full source-versus-device comparison: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/05-reference-vs-motorola.png`
- Focused controls comparison: `doc_web_interne/docs/lucid-onboarding/mockups/2026-08-21/05-controls-comparison.png`

State and viewport:
- Physical Motorola Edge 60 Fusion over Wi-Fi ADB, serial `192.168.1.176:38685`, viewport `1220x2712`, density `450`, font scale `1.0`, French locale.
- Step 5 / 5 with persisted `22:30` bedtime, `07:00` wake time, beginner experience and three-day rhythm.
- The source is `852x1846`; full comparisons normalize both views to the same height and focused comparisons normalize both to `852px` width before cropping the same vertical region.

Comparison and iteration history:
- The initial pass placed the sleep controls and text block too high and kept the onboarding inside a vertical `ScrollView` at ordinary phone dimensions.
- The final pass places the arc, time values, title, journey summary and sleep-first reminder on the same relative vertical landmarks as the source.
- The ordinary layout now renders without a `ScrollView`; compact widths below `380dp` or text scale at or above `130%` retain the accessible reflow fallback.
- The source's visual time markers remain real native `Pressable` controls with stable test IDs, named accessibility values and the platform time dialog. No selection state is baked into the backdrop.

Primary interactions and runtime evidence:
- Passed: both time controls expose `lucid-sleep-bedtime` and `lucid-sleep-wake-time`; the Android system picker opens in 24-hour mode with localized `Annuler` and `Terminé` actions.
- Passed: a physical upward swipe from `[610,2100]` to `[610,900]` produced byte-identical accessibility trees before and after. The onboarding root reports `scrollable=false`, and control bounds remained unchanged.
- Passed: the final screenshot keeps the complete summary, sleep-first reminder and fixed full-width CTA visible without clipping.
- Passed: related Jest suite, 4 tests; app typecheck; tests typecheck; scoped Expo lint.
- Environment note: the first live reload used a stale Metro cache and returned a module-resolution 500 for an existing untracked WIP component. Restarting the same worktree's canonical Expo script with `--clear` rebuilt 3583 modules and restored the app; this was environment/cache failure, not a product regression.
- Evidence boundary: this is local Expo development-client proof on a physical Motorola, not Play-distributed binary proof.

Findings:
- P0: none.
- P1: none.
- P2: none after the vertical-position and non-scrolling fixes.

final result: passed

## Lucid Trainer interactive redesign — 2026-08-20

Source visual truth paths:
- Today / Dream Atlas: `/Users/tanuki/.codex/generated_images/01a01e4d-41d4-7a00-8508-2f2ae74f0978/exec-4717a20c-591e-430d-8b2a-70c99526267c.png`
- Reality-check guide: `/Users/tanuki/.codex/generated_images/01a01e4d-41d4-7a00-8508-2f2ae74f0978/exec-06caa82b-45d8-409d-9aa2-ee3b60c2bf68.png`
- MILD journey: `/Users/tanuki/.codex/generated_images/01a01e4d-41d4-7a00-8508-2f2ae74f0978/exec-f678bc53-6e89-4630-8e09-0f2f7a5ea489.png`

Implementation screenshot paths:
- Today: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/option1-final-pass.png`
- Reality check: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/option2-final-pass.png`
- MILD journey: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/option3-final-pass3.png`

State and viewport:
- Physical Motorola Edge 60 Fusion over Wi-Fi ADB, serial `192.168.1.176:38685`, viewport `1220x2712`, density `450`, French locale, dark theme.
- Today was captured with a real MILD program at day 1 / 7, so the CTA, duration and progress use persisted product data.
- Reality check was captured at Observer, step 1 / 3, with no answer selected and the real validation reason visible.
- Journey was captured before program start at an honest 0 / 7; no concept-only 3 / 7 progress was fabricated.

Full-view comparison evidence:
- Today: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/comparison-option1-final.png`
- Reality check: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/comparison-option2-final2.png`
- MILD journey: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/comparison-option3-final3.png`
- A separate focused crop was not needed: each target is a single mobile viewport and its full comparison already isolates the hero, primary action and progression surface at readable scale.

Comparison and iteration history:
- Today iteration 1 exposed a false active first milestone at 0 / 7 and a flatter CTA. The milestone now derives only from real active progress, the final capture uses real MILD day 1 data, and the CTA uses the concept's mint gradient.
- Reality-check iteration 1 exposed an opaque square around the generated orb. The final RGBA raster has real transparency, the orb is constrained to the measured slot, and its finite halo respects both system and app reduced-motion preferences.
- Journey iteration 1 read as a detached list, overflowed the first viewport and allowed the current node to bypass program start. The journey is now compact, the current node is disabled at 0 / 7, and only the primary CTA starts the program before navigation.
- Journey iteration 2 still placed several orbs beside the luminous route and truncated J6/J4. The final raster route and fixed per-day anchors align all seven orbs, while three-line labels preserve the complete session titles independently of orb position.

Required fidelity surfaces:
- Typography: existing Fraunces and Space Grotesk families preserve the concept's editorial-title and functional-copy hierarchy.
- Layout: hero image, dominant CTA, three-step guide and seven-stop journey reproduce the proposed visual hierarchy while retaining real routes and data.
- Color: nocturnal ink surfaces and jade accents come from the Lucid theme; the fixed journey image is intentionally dark in both themes for legibility.
- Assets: all three visible hero assets are real generated PNGs sized for their slots; the guide orb composites with alpha rather than a simulated code effect.
- Motion: entry and state motion are short and purposeful; no tabs slide, and reduced-motion is honored.

Primary interactions and runtime evidence:
- Passed: multi-agent visual review for each option reported no P0, P1 or P2 after the final device capture.
- Passed: manual device proof showed the current MILD node cannot open a session at 0 / 7, while `Commencer le programme` starts the real program and opens session 1.
- Passed: all four Maestro Lucid flows on the Motorola (`lucid-smoke`, `lucid-morning-review`, `lucid-night-safety`, `lucid-night-unlock`) completed on their first attempt.
- Passed: 3 focused Jest suites / 10 tests, app typecheck, tests typecheck, scoped Expo lint and `git diff --check`.
- P3 only: the Motorola GameTime tools overlay covers part of the close action in screenshots; it is device chrome, not an app element.
- P3 only: real data differs from concept copy and progress where appropriate, and the program detail stays an immersive stack route without a tab bar.

Findings:
- P0: none.
- P1: none.
- P2: none after the transparent-orb, journey-anchor and label-width fixes.

final result: passed

### MILD journey trainer follow-up — 2026-08-20

Source and comparison evidence:
- Visual source: `/Users/tanuki/.codex/generated_images/01a01e4d-41d4-7a00-8508-2f2ae74f0978/exec-f678bc53-6e89-4630-8e09-0f2f7a5ea489.png`
- Previous accepted implementation: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/option3-final-pass3.png`
- Final physical-device capture: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-redesign-pass4b-current.png`
- Source versus final comparison: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-redesign-source-vs-final.png`
- Previous implementation versus final comparison: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-redesign-before-vs-final.png`
- Started-but-zero-completed state: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-redesign-pass3-started-top.png`

State and viewport:
- Physical Motorola Edge 60 Fusion over Wi-Fi ADB, serial `192.168.1.176:38685`, viewport `1220x2712`, density `450`, French locale, dark theme.
- Final capture is a clean, not-yet-started MILD program after the regression suite cleared app state. It announces `0 / 7` and `Commencer le programme`; no concept-only `3 / 7` was seeded. The separate started-state capture proves that zero completed sessions remains `0 / 7` after activation.
- The GameTime overlay still covers part of the back action in screenshots. This is Motorola system chrome, not an app surface.

Comparison and iteration history:
- Pass 1 exposed overlapping labels and path markers. The atlas now uses seven absolute normalized anchors over the native `915 / 1719` image ratio, with independent two-line labels and no truncated session title.
- Pass 2 was visually strong but made the user cross the whole atlas to reach the current-session CTA. The final information order is progress, current session and its single CTA, sleep safety, then the optional seven-step atlas.
- The first editorial introduction was too long for repeat use. Before starting it now uses a compact body summary; after starting it replaces that summary with the real program status and computed session metadata.
- Device QA found a stale loading indicator after starting, opening session 1 and returning. The program screen now resets transient loading on blur/focus and before navigation; the returned CTA correctly announces `Reprendre l’entraînement`.
- Final code review found that paused programs could still open their current or missed session directly. Paused current/available nodes now remain disabled until the single Resume CTA reactivates the program; completed sessions remain readable.
- Progress segments now derive from each completed exercise ID instead of assuming contiguous completion. A stored 1+3 completion pattern therefore shows `2 / 7` with only segments 1 and 3 active.
- The atlas switches to its non-truncating list reflow below `380 dp` as well as at `130%` text scale, and its immutable background uses memory/disk caching.

Primary interactions and runtime evidence:
- Passed: before start, tapping session 1 remained on the `0 / 7` program screen; only `Commencer le programme` called `startProgram` and opened session 1.
- Passed: after start but before completion, the counter remained `0 / 7`, session 1 became directly openable, and the CTA returned from the session without a stale spinner.
- Passed: independent final visual review reported no P0, P1 or P2. The CTA, safety note and top of the atlas are all visible in the first Motorola viewport.
- Passed: independent final code review's paused-state, non-contiguous progress and narrow-width findings were fixed and independently covered.
- Passed: 3 focused Jest suites / 32 tests, app typecheck, tests typecheck, scoped Expo lint, `git diff --check` and trailing-whitespace checks.
- Passed: all four Lucid Maestro flows (`lucid-smoke`, `lucid-morning-review`, `lucid-night-safety`, `lucid-night-unlock`) passed on the Wi-Fi Motorola on their first attempt.
- Passed: the new dedicated `lucid-program-journey` Maestro flow also passed on its first fail-fast attempt. It proves the real `0 / 7` start gate, session navigation, return, pause lock and CTA-only resume path; the `lucid` suite now contains five flows.
- P3 only: large-text reflow is covered at `360 dp / 100%`, `390 dp / 130%` and `390 dp / 100%`, but the physical device was not switched to a larger system text scale for a screenshot.
- Evidence boundary: this is Expo development-client proof on the physical Motorola, not Play-distributed binary proof.

Findings:
- P0: none.
- P1: none.
- P2: none.

final result: passed

### MILD immersive-atlas restoration — 2026-08-20

Source and comparison evidence:
- User-selected left-hand reference: `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/codex-clipboard-505cc86b-4508-43d5-b218-2876a9cf3ed1.png`
- Final not-yet-started first viewport: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-immersive-final-top.png`
- Final started, zero-completed first viewport: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-immersive-final-active-top.png`
- Final atlas viewport: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-immersive-final-atlas.png`
- Source versus final combined comparison: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-immersive-source-vs-final.png`

State and viewport:
- Physical Motorola Edge 60 Fusion over Wi-Fi ADB, serial `192.168.1.176:38685`, viewport `1220x2712`, density `450`, French locale, dark theme.
- The implementation uses the real MILD state. Starting the program without finishing a session remains honestly at `0 / 7`; no reference-only `3 / 7` progress was seeded.
- The final active capture shows the retained current-session card and the real `Reprendre l’entraînement` CTA after opening session 1 and returning.

Comparison and implementation decisions:
- Restored the selected reference's single continuous night scene behind the complete MILD header, progress, current-session CTA, safety message and seven-step atlas.
- Removed the journey component's second copy of the scene in immersive mode, preventing a visible image restart while preserving the contained presentation for non-immersive consumers.
- Kept the redesigned action order: progress and the current-session CTA remain in the first viewport; the long atlas is optional exploration rather than a prerequisite for starting or resuming.
- Preserved the established journey semantics, fixed anchors, complete titles, reduced-motion handling, responsive large-text reflow, stable test IDs and route behavior.
- Scope is MILD only. SSILD and WBTB keep their existing program-detail presentation.

Primary interactions and runtime evidence:
- Passed on the physical device: `Commencer le programme` starts the real program and opens MILD session 1.
- Passed on the physical device: returning from session 1 restores the program screen with `Reprendre l’entraînement`, no stale loading state and an honest `0 / 7` counter.
- Passed: 3 focused Jest suites / 32 tests, app typecheck, tests typecheck, scoped Expo lint and `git diff --check`.
- Environment block: a fresh dedicated Maestro rerun stopped during the first `waitForAnimationToEnd` screenshot immediately after dev-client launch, before any product assertion ran. This runner/driver abort is not counted as an app pass or failure; the current interaction proof is the manual physical-device run above plus the focused tests. Log: `maestro-results/android/core/192.168.1.176:38685/lucid-program-journey/lucid-program-journey-5/logs/maestro.log`.
- P3 only: the Motorola GameTime overlay overlaps the back action in the screenshot; it is device chrome, not an app element.
- Evidence boundary: this is Expo development-client proof on the physical Motorola, not Play-distributed binary proof.

Findings:
- P0: none.
- P1: none.
- P2: none after restoring the continuous background while retaining the immediate CTA hierarchy.

final result: passed

## Noctalia Plus comparison paywall - 2026-07-15

Source visual truth path:
- `/Users/tanuki/.codex/generated_images/019f63ac-d34c-7382-bf60-ea9478189c81/exec-45de5824-57c0-4947-b491-1a1a3f667b94.png`
- Browser annotation on the annual offer: `mettre le pourcentage de reduction en badge sur la bordulre`.
- Pre-annotation implementation: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/09-questionne-tes-reves-390x844.png`.
- Pre-alignment RevenueCat Test Store state: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/13-test-store-price-before.jpg`.

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/10-annual-discount-border-badge-373x837.png`
- `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/14-test-store-price-aligned.jpg`
- `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/17-price-comparable-monthly.jpg`

State and viewport:
- Route: `http://localhost:8083/paywall?trigger=settings`, reached from the real Settings flow.
- Viewport: `373x837`, matching the browser annotation, French, dark theme, guest/free state, annual package selected.

Full-view and focused comparison evidence:
- Full comparison for the annotation: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/11-discount-badge-before-after.png`.
- Focused pricing comparison: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/12-discount-badge-before-after-detail.png`.
- Full price-source comparison: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/15-price-before-after-comparison.jpg`.
- Focused price-source comparison: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/16-price-before-after-detail.jpg`.
- Same-period price comparison: `/Users/tanuki/Documents/dreamer/screenshots/paywall-simplification/18-price-period-before-after.jpg`.
- The framed source concept and the unframed browser viewport differ only in presentation chrome; the screen content is compared at equivalent mobile scale.

Comparison history:
- Source goal: replace the verbose benefit stack with an immediately scannable Free/Plus comparison centered on unlimited dream analyses and the ability to keep asking questions about a dream.
- P2 source-to-code finding: the existing implementation did not expose a Free/Plus hierarchy and defaulted to whichever package sorted first.
- Fix: added a four-row comparison table, moved annual ahead of monthly, selected annual by default, and retained the existing dynamic RevenueCat price string.
- Follow-up: moved `Enregistrement des rêves` to the first row as a shared benefit with `∞ Illimités` aligned in both Free and Plus columns, making it explicit that upgrading never gates dream capture or the journal.
- Copy follow-up: replaced the internal label `Explorations 360°` with `Questionne tes rêves`, and changed the subtitle to `Pose tes questions. Obtiens des explications.` so the conversational value is understandable without knowing the product vocabulary and the French register stays consistent.
- Pricing annotation follow-up: replaced the generic `Meilleure offre` pill inside the annual card with a dynamically calculated savings badge positioned across its top border.
- P1 price-source finding: the RevenueCat Test Store products were still attached at `9.99 USD/month` and `79.99 USD/year`, while the live Google Play base plans were `3.59 EUR/month` and `22.99 EUR/year` in France (`3.49 USD` and `21.99 USD` in the US).
- Fix: created aligned Test Store monthly and yearly products with matching EUR/USD price points, replaced only the Test Store product attached to each existing package, and preserved the Google Play package associations.
- Post-fix evidence: the browser receives RevenueCat's localized `3,59 €` monthly and `22,99 €` annual prices and calculates the annual savings badge as `−47%`; the app still renders the store-provided `priceString` without hard-coded production prices.
- P2 price-comparison finding: presenting `22,99 € par an` beside `3,59 € par mois` forced the user to calculate the comparable monthly cost mentally.
- Fix: both cards now lead with a monthly amount. The annual card derives `1,92 € par mois` from the localized store price and keeps `Facturé 22,99 € par an` directly below for billing transparency; the monthly card says `Facturé chaque mois`.
- Post-fix evidence: all comparison content, both packages, the primary CTA, and the continue-free action fit without scrolling at `390x844`.

Required fidelity surfaces:
- Fonts and typography: the existing Noctalia sans-serif hierarchy is retained while matching the source's centered title, compact kicker, and stronger pricing hierarchy.
- Spacing and layout rhythm: the top bar, comparison table, two-column pricing grid, CTA, and secondary action fit within one mobile viewport.
- Colors and visual tokens: all surfaces, gold accents, borders, and selected states use existing Noctalia design tokens.
- Image quality and asset fidelity: no raster assets were added; all visible symbols use the project's existing icon component and library.
- Copy and content: the table prioritizes unlimited analyses, unlimited follow-up questions and explanations, and deeper syntheses while showing unlimited dream recording as a shared Free/Plus benefit.

Primary interactions and console:
- Passed: annual is selected by default.
- Passed: monthly selection updates both radio states, and annual can be restored.
- Passed: the annual savings badge remains visible when monthly is selected and follows the actual package prices.
- Passed: RevenueCat offering lookup returns both aligned Test Store packages in USD and EUR while retaining both Google Play products.
- Passed: the browser renders annual `1,92 € par mois`, `Facturé 22,99 € par an`, monthly `3,59 € par mois`, and `−47%` after reopening the paywall from Settings.
- Passed: the Settings entry opens the paywall through the real app navigation.
- Passed: no browser console errors; only existing Expo/web development warnings remain.
- Passed: focused paywall tests, app typecheck, scoped ESLint with zero errors, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the comparison and annual-default fixes.

final result: passed

## Settings guest local-hint removal - 2026-07-15

Source visual truth path:
- `/private/tmp/noctalia-settings-account-hint-before-387x837.png`

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-account-hint-removed-387x837.png`

State and viewport:
- Route: `http://localhost:8081/settings` reached through the app tab navigation.
- Viewport: `387x837`, dark theme, guest mock profile.

Full-view comparison evidence:
- Before and after captures use the same route, viewport, theme, and guest state.
- The guest-only sentence `Vos rêves restent sur cet appareil` is absent after the change.
- The `Invité` badge, moon icon, divider, and both account actions remain visible and unchanged.

Required fidelity surfaces:
- Fonts and typography: no typography tokens changed.
- Spacing and layout rhythm: removing the copy lets the existing centered summary header contract rebalance the badge without new spacing rules.
- Colors and visual tokens: no color or surface tokens changed.
- Image quality and asset fidelity: no images or icons changed.
- Copy and content: only the annotated guest hint was removed; signed-in account copy remains available.

Primary interactions:
- Passed: `Créer un compte` remains visible and actionable.
- Passed: `Se connecter` remains visible and actionable.
- Passed: focused component tests (8), app typecheck, tests typecheck, scoped ESLint with no errors, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after removing the redundant guest hint.

final result: passed

## Settings reminder-time dark contrast - 2026-07-15

Source visual truth path:
- `browser:/settings#comment-reminder-time-dark-input`

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-time-dark-readable-329x837.png`

State and viewport:
- Route: `http://localhost:8081/settings`.
- Viewport: `329x837`, dark theme, reminder-time bottom sheet open.

Full-view and focused comparison evidence:
- The annotated source and the implementation use the same compact viewport, dark theme, `07:00` value, and open reminder-time sheet.
- The source showed black time text and a black native clock glyph; the implementation shows both in the existing ivory foreground without changing the sheet layout.

Comparison history:
- P1 source finding: the HTML time input inherited the browser's light control scheme, producing `rgb(0, 0, 0)` text and a dark picker icon on a near-black surface.
- Fix: applied `noctalia.text.primary` to the input and forwarded the resolved app theme through CSS `color-scheme` so the browser renders its native time control consistently.

Required fidelity surfaces:
- Fonts and typography: the existing 28px Space Grotesk bold treatment is unchanged.
- Spacing and layout rhythm: the input frame, sheet dimensions, header, and action button are unchanged.
- Colors and visual tokens: the fix reuses `noctalia.text.primary`; no new color was introduced.
- Image quality and asset fidelity: the native browser clock glyph remains native and now follows the dark control scheme.
- Copy and content: all labels and the selected `07:00` value are unchanged.

Primary interactions and validation:
- Passed: the reminder-time row opens the sheet and the controlled time input remains editable.
- Passed: computed input color changed from `rgb(0, 0, 0)` / `color-scheme: normal` to `rgb(255, 249, 239)` / `color-scheme: dark`.
- Passed: 2 focused suites / 9 tests, scoped ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none after the contrast fix.
- P2: none.

final result: passed

## Journal detail metadata contrast and lifetime-access copy - 2026-07-15

Source visual truth path:
- `browser:/journal/1784079358889#comments-date-time-lifetime-copy`

Implementation screenshot paths:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-journal-detail-readable-meta-384x824.png`
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-journal-detail-lifetime-copy-384x824.png`

State and viewport:
- Route: `http://localhost:8081/journal/1784079853730`, recreated through the mock guest recording and analysis flow.
- Viewport: `384x824`, dark theme, analyzed guest dream.

Full-view and focused comparison evidence:
- The annotated source and revised implementation were checked at the same mobile viewport and analyzed-dream state.
- The first implementation capture verifies the complete metadata header in context; the second verifies the full backup message and surrounding actions.

Comparison history:
- P1 source finding: the date, time, and their icons used the dark on-accent foreground on a near-black raised surface, making both metadata values unreadable.
- Fix: moved the complete date/time pair to the existing primary ivory text token and raised the metadata labels from 13px medium to 14px bold.
- Copy requirement: replaced the cross-device continuation promise with lifetime access in the French backup prompt.

Required fidelity surfaces:
- Fonts and typography: existing Space Grotesk metadata and Fraunces content hierarchy are preserved.
- Spacing and layout rhythm: no card geometry, spacing, or content order changed; the complete date and time still fit on one line at 384px.
- Colors and visual tokens: the fix reuses `noctalia.text.primary`; no new color was introduced.
- Image quality and asset fidelity: the existing generated dream image and icon set are unchanged.
- Copy and content: the French message now ends with `y accéder à vie`.

Primary interactions and validation:
- Passed: the mock quota reset, recording, analysis, and journal-detail route completed end to end.
- Passed: computed date and time color is `rgb(255, 249, 239)` at `14px`; both values remain fully visible.
- Passed: the lifetime-access message is present in the rendered accessibility tree and visible in the focused screenshot.
- Passed: 16 focused tests, scoped ESLint with eight pre-existing route warnings, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none after the contrast fix.
- P2: none.

final result: passed

## Settings preference sheets, rituals and quotas - 2026-07-15

Source visual truth paths:
- `browser:/settings#comments-appearance-language-journal-rituals-quotas`
- `/private/tmp/noctalia-settings-panels-before-464x837.png`

Implementation screenshot paths:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-appearance-sheet-464x837.png`
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-interactions-restored-464x837.png`
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-quotas-restored-464x837.png`

State and viewport:
- Route: `http://localhost:8081/settings` in mock guest mode.
- Viewport: `464x837`, dark theme.
- Appearance, language, and journal sheets opened; ritual controls enabled; guest quotas visible.

Full-view and focused comparison evidence:
- The annotated source and revised implementation were checked at the same route, viewport, theme, and guest state.
- The full settings view verifies the preserved page hierarchy, working ritual controls, and restored quota card.
- The focused Appearance screenshot verifies the shared visual treatment used by all three preference sheets.

Comparison history:
- P1 source finding: Expo UI options rendered as oversized blue blocks with weak hierarchy and inconsistent product styling.
- Fix: replaced the option lists with a branded grouped selection surface using existing type, color, radius, icon, and divider tokens.
- P1 source finding: web ritual controls were disabled even though preference storage is available.
- Fix: enabled web editing and local persistence while keeping native push scheduling and permission requests native-only.
- P1 source finding: the quota status card was absent from the revised settings hierarchy.
- Fix: restored the existing embedded `QuotaStatusCard` below Noctalia Plus.

Required fidelity surfaces:
- Fonts and typography: existing Fraunces and Space Grotesk hierarchy reused.
- Spacing and layout rhythm: compact option rows fit each sheet without clipping; the original settings section order is preserved.
- Colors and visual tokens: existing Noctalia surfaces, borders, accents, and selected-state tokens reused.
- Image quality and asset fidelity: existing icon library and moon mark reused; no placeholder assets introduced.
- Copy and content: existing labels and descriptions preserved.

Primary interactions and console:
- Passed: Appearance, Language, and Journal sheets open and selections update the page.
- Passed: ritual toggle is interactive on web and the reminder-time sheet opens with an editable time input.
- Passed: guest quota values are visible below Noctalia Plus.
- Passed: no browser console errors.
- Passed: 4 focused suites / 26 tests, scoped ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none after the interaction and quota fixes.
- P2: none.

final result: passed

## Remembered-dream post-save priority - 2026-07-15

Source visual truth path:
- `/private/tmp/noctalia-recording-memory-offer-before.png`

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-recording-memory-offer-analysis-primary-1280x720.png`

State and viewport:
- Route: `http://localhost:8081/recording`, reached through the remembered-dream onboarding path in mock mode.
- Viewport: `1280x720`, dark theme, saved remembered-dream state.

Full-view and focused comparison evidence:
- The annotated source and implementation show the same remembered-dream post-save state.
- The full-view comparison clearly exposes the complete sheet hierarchy, so a separate crop was not needed.

Comparison history:
- Annotation requirement: remove the `Premiers repères` card and make analysis the clear next step.
- P1 source finding: `Voir mon souvenir` was visually primary while `L’analyser` was secondary, creating a redundant journal detour immediately after saving.
- Fix: removed the activation insight and journal-view action from this memory-specific sheet, promoted `L’analyser` to the existing primary action treatment, and retained `Plus tard` as the quiet exit.
- Post-fix evidence: the sheet contains only the concise saved-state copy, one primary `L’analyser` button, and `Plus tard`.

Required fidelity surfaces:
- Fonts and typography: existing Noctalia sheet title, body, button, and tertiary-action typography remain unchanged.
- Spacing and layout rhythm: the sheet compacts naturally around the two remaining actions without adding new spacing tokens.
- Colors and visual tokens: `L’analyser` reuses the existing primary action colors and border treatment.
- Image quality and asset fidelity: no images or icons changed.
- Copy and content: the subtitle now reflects the single immediate action and no longer promises a removed read action.

Primary interactions and console:
- Passed: the remembered-dream onboarding path saves successfully and opens the corrected offer.
- Passed: `L’analyser` is the only primary button; `Voir mon souvenir` and `Premiers repères` are absent; `Plus tard` remains available.
- Passed: no browser console errors; only existing React Native Web and notification support warnings were observed.
- Passed: 11 focused tests, app typecheck, scoped ESLint, and `git diff --check`.

Findings:
- P0: none.
- P1: none after the action-priority fix.
- P2: none.

final result: passed

## Settings mock fidelity - 2026-07-15

Source visual truth path:
- `/Users/tanuki/.codex/generated_images/019f6289-aec6-72e1-bd50-05ac1a0a9dbe/exec-33e7ba82-a43a-49b4-b270-ac9d0fc05b25.png`

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-mock-match-415x837.png`

State and viewport:
- Route: `http://localhost:8081/settings`.
- Viewport: `415x837`, dark theme, guest mock profile.
- The shared Settings header is intentionally excluded from the mock match, per the annotation requirement.

Full-view and focused comparison evidence:
- The generated mock and the implementation screenshot were opened together after the final sizing pass.
- The body uses the mock's `20px` side insets and `14px` inter-card rhythm.
- Measured implementation card heights match the normalized mock: account `161px`, experience `188px`, rituals `126px`, and Plus `66px`.

Required fidelity surfaces:
- Fonts and typography: Fraunces is used for card titles and Space Grotesk for rows, values, helper copy, and actions.
- Spacing and layout rhythm: card positions, internal dividers, row heights, action split, and navigation clearance mirror the reference.
- Colors and visual tokens: all dark surfaces, champagne borders, secondary text, and primary actions reuse Noctalia design tokens.
- Image quality and asset fidelity: existing mapped platform icons are used; no placeholder or handcrafted assets were introduced.
- Copy and content: the account summary, three experience rows, two ritual controls, and compact Noctalia Plus promo follow the reference structure.

Primary interactions and console:
- Passed: account actions still open the authentication sheet.
- Passed: experience rows still open their preference sheets and persist choices.
- Passed: native reminder toggle and time picker remain wired; the web preview preserves the mock state.
- Passed: the Plus card opens the Settings paywall route.
- Passed: no current browser console errors after the final reload; historical hot-reload diagnostics predate the completed implementation.
- Passed: 19 focused tests, app typecheck, scoped ESLint with two pre-existing hook warnings, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the full body reconstruction.

final result: passed

## Settings editorial direction - 2026-07-14

Source visual truth path:
- `/Users/tanuki/.codex/generated_images/019f6289-aec6-72e1-bd50-05ac1a0a9dbe/exec-33e7ba82-a43a-49b4-b270-ac9d0fc05b25.png`

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-editorial-390x844.png`

State and viewport:
- Route: `http://localhost:8081/settings` reached through the app tab navigation.
- Viewport: `390x844`, dark theme, guest mock profile.

Full-view and focused comparison evidence:
- The selected ImageGen direction and browser-rendered implementation were opened together at the mobile viewport for direct visual comparison.
- The account summary, experience controls, ritual boundary, and persistent tab bar are legible in the full view, so an additional focused crop was not required.

Comparison history:
- Initial implementation preserved the existing expanded authentication content above the fold. The chosen direction required a compact guest summary, so the full form and mock profiles were moved into the existing bottom-sheet pattern.
- P2 finding: subscription and quota content still appeared before the personal settings, making the first screen feel commercial and obscuring the selected hierarchy.
- Fix: reordered the sections to Account, My experience, Rituals, Subscription, and Privacy; removed preference descriptions from the compact rows.
- Post-fix evidence: the first viewport now shows the complete account summary, the selected editorial heading hierarchy, all primary experience choices, and the start of Rituals above the persistent navigation.

Required fidelity surfaces:
- Fonts and typography: existing Fraunces and Space Grotesk families are reused; the title is intentionally smaller than the mock at the user's request to expose more controls above the fold.
- Spacing and layout rhythm: existing FieldGroup measurements, native fill modifiers, 24px card radius, and tab-bar geometry remain intact. The account summary uses the established spacing scale and minimum touch targets.
- Colors and visual tokens: the implementation uses the existing Noctalia background, surface, border, champagne accent, cream text, and muted lavender tokens.
- Image quality and asset fidelity: no new raster assets were required; the crescent and interface symbols reuse the established native/web icon mapping.
- Copy and content: the selected French title, subtitle, guest state, local-storage reassurance, account actions, experience heading, and ritual heading are implemented and localized across all five supported languages.

Primary interactions and console:
- Passed: Create account and Sign in both open the detailed account sheet; the full mock profile, email, password, and close controls remain available.
- Passed: preference controls, account actions, persistent navigation, and the existing subscription/notification behaviors remain wired.
- Passed: no browser console errors during the settings and account-sheet flow.
- Passed: 21 focused tests, scoped ESLint with two pre-existing effect warnings, app typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the hierarchy and density fixes.
- P3: native FieldGroup controls remain more system-like than the illustrative mock; this preserves the existing cross-platform sizing and interaction contract.

final result: passed

## First-dream next-step sheet - 2026-07-14

Source visual truth path:
- `/Users/tanuki/.codex/generated_images/019f6090-abba-7503-b811-040714f13cc4/exec-77e4008d-a6df-45a5-8855-16c14e4eda86.png`
- Browser annotations on `/recording` requesting concise actions and the journal-return copy.

Implementation screenshot path:
- `/private/tmp/noctalia-first-dream-final-latest-390x844.png`
- Side-by-side source comparison: `/private/tmp/noctalia-first-dream-comparison.png`

State and viewport:
- Route: `http://localhost:8082/recording`.
- Viewport: `390x844`, dark theme, fresh free profile, first saved dream containing place and symbol keywords.

Full-view and focused comparison evidence:
- The generated direction and implementation were combined in one side-by-side image at the same `390x844` frame.
- The full viewport includes the recording context, complete sheet, both CTAs, saved-dream signal, dismissal link, and persistent navigation.

Comparison history:
- Initial direction: icon-led primary and secondary rows with explanatory subtitles.
- User refinement: removed both action subtitles and renamed the journal action to `Retourner à ton journal de rêves`.
- P2 follow-up finding: the programmatically focused web heading showed a visible focus rectangle despite a zero-width transparent outline.
- Final fix: applied the web-only `outline-style: none` reset while retaining programmatic heading focus and native accessibility focus behavior.

Required fidelity surfaces:
- Fonts and typography: existing Fraunces/Lora and Space Grotesk families, weights, and scale are reused.
- Spacing and layout rhythm: icon-led rows use a compact `72px` minimum height when no detail is present; the sheet remains fully visible at the annotated viewport.
- Colors and visual tokens: existing Noctalia action, surface, border, accent, and text tokens are reused.
- Image quality and asset fidelity: no new raster or vector assets were introduced; the existing icon system is reused.
- Copy and content: action copy matches the browser annotations; the `Lieu, Symbole` signal is generated deterministically from the saved transcript.

Primary interactions and console:
- Passed: analyze, journal, and dismiss callbacks are covered by the focused sheet test.
- Passed: the live mock save flow renders the expected dialog and concise accessible button names.
- Passed: no new browser console errors; only existing React Native Web and notification deprecation warnings were observed.
- Passed: focused tests, scoped lint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the copy-density and web-focus fixes.

final result: passed

## Full-bleed onboarding heroes - 2026-07-14

Source visual truth path:
- `/Users/tanuki/Documents/dreamer/screenshots/audit-c-intro-late.png`
- `/Users/tanuki/Documents/dreamer/assets/images/onboarding-astral-background.png`
- `/Users/tanuki/Documents/dreamer/assets/images/onboarding-path-background.png`
- Browser annotation requesting a premium full-width background treatment across onboarding paths.

Implementation screenshot path:
- Intro: `/private/tmp/noctalia-onboarding-intro-final-stable-425x837.png`
- Path selection: `/private/tmp/noctalia-onboarding-path-final-stable-425x837.png`
- Side-by-side source comparison: `/private/tmp/noctalia-onboarding-intro-final-comparison.png`

State and viewport:
- Route: `http://localhost:8082/onboarding`.
- Primary comparison viewport: `425x837`, dark theme, intro and path steps.
- Responsive inspection: `320x568`, `390x844`, and `425x837`.

Full-view and focused comparison evidence:
- The repository reference and final intro were combined into one side-by-side `425x837` comparison.
- Separate full-view evidence covers the shared path-selection hero and all three radio choices.

Comparison history:
- Source issue: the intro asset used `contain` inside the padded content column, leaving visible side gutters.
- First fix: made intro and path assets edge-to-edge and used `cover`; the natural intro ratio made lower guidance partially hidden behind the pinned CTA at `425x837`.
- P2 fix: constrained the intro hero to `280px`, preserving the full-width background treatment while keeping all three guidance rows, the privacy link, and the primary CTA visible.
- Post-fix evidence: both steps are full bleed; all analyze, remembered-dream, and symbol paths share the same path hero without navigation or state changes.

Required fidelity surfaces:
- Fonts and typography: existing Fraunces and Space Grotesk styles and localized copy are unchanged.
- Spacing and layout rhythm: full-bleed heroes use the existing `20px` content inset as a negative edge offset; text and cards remain on the established content grid.
- Colors and visual tokens: existing Noctalia background, accent, surface, and border tokens are unchanged.
- Image quality and asset fidelity: original high-resolution onboarding assets are rendered with centered `cover`; no stretching or generated replacement is used.
- Copy and content: onboarding copy, privacy language, path labels, and CTA labels are unchanged.

Primary interactions and console:
- Passed: intro-to-path transition, all three radio selections, per-path CTA labels, and dictionary navigation.
- Passed: hero width equals viewport width at `320px` and `425px`; no horizontal overflow was detected.
- Passed: no new browser console errors; only existing development deprecation warnings were observed.
- Passed: onboarding state/completion tests, focused UI/i18n tests, scoped lint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the `280px` intro-height adjustment.

final result: passed

## Recording editor action scale and height - 2026-07-13

Source visual truth paths:
- `browser:/recording#comment-smaller-footer-actions`
- `browser:/recording#comment-two-more-lines`

Implementation screenshot path:
- `/tmp/noctalia-recording-smaller-actions-taller-textarea-363x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `363x837`, remembered-dream voice mode, dark theme, long populated transcript.

Full-view and focused comparison evidence:
- The annotated source and implementation use the same route, viewport, mode, theme, and long transcript.
- The textarea, its line wrapping, the footer fade, and both utility controls are readable in the full-view comparison, so no additional crop was needed.

Comparison history:
- P2 source finding: the `+` and clear controls occupied too much of the editor footer. Fix: reduced the visible utility circles from `46px` to `40px`, reduced their icons proportionally, and kept a `4px` hit slop so the native touch target remains `48px`.
- P2 source finding: the populated textarea needed roughly two more visible lines. Fix: increased its minimum and maximum heights by `46px` with a `23px` line height, while preserving its width and horizontal insets.
- Consistency fix: the compact inline microphone now uses the same `40px` visible action size; the expressive microphone remains unchanged.
- Post-fix evidence: the implementation capture shows a taller transcript region, smaller balanced actions, and a clean fade before the opaque footer with no text behind the buttons.

Required fidelity surfaces:
- Fonts and typography: Lora family, weight, wrapping, and antialiasing are unchanged; the explicit `23px` line height makes the two-line height increase deterministic.
- Spacing and layout rhythm: the textarea gains exactly `46px`; the footer height drops from `68px` to `60px` and its controls from `46px` to `40px` without changing the outer width.
- Colors and visual tokens: editor, gradient, borders, icons, and button surfaces retain the existing Noctalia tokens.
- Image quality and asset fidelity: no raster or vector assets changed; existing mapped icons are preserved.
- Copy and content: the transcript, labels, and accessible action names remain unchanged.

Primary interactions and console:
- Passed: textarea, optional-details action, clear action, save action, and navigation remain present and semantically exposed.
- Passed: the long transcript remains visually separated from the action footer and the expressive microphone remains unchanged.
- Passed: no browser console errors.
- Passed: 6 focused tests, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the fixes above.

final result: passed

## Remembered-dream progressive actions - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-details-plus-dialog`
- `browser:/recording#comment-save-only-when-ready`

Implementation screenshot path:
- `/tmp/noctalia-recording-details-dialog-329x837.png`
- `/tmp/noctalia-recording-save-threshold-329x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `329x837`, remembered-dream voice mode, dark theme.
- States checked: empty editor, short draft, ready draft, and optional-details dialog.

Comparison history:
- P2 source finding: the optional details block stayed visible and competed with capture. Fix: replaced it with a `+` action inside the editor and moved the three groups into the existing standard bottom sheet.
- P2 source finding: editor actions appeared before the user started. Fix: the `+` action appears only after the transcript contains non-whitespace content.
- P2 source finding: the disabled save action occupied a large fixed area before it was useful. Fix: the footer is not mounted until the existing `ready` draft threshold is reached.

Required fidelity surfaces:
- Fonts and typography: existing Lora editor and Space Grotesk sheet/button hierarchy preserved.
- Spacing and layout rhythm: empty and short states reclaim the footer space; editor actions stay inside the lower-right corner without covering text.
- Colors and visual tokens: plus action, chips, sheet, and primary save reuse existing Noctalia tokens.
- Image quality and asset fidelity: no raster assets changed; the plus uses the existing native/web icon system.
- Copy and content: the dialog keeps the existing remembered-dream labels and selections.

Primary interactions:
- Passed: empty editor shows neither `+` nor save.
- Passed: a short draft shows `+` and clear, but no save action.
- Passed: the standard `ready` threshold reveals the save action.
- Passed: `+` opens the dialog with all three groups and `Terminé` closes it without clearing the transcript.
- Passed: the QA transcript was cleared and the initial voice state restored.

Findings:
- P0: none.
- P1: none.
- P2: none after the fixes above.

final result: passed

## Remembered-dream copy and optional details - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-1` — annotated remembered-dream instruction at `329x837`.
- `browser:/recording#comment-2` — annotated optional-details accordion at `329x837`.

Implementation screenshot path:
- `/tmp/noctalia-recording-remembered-collapsed-329x837.png`
- `/tmp/noctalia-recording-remembered-expanded-329x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `329x837`, remembered-dream voice mode, dark theme.
- States checked: optional details collapsed and expanded.

Comparison history:
- P2 source finding: the instruction wrapped across three lines with unnecessary qualifying copy. Fix: shortened the French instruction to `Raconte un rêve déjà vécu.` Post-fix evidence: collapsed and expanded captures show a single-line instruction.
- P2 source finding: the optional section used abstract copy and the missing web icon mapping displayed a help glyph instead of an accordion affordance. Fix: changed the title to `Préciser ce souvenir`, added a separate `Facultatif` badge, described the requested data, and mapped `chevron.down`/`chevron.up` to Material Icons. Post-fix evidence: both captures show the correct chevron; browser interaction opens and closes the three chip groups.

Required fidelity surfaces:
- Fonts and typography: existing Fraunces/Lora and Space Grotesk hierarchy preserved; shorter heading no longer wraps.
- Spacing and layout rhythm: existing card dimensions and vertical spacing preserved; badge wraps safely with the title.
- Colors and visual tokens: existing Noctalia surface, border, text, and muted badge tokens reused.
- Image quality and asset fidelity: no raster assets changed; the accordion uses the existing icon system with a valid native/web mapping.
- Copy and content: the purpose and optional nature of the section are explicit before expansion.

Primary interactions and console:
- Passed: accordion opens, exposes all three chip groups, changes to an up chevron, and closes again.
- Passed: no browser console errors.
- Passed: 7 focused tests, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the fixes above.

final result: passed

## Recording composer annotation pass - 2026-07-13

Source visual truth:
- User browser annotations on `/recording` at `329x837` for the no-speech fallback, retry label, and disabled save button transparency.
- User reference screenshot for the text composer with an inline microphone.

Implementation QA:
- Browser: Codex in-app browser on `http://localhost:8081/recording`.
- Viewport: `329x837`, remembered-dream voice mode after a no-speech fallback.
- Passed: the no-speech message is no longer an inline card and does not reserve vertical space; it is rendered as the existing auto-dismiss toast.
- Passed: the visible `Réessayer la voix` copy is removed after a voice fallback; the expressive microphone remains the single retry action with the same accessible label.
- Passed: the transcript editor remains visible and editable below the expressive microphone.
- Passed: the disabled save control uses the solid `#0D0B1C` theme surface at opacity `1`; underlying content no longer shows through it.
- Passed: the live screenshot shows no collision between the expressive microphone and transcript editor.
- Passed: focused Jest coverage, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none in the annotated scope.

final result: passed

## Recording controls density pass - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-mode-selector`
- `browser:/recording#comment-inline-clear`
- `browser:/recording#comment-remove-voice-label`

Implementation screenshot path:
- `/tmp/noctalia-recording-voice-clean-329x837.png`
- `/tmp/noctalia-recording-mode-menu-329x837.png`
- `/tmp/noctalia-recording-inline-actions-329x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `329x837`, remembered-dream capture, dark theme.
- States checked: voice mode, mode menu open, text mode with transcript and inline actions.

Comparison history:
- P2 source finding: the mode control repeated the current mode in a large pill. Fix: reduced the closed control to a `44x44` menu button and kept mode names, hints, and selected state inside the dropdown.
- P2 source finding: the visible `Dicter le rêve` action duplicated the expressive microphone. Fix: removed the visible copy while preserving the microphone accessibility label and recording duration state.
- P2 source finding: the clear action lived below the editor. Fix: moved the clear icon inside the editor; it sits beside the inline microphone in text mode and remains the only inline action in voice mode.

Required fidelity surfaces:
- Fonts and typography: existing display and utility typography preserved; duplicate voice copy removed.
- Spacing and layout rhythm: closed mode control is compact; editor reserves bottom padding for inline actions without covering text.
- Colors and visual tokens: menu, microphone, and clear action reuse existing Noctalia tokens.
- Image quality and asset fidelity: no raster assets changed; the menu uses the mapped native/web menu icon.
- Copy and content: capture modes and current selection remain explicit inside the dropdown.

Primary interactions and console:
- Passed: menu opens, shows `Écrit` and `Vocal`, marks `Vocal` as the current view, and changes modes.
- Passed: test transcript shows microphone and clear action side by side inside the editor; clear removes the test value.
- Passed: test state was cleaned and voice mode restored after verification.
- Passed: no browser console errors.
- Passed: 9 focused tests, ESLint with no new warnings, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the fixes above.

final result: passed

## Remembered-details visual hierarchy - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-secondary-details`

Implementation screenshot path:
- `/tmp/noctalia-recording-secondary-details-329x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `329x837`, remembered-dream voice mode, dark theme, accordion collapsed.

Comparison history:
- P2 source finding: the optional details card visually competed with the transcript editor and primary capture controls. Fix: moved the card to the soft secondary surface, reduced padding and height, changed the title from bold primary text to medium secondary text, and muted the badge, description, and chevron.
- Post-fix evidence: the capture shows the block reading as optional supporting content while remaining legible and interactive.

Required fidelity surfaces:
- Fonts and typography: utility title reduced to `14/19` medium; descriptive text remains readable at `12/17`.
- Spacing and layout rhythm: card padding reduced to `12x10` and toggle minimum height to `48`.
- Colors and visual tokens: only existing secondary/tertiary Noctalia tokens are used.
- Image quality and asset fidelity: no assets changed; existing chevron mapping retained.
- Copy and content: all optional-detail guidance remains unchanged.

Primary interactions and console:
- Passed: accordion opens and closes with the full chip content intact.
- Passed: no browser console errors.
- Passed: focused Jest, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the fix.

final result: passed

## Recording editor left inset - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-text-left-space`

Implementation screenshot path:
- `/tmp/noctalia-recording-text-left-padding-329x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `329x837`, remembered-dream voice mode, dark theme, populated transcript.

Full-view and focused comparison evidence:
- The annotated source and implementation use the same route, viewport, mode, theme, and transcript.
- The editor is the only affected region, so the readable full-view capture is also the focused comparison; no additional crop was needed.

Comparison history:
- P2 source finding: the populated editor retained the empty-state pencil inset, leaving excessive unused space before the text.
- Fix: keep the `48px` left inset only for the empty placeholder state and reduce populated-editor left padding to `20px`.
- Post-fix evidence: the text aligns with the editor’s right-side padding while the empty-state pencil layout remains unchanged.

Required fidelity surfaces:
- Fonts and typography: Lora size, weight, line height, wrapping, and antialiasing are unchanged.
- Spacing and layout rhythm: populated text now uses balanced `20px` horizontal insets; bottom action clearance is unchanged.
- Colors and visual tokens: no token or state color changed.
- Image quality and asset fidelity: no raster or icon assets changed.
- Copy and content: the user’s transcript and all interface copy remain unchanged.

Primary interactions and console:
- Passed: transcript remains editable and the plus/clear actions stay inside the editor without overlap.
- Passed: no browser console errors.
- Passed: focused Jest, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the fix.

final result: passed

## Recording editor gradient action footer - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-editor-action-overlap`

Implementation screenshot path:
- `/tmp/noctalia-recording-editor-gradient-footer-final-363x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `363x837`, remembered-dream text mode, dark theme, long populated transcript.

Full-view and focused comparison evidence:
- The annotated source and implementation use the same route, viewport, mode, theme, and long repeated transcript.
- The editor and its lower action area are clearly readable in the full-view comparison, so no separate crop was needed.

Comparison history:
- P2 source finding: the plus, microphone, and clear buttons floated directly over the final transcript lines.
- First fix: grouped the actions into a footer with a `30px` top fade and reserved `98px` of editor bottom padding.
- P2 follow-up finding: the existing translucent surface token still allowed text to show beneath the solid part of the footer.
- Final fix: changed the footer and gradient endpoint to the opaque theme card surface while keeping the translucent editor body.
- Post-fix evidence: transcript lines fade before the buttons and no text remains visible behind the controls.

Required fidelity surfaces:
- Fonts and typography: Lora family, size, weight, line height, and wrapping remain unchanged.
- Spacing and layout rhythm: the footer reserves a stable action zone inside the existing rounded editor without increasing its external footprint.
- Colors and visual tokens: the fade ends on the opaque Noctalia card token; button and border tokens remain unchanged.
- Image quality and asset fidelity: no raster or icon assets changed.
- Copy and content: transcript and action labels remain unchanged.

Primary interactions and console:
- Passed: plus, microphone, and clear remain individually accessible and clickable.
- Passed: the long transcript remains editable and scrollable with its final lines separated from the footer.
- Passed: no browser console errors.
- Passed: focused Jest, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after the two fixes above.

final result: passed

## Remembered-dream save visibility - 2026-07-13

Source visual truth path:
- `browser:/recording#comment-save-button-missing`

Implementation screenshot path:
- `/tmp/noctalia-recording-save-button-fragment-358x837.png`

State and viewport:
- Route: `http://localhost:8081/recording`.
- Viewport: `358x837`, remembered-dream voice mode, dark theme, populated fragment matching the annotated source.

Full-view and focused comparison evidence:
- The annotated source and implementation use the same route, viewport, mode, theme, and transcript.
- The save action and transcript are both legible in the full-view comparison, so a separate crop was not needed.

Comparison history:
- P1 source finding: the editor contained a substantial fragment but the save action was absent because an invisible `80`-character threshold controlled whether the footer mounted.
- Fix: aligned save visibility with the app's existing minimum meaningful-fragment rule by reducing the readiness threshold to `18` characters.
- Post-fix evidence: the same transcript now displays the active `Enregistrer ce souvenir` action above the persistent navigation without moving or restyling nearby controls.

Required fidelity surfaces:
- Fonts and typography: all display, editor, button, and navigation typography remains unchanged.
- Spacing and layout rhythm: the existing footer occupies its intended reserved space only when the fragment is saveable; no new spacing was introduced.
- Colors and visual tokens: the active save action retains the existing Noctalia primary action tokens.
- Image quality and asset fidelity: no images or icons changed.
- Copy and content: the user's transcript and all interface labels remain unchanged; the behavior now matches the promise that an old dream may be fragmentary.

Primary interactions and console:
- Passed: the populated transcript exposes the enabled save action with its complete accessible label.
- Passed: empty and under-`18`-character drafts remain below the readiness threshold.
- Passed: no browser console errors.
- Passed: 5 focused unit tests, ESLint, app typecheck, tests typecheck, and `git diff --check`.

Findings:
- P0: none.
- P1: none after the threshold fix.
- P2: none.

final result: passed

## Settings shared header annotation - 2026-07-14

Source visual truth path:
- `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/codex-clipboard-92b6f25b-39a3-4177-ad31-3b5b7134a0b3.png`

Implementation screenshot path:
- `/Users/tanuki/Documents/dreamer/screenshots/noctalia-settings-uniform-header-375x667.png`

State and viewport:
- Route: `http://localhost:8081/settings` reached through the app tab navigation.
- Viewport: `375x667`, dark theme, guest mock profile.

Full-view and focused comparison evidence:
- The annotated browser capture and the revised implementation were opened together at the same viewport.
- The selected settings group and header are both fully readable in the full view, so a separate crop was not required.

Comparison history:
- Annotation requirement: preserve the settings body exactly while making the header uniform with Accueil, Journal, and Stats.
- P2 source finding: Settings alone used a custom compact/editorial header variant with a serif page title and additional tagline.
- Fix: removed the Settings-only compact and description props, removed the unused custom styles and translations, and restored the shared `NoctaliaScreenHeader` contract.
- Post-fix evidence: Settings now uses the same Noctalia wordmark scale, Space Grotesk page-title hierarchy, top spacing, and vertical rhythm as the other tab screens. Account and experience content are unchanged.

Required fidelity surfaces:
- Fonts and typography: the shared Fraunces wordmark and Space Grotesk page title now match the other tab screens.
- Spacing and layout rhythm: the shared header insets and spacing are restored; the annotated body dimensions and navigation remain unchanged.
- Colors and visual tokens: no color or surface tokens changed.
- Image quality and asset fidelity: no assets or icons changed.
- Copy and content: the Settings-only tagline was removed; all body copy and controls remain unchanged.

Primary interactions and console:
- Passed: tab navigation reaches Settings and keeps the selected tab state.
- Passed: account, experience, ritual, subscription, and privacy content remain mounted in their existing order.
- Passed: no browser console errors.
- Passed: focused route tests, app typecheck, scoped ESLint, and `git diff --check`.

Findings:
- P0: none.
- P1: none.
- P2: none after restoring the shared header.

final result: passed

## Nouveautés 3.0.0 — 2026-07-16

Source visual:
- `/Users/tanuki/.codex/generated_images/019f69d3-235c-7713-bc8c-7809141255c8/exec-774bf992-4baf-433c-9415-cbf93181bc78.png`

Implementation evidence:
- Dark: `screenshots/whats-new-3.0.0-dark.png`
- Light: `screenshots/whats-new-3.0.0-light.png`
- Focused comparison: `screenshots/whats-new-3.0.0-comparison.png`
- Dark viewport: `390x844`.
- Light state: explicit light-system preview, restored to automatic after capture.
- Full-view evidence: the complete modal, backdrop, four release items, both actions, and close control are visible in both theme captures.

Comparison history:
- Initial dark capture exposed a visible browser focus outline around the programmatically focused title.
- Added the established web focus-reset style used elsewhere in the app.
- Recaptured dark and light states and compared the dark implementation side-by-side with the source visual.

Findings:
- Hierarchy, typography, warm accent, rounded container, icon rows, separators, primary CTA, and secondary dismissal match the selected direction.
- Version intentionally updated from 2.0.2 in the reference to 3.0.0 in the implementation.
- The compact mobile layout keeps all content readable without clipping; the card scrolls on shorter viewports.
- The light variant preserves the hierarchy with an ivory surface, dark copy, a softer backdrop, and accessible contrast.
- Primary CTA dismisses the modal and opens `/dream-guides`.
- No `findNodeHandle` web error. Remaining warnings are pre-existing Expo/require-cycle/deprecation warnings outside this feature.

final result: passed

## Android account sheet keyboard P1 — 2026-08-09

Implementation screenshot paths:
- Sign-in entry: `/tmp/noctalia-p1-signin-keyboard.png`
- Sign-up entry: `/tmp/noctalia-p1-signup-keyboard.png`

State and device:
- Physical device: Motorola Edge 60 Fusion, `1220x2712`, Android keyboard open.
- Artifact: local arm64-v8a Release QA package `com.tanuki75.noctalia.qa`, installed
  alongside the Play-signed `com.tanuki75.noctalia` so version 53 data remained intact.
- Route: Settings > Account, guest state, French locale.

Comparison history:
- P1 source finding: the content-sized account bottom sheet could leave the
  password field and both email actions below the visible region when the Android
  keyboard opened.
- Fix: expose Expo UI native `snapPoints`, use `['full']` only for
  `settings-account-sheet`, let the React Native host fill that detent, and make
  the form ScrollView shrinkable with keyboard-aware scroll behavior.
- Post-fix evidence: with a `1041px` IME inset, the sheet resized from
  `[45,173][1175,2644]` to `[45,173][1175,1671]`; the focused password field
  remained at `[113,1011][1108,1149]`, and both enabled actions remained fully
  visible at `[113,1199][599,1338]` and `[622,1199][1108,1338]`.

Primary interactions and runtime evidence:
- Passed: opening from `settings-account-open-signin`, focusing the password,
  and keeping both `btn.auth.signIn` and `btn.auth.signUp` accessible.
- Passed: closing the sheet, reopening from `settings-account-open-signup`,
  focusing the password, and keeping both actions accessible.
- Passed: `mInputShown=true`, `mIsInputViewShown=true`, and IME bottom inset
  `1041`; the Noctalia QA process remained alive and foregrounded.
- Passed: 11 related Jest suites / 128 tests, focused 13 tests, app typecheck,
  scoped lint with only two pre-existing hook warnings, mobile security audit
  with zero failures, and `git diff --check`.
- Release gate report: 16 pass, 1 fail, 2 blocked. The remaining entries concern
  the not-yet-created hotfix candidate and stale release evidence; no new Store
  submission is authorized by this QA record.

Findings:
- P0: none.
- P1: none after the fix.
- P2: none in the tested account-sheet keyboard scope.

final result: passed

## Lucid MILD path-first journey — 2026-08-20

Source visual truth path:
- `/var/folders/43/xbm0tcvd4hx6_0648bm4y5b00000gn/T/codex-clipboard-2a7be78e-f840-4769-9abc-fc03fdefda2f.png`

Implementation evidence:
- Initial `0/7`: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-path-first-v3-zero-of-seven.png`
- Progressed `1/7`, current session 2: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-path-first-v3-progressed.png`
- Source-versus-device comparison: `/Users/tanuki/.codex/visualizations/2026/08/20/01a01e4d-41d4-7a00-8508-2f2ae74f0978/mild-path-first-v3-source-vs-device.png`

State and device:
- Physical Motorola Edge 60 Fusion, `1220x2712`, density `2.8125`, French locale.
- Local Expo development client `com.tanuki75.noctalia.lucid`; this is device QA, not proof of the Play-distributed binary.
- Compared both the honest initial `0/7` state and a real progressed `1/7` state with session 2 current.

Comparison history:
- Initial implementation put a brochure-style title, summary, pills, progress card, CTA, and safety card before the illustrated route.
- The first path-first pass exposed the route immediately, but the progress segments collided with session 7 and an absolutely positioned CTA could cover markers for middle sessions.
- Final pass uses a compact overlaid title and honest counter, renders the CTA immediately after the current node, and splits the image at that node so the lower image and lower markers move together.
- The inserted card gap was tuned from `192dp` to `168dp` after physical-device inspection.
- Independent visual QA passed with no P0 or P1 findings.

Required fidelity surfaces:
- Route and progress appear immediately; secondary MILD description, metadata, safety details, and evidence are below the interactive journey.
- The single `915/1719` illustration owns the same coordinate space as all seven markers, preserving marker-to-path alignment.
- Visible order and accessibility order are `7 -> current -> CTA -> remaining sessions -> 1`.
- The current CTA keeps the real start/resume behavior and never manufactures progress; `0/7` remains valid after starting until a session is actually completed.
- Compact mode omits the objective rather than truncating it. Reflow at large text scale restores the complete objective.

Primary interactions and runtime evidence:
- Passed on the Motorola: initial route, start, session 1, return, `0/7`, resume, pause, disabled current marker while paused, and `1/7` route assertion.
- Passed: one complete Maestro traversal reached all final assertions. Subsequent cold-state retries were interrupted before app assertions by a Maestro host `Signal 6` crash during initial screenshot sampling; this is recorded separately from product behavior.
- Passed: 4 focused Jest suites, 40 tests; app and test typechecks; scoped Expo lint; `git diff --check`.
- Passed: deterministic regression coverage for the pre-existing asynchronous notification reconciliation race, proving that a newly completed session remains in both context and storage.
- The floating GameTime gear visible in device captures is Motorola chrome, not part of Noctalia.

Findings:
- P0: none.
- P1: none.
- P2: none. The compact objective omission is an intentional density tradeoff and its content remains accessible and available in reflow.

final result: passed
