# TI-531 Android qualification — 2026-09-08

## Candidate and environment

Independent QA against app source `2af5163bc` (failure), `5186348f9` (identity/offline correction), then `685501c1f` (account/pagination/statistics confirmation). Sources copied with git archive into `/private/tmp/ti531-build`; generated native project reused without Expo prebuild. Subsequent changes are JavaScript, served via canonical expo-safe-runner profile on Metro8087. Native debug build succeeded in5m32,739tasks.

Isolated emulator `emulator-5580`, API36/Android16, arm64-v8a Pixel8 profile,1080x2400. Base package `com.tanuki75.noctalia`, scheme `noctalia`, local debug APK3.1.0(54), certificate SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Installed into initially empty dedicated AVD; no uninstall/data clear.

Motorola inspected read-only under shared dreamer lock: Play3.1.0(65), certificate `6a8cb2e2cdd2c1fdd7c5cfcf00d7c3cc5861c2cd3faf49f69a312535a44fee0f`. Never replaced or used for these feature proofs.

Disposable Supabase API55321, emulator10.0.2.2:55321. Backend owner seeded synthetic accountA2501/accountB1, all dates identical; 137-row cap was exercised by backend qualification; Android active server cap was not measured (configuration default1000). Auth through actual email/password UI, no session injection. Credentials are excluded from evidence/report.

## Results

| Scenario | Result | Evidence |
|---|---|---|
| Baseline tied-date identity | FAIL reproduced: search1799 opened2501 title/transcript | `/private/tmp/ti531-search17.xml`, `/private/tmp/ti531-detail1799b.xml`, `/private/tmp/ti531-detail-wrong.png` |
| Corrected detail | PASS518: search1799 opens1799 title and originaltranscript | `/private/tmp/ti531-final-search.xml`, `/private/tmp/ti531-final-detail.xml`, `/private/tmp/ti531-final-detail1799.png` |
| Search beyond initialpage | PASS1799 found without scrolling initiallist to that item | same search evidence |
| Targeted favorite | PASS1799 remoteid1801 true,2501 remoteid2503 unchangedfalse | `/private/tmp/ti531-final-favorite.xml`; authenticated public-client DB read |
| Offline deletion | PASS Wi-Fi/data disabled,1799 removed locally while DBstill2501 with1799present | `/private/tmp/ti531-offline-search.xml`, `/private/tmp/ti531-offline-deleted.png` |
| Reconnect and processrestart | PASS queue replay afterrestart: DB2500,1799absent,2501presentfalse | authenticated public-client DB read; `/private/tmp/ti531-cache-proof.json` |
| Signout isolation | PASS guestjournal empty | `/private/tmp/ti531-signedout.xml` |
| AccountB | PASSonlyBsingleentry/endindicator; search2501 returnsnone | `/private/tmp/ti531-accountB.xml`, `/private/tmp/ti531-accountB.png`, `/private/tmp/ti531-accountB-noA.xml` |
| ReturnA | PASS2500 restored,1799stillabsent, no resurrection | `/private/tmp/ti531-returnA.xml`, `/private/tmp/ti531-returnA-deleted.xml` |
| Visible pagination | PASSscroll crossed>100rows (40-row pagination window),2395..2391 visible | `/private/tmp/ti531-page-next.xml`, `/private/tmp/ti531-page-next.png` |
| Exhaustive nativecache | PASSread-only ExpoSQLite storage A2500 distinctremoteIDs/B1distinct; pendingmutations0;1799absent2501present | `/private/tmp/ti531-cache-proof.json` |
| Trends independentofvisiblepages | PASSpattern shows2500dreams afteronly~110listrows scrolled | `/private/tmp/ti531-trends.xml`, `/private/tmp/ti531-trends.png` |

## Limits

No Play/release/performance claim; debug emulator only. Native list was scrolled beyond100rows, not manually through2500rows; exhaustiveness is independently evidenced by nativecache counts plus backend qualification. No private images in fixture, so private media expiry/offline capabilities are unqualified here. No artificial delayed-account-response or middle-page HTTP failure injection onAndroid; backend/service tests cover those separately. No purchase, analysis generation, production data or production database operation. Scoped AndroidRuntime/ReactNativeJS error capture `/private/tmp/ti531-scoped-errors.log` was empty at final scenario capture; this is not an exhaustive crash guarantee.

Current fixtureA2500 after intentional1799deletion; B1unchanged. Emulator/Metro available for final parent-chain smoke.

## Final integrated smoke — 7b0413043

Exact git archive7b0413043 refreshed the isolated JavaScript source; no native rebuild or installation. Force-stop/relaunch completed. AccountA remained signedin. Open2501 shows2501 title and originaltranscript; search1799 still returnsnoresults. Authenticated public-client DB count2500, remote2503presentfalse, deletedremote1801absent. Scoped AndroidRuntime/ReactNativeJS error output empty (0bytes), not a full crash guarantee.

Evidence: `/private/tmp/ti531-7b041-detail.xml`, `/private/tmp/ti531-7b041-detail.png`, `/private/tmp/ti531-7b041-deleted.xml`, `/private/tmp/ti531-7b041-errors.log`.

Shared physical-device lock was released after initial read-only inspection; no physical lock held during emulator tests. Isolated emulator and Metro left available as requested. Final physical package remains untouched.
