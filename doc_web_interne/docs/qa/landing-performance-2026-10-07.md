# Landing performance — 2026-10-07

## Scope

Home landing (`/` and `/fr/`, same layout for every locale). Texts, meta,
URLs, canonical, structured data, analytics events and the hidden browser-trial
CTA are unchanged. The immersive backgrounds, intro film and loop stay.

## Diagnosis (base 6a05d1a)

- Four render-blocking stylesheets on the landing; merging the three
  landing-only files measured about −150 ms simulated mobile LCP.
- The shared aurora (infinite `background-position` animation) and two
  `blur(100px)` orbs were rendered under the observatory's opaque fixed ground:
  invisible, but repainted on every frame.
- The hero loop listed H.264 first, so Chrome downloaded 603 KB (desktop) or
  227 KB (mobile). The existing WebM was VP9 profile 1 in RGB (`gbrp`), which
  is software-decoded and not universally supported.
- The enhancement layer ran every scene setup in one idle callback: a single
  359 ms task on a 4× throttled CPU.

## Changes

- `css/landing.css` is generated at build time from `language-dropdown.css`,
  `observatory.css` and `experience.css` in their previous cascade order;
  landings load it after the shared `styles.min.css` (two stylesheets, not four).
- Landing pages no longer render the hidden aurora/orbs; the dead orb pointer
  parallax is removed.
- Hero loops re-encoded as VP9 profile 0 (8-bit 4:2:0) and listed first with an
  exact codec string (`vp09.00.31.08`); MP4 stays as the fallback. Source: the
  previous WebM, `libvpx-vp9 -pix_fmt yuv420p -crf 36 -b:v 0 -row-mt 1
  -deadline good -cpu-used 2 -g 240`, two passes, 24 fps, 480 frames.
  SSIM Y against the previous WebM: 0.991 (1280) and 0.991 (854), higher than
  the MP4 Chrome served before (0.983 and 0.982). The intro and ending films
  are unchanged.
- Scene setup yields to the main thread between groups of scenes.

## Evidence

Local build served by `scripts/site-performance/serve-compressed.cjs`
(Brotli, clean URLs), Lighthouse 13.4.1 simulated throttling, Chromium 141
headless, medians of five runs per page and preset. Hardware hints pinned to a
real phone (8 cores, 4 GB, light tier) and desktop (8 cores, 8 GB, full tier).

| Mobile (`/`, `/fr/`) | Before | After |
| --- | --- | --- |
| Performance score | 91, 90 | 95, 95 |
| FCP | 1.54 s | 1.46 s |
| LCP | 2.56 s | 2.41 s |
| TBT | 191, 205 ms | 46, 52 ms |
| Speed Index | 4.37 s | 4.33 s |
| CLS | 0 | 0 |
| Transfer | 1,064 KB (≈901 KB in Chrome) | 751 KB |

| Desktop (`/`, `/fr/`) | Before | After |
| --- | --- | --- |
| Performance score | 97 | 97 |
| FCP | 0.37 s | 0.39 s |
| LCP | 0.61 s | 0.60 s |
| TBT | 0 ms | 0 ms |
| Transfer | 1,701 KB (≈1,322 KB in Chrome) | 869 KB |

Chromium has no H.264 decoder: before the change it fetched the MP4 loop,
failed, then fetched the WebM. The "in Chrome" figures remove that duplicate;
Chrome now downloads only the WebM. Desktop FCP is about 20 ms later with the
larger single stylesheet; LCP is unchanged.

Idle main thread after the intro (`/fr/`, mobile emulation, CPU 4×, 5 s):
footer 1,503 → 1,095 ms (−27%, medians of five and six interleaved runs). At the
hero the difference stayed within run-to-run noise.

Speed Index is bounded by the 4 s intro film, which plays on every visit by
design; it was not changed.

Visual check: reduced-motion full-page screenshots of `/` and `/fr/` at
412×915 and 1350×940 are pixel-identical before and after. A scripted journey
in the light and full tiers saw the intro play, the WebM loop take over, the
headline and dream cards reveal, the ending film play on desktop and no page,
console or request errors, identical to the base.

Not covered: physical Android and iOS devices, Safari (MP4 remains its
fallback when it rejects the VP9 codec string), production CDN timings and field
Core Web Vitals. `scripts/lib/intro-buffering.test.js` has one failing test on
the base revision too.

Rerun:

```sh
npm install --prefix /tmp/landing-lab lighthouse@13.4.1 puppeteer-core@24
npm run docs:build
node scripts/site-performance/serve-compressed.cjs docs 8530
LAB_TOOLS=/tmp/landing-lab CHROME_PATH=<chrome> node scripts/site-performance/landing-lab.mjs /tmp/landing-evidence 5
```

## Story polish — 2026-10-08

Requested after the performance pass: polish the landing without a redesign,
remove what repeats and strengthen the story after the dream journey.

Diagnosis: after the star map the page said "voice, analysis, patterns"
three times (waking, steps, features), each with screenshots of an older app
UI (English on every locale), and the remembering chapter came after the
resources. Changes:

- Order after the journey: waking (the three steps), remembering, who it is
  for, symbols and tool links, plans, FAQ, ending. The waking and features
  sections are removed; step 1 now carries the waking label and a live
  capture screen (waveform, timer, transcript written word by word).
- Current app screens (French on `/fr/`, English elsewhere) for steps 2 and 3
  and the ending, which now opens onto the journal.
- Plus price line sized as a statement; the landing footer no longer squeezes
  the brand column below 1100 px.
- Unchanged: title, meta, canonical, structured data (FAQ text included),
  H1, internal links, the `#how-it-works` anchors, analytics events.

A `max-width: 16ch` on the price line measured as +130 ms TBT on mobile:
most likely because a glyph-relative unit makes Chrome restyle the page on each web-font
load. Bisected by swapping single CSS hunks in an interleaved A/B; it now
uses `rem`.

| Five-run medians, local build | Before polish (01030c9) | After polish |
| --- | --- | --- |
| Mobile score `/`, `/fr/` | 95, 95 | 95, 95 |
| Mobile TBT `/`, `/fr/` | 46, 52 ms | 41, 33 ms |
| Mobile LCP | 2.41 s | 2.41 s |
| Desktop score, LCP | 97, 0.60 s | 98, 0.59 s |

The page loads the same resources before and after (about 770 KB on mobile
when compared run for run); the new screenshots are lazy and below the fold.

Interleaved A/B on `/fr/` (same machine, same session): mobile TBT 35 → 18 ms,
style and layout 1.58 → 1.44 s; desktop TBT 0 → 0 ms.

Journey check: light and full tiers play the intro and the WebM loop, reveal
the headline and dreams, play the ending on desktop, with no page, console or
request errors. Screens checked at 1440×900 and 390×844 for `fr`, `de` and
`pt-br`. Not covered: physical devices and Safari.
