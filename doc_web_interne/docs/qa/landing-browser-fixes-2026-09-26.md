# Landing browser fixes — 2026-09-26

Scope: the three findings from production dogfooding of `23fa65c0`:
WebKit stalled VP9 intro, returning navigation covering the mobile journey
heading, and the tiny/clipped landscape constellation.

Changes: retry the existing MP4 when VP9 cannot produce a first frame; ignore
the aborted old play promise and clean up the watchdog on skip/completion.
Keep the existing synchronized handoff, WebM path in Chrome, six-second slow
start escape and reduced-motion behavior. Reserve space below navigation;
use two columns in short wide viewports and bound mobile grid dimensions.

## Local evidence

Build: the commit containing this note, served from its generated `docs/` at
`http://127.0.0.1:8016/`. Node 24.19.0, Chrome 154.0.8037.58, Playwright WebKit
26.0. Anonymous fresh contexts using only public example dreams.

Evidence directory on the task host:
`/Users/timax/Documents/Codex/2026-09-24/dan/work/browser-dogfood/`.
The `baseline/` folder preserves the original audit evidence.

Rerun from that directory (Playwright resolved from `../pr-211/node_modules`,
WebKit build 2248 in `/tmp/noctalia-dogfood-browsers`):

```sh
BASE_URL=http://127.0.0.1:8016/ node followup.cjs
BASE_URL=http://127.0.0.1:8016/ PROFILES=webkit-desktop,webkit-narrow-wheel node run.cjs
BASE_URL=http://127.0.0.1:8016/ node verify-intro-fallback.cjs
```

- PASS: WebKit MP4 fallback starts around 1.4 s, plays through `ended` around
  5.6 s, and releases the intro overlay. `intro-fallback-results.json`.
- PASS: unavailable MP4 leaves the hero usable with retry; Escape during
  the pending WebM cancels the watchdog without a later MP4 request.
- PASS: Chrome analysis indicator, complete analysis, FAQ, dictionary/back
  with intro replay. `followup.json`.
- PASS: heading clears the navigation at 430×932 and 320×568; 844×390
  constellation is about 371×254 px and ends at y=374, inside the viewport.
- PASS: WebKit desktop and narrow viewport: card click, dialog scroll,
  Escape and page-scroll recovery, all ten steps forward/reverse, six-second
  pointer sequence, mobile menu, dictionary/back, FAQ; no page exceptions.
  `webkit-desktop.json`, `webkit-narrow-wheel.json`.
- A follow-up bounds check caught WebKit intrinsic grid expansion after the
  height constraint; explicit `minmax(0, 1fr)` columns and `max-width` fixed
  it. The final narrow run passes including physical pointer hit testing of
  Next and the map's right edge.
- `docs:build`, `docs:check`, syntax and diff checks passed. ESLint: no errors;
  one pre-existing unused `initSky` warning.

No screenshot-based or physical-phone performance claim. WebKit mobile does
not expose a wheel action in Playwright, so dialog scrolling was verified in
desktop mode at a narrow viewport. Safari installed requires remote automation
to be enabled; Firefox's test driver did not launch in the original audit.
Those environments remain unqualified.
