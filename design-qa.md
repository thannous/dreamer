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
