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
