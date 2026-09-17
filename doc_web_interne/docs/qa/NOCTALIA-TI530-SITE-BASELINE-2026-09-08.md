# TI-530 — site baseline, 2026-09-08

## Decision and scope

Keep the existing isolated `apps/site` package. It has five explicit direct build dependencies and 66 lockfile package entries, versus 1,994 at the mobile root. The baseline adds report-only measurement tooling. The final narrowly scoped reduced-motion source correction is documented below; CI, editorial content, public URLs, runtime libraries and deployment settings remain unchanged. A framework migration is not justified by this baseline.

Source measured: `d2bc2593644f6be05a3f0f201ba19d6fd53f6d78` in a clean worktree. The current isolation was already implemented before this measurement. The comparison below is root installation versus existing isolated installation at the same SHA, **not an invented before/after source optimization**.

## Conditions and reproduction

macOS 26.6.2 arm64; Node 24.19.0, npm 11.17.0, Chrome 152.0.7977.83, Lighthouse 13.4.1. Machine CPU model unavailable under sandbox. This is a shared development host with other agent work; timing variability is not isolated CPU benchmarking.

Commands and reusable harness: `scripts/site-performance/README.md`, `measure-install.py`, `measure.cjs`. The initial install experiment used the same npm arguments in an ad-hoc Python loop; isolated installs ran in this clean worktree, root installs in a fresh manifest-only temporary directory. Both resolved the same tracked local `apps/site` dependency. Cold = fresh npm cache for each pair, warm = same populated cache with node_modules reinstalled by npm ci; OS cache was not flushed. No npm audit/fund request included. Root and site phases ran on the same host, not alternated. Browser runs overlapped root installs; do not derive CPU performance improvements from their differences.

| Installation | Cold seconds (3 runs) | Cold median | Warm seconds (3 runs) | Warm median |
|---|---|---:|---|---:|
| Isolated site | 3.747 / 3.278 / 3.350 | 3.350 | 1.985 / 2.313 / 2.223 | 2.223 |
| Mobile root | 45.351 / 83.337 / 70.820 | 70.820 | 52.336 / 73.912 / 48.245 | 52.336 |

All12 installs exited0. Root node_modules allocated1,494,604KiB versus site39,844KiB (~37.5× smaller). These paired observations support keeping the isolated package; they do not establish hosted CI minute savings. Warm cache did not consistently improve the root runs; the range is retained instead of hiding it behind a percentage. No root build comparison is claimed because build commands resolve the same isolated tooling and sources.

Three `npm run build --prefix apps/site` runs: 15.05 / 12.57 / 13.76 seconds, median 13.76s. First docs output was absent; subsequent runs reused OS caches. Tracked optimized image derivatives were reused where their content fingerprint matched. These are not three cold image-encoding runs. `npm run check --prefix apps/site` passed; existing FAQ visibility warnings were emitted, not introduced here.

Generated output: 3,900 files / 321,151,573 logical bytes (du allocation differs). Installed isolated dependencies: 39,844 KiB allocated. Generated output is ignored and not committed.

## Browser lab corpus

Local canonical `npm run serve:docs -- --port=8530`; five pages × three sequential Lighthouse invocations, each fresh Chrome profile, consent unset. Default mobile simulated throttling: 412×823 CSS pixels, DPR1.75, RTT150ms, throughput1638.4Kbps, CPU multiplier4. A preliminary one-page tooling pilot is excluded from the three-run corpus.

**The local server does not compress text like the CDN.** LCP/transfer values here are local laboratory observations, not production or physical Android results. Main-thread duration measures browser work, not system CPU utilization or battery use. Automated accessibility audits are not complete functional/accessibility QA.

| Page | Runs | FCP ms median (range) | LCP ms median (range) | TBT ms median (range) | Main thread ms median (range) | Max CLS |
|---|---:|---:|---:|---:|---:|---:|
| home | 3 | 1954.9 (1954.5–1955.9) | 3007.3 (3006.8–3008.8) | 0.0 (0.0–0.0) | 901.0 (877.3–1098.6) | 0.00115 |
| product | 3 | 1512.7 (1505.2–1809.3) | 2562.7 (2555.2–2709.3) | 0.0 (0.0–0.0) | 194.5 (187.5–202.3) | 0.00115 |
| dictionary | 3 | 4969.9 (4964.5–5002.2) | 6307.9 (6304.2–6309.7) | 257.0 (244.0–262.0) | 1304.0 (1275.2–1423.8) | 0.00000 |
| article | 3 | 1966.1 (1961.2–1969.9) | 3166.1 (3161.2–3319.9) | 0.0 (0.0–0.0) | 290.6 (275.7–341.0) | 0.00115 |
| media | 3 | 2113.9 (2106.9–2419.4) | 3770.8 (3685.3–3779.1) | 0.0 (0.0–85.0) | 1008.3 (744.0–1088.1) | 0.00115 |

Routes: `/fr/`, `/fr/application-analyse-de-reve-android`, `/fr/guides/dictionnaire-symboles-reves`, `/fr/blog/comment-se-souvenir-de-ses-reves`, `/fr/blog/` (media-rich index). Every audit completed without Lighthouse runtime error. Raw results record category scores and warnings individually.

First-run observed resource transfers in bytes, including response overhead; third-party resources are included in total:

| Page | Requests | HTML | JS | CSS | Images | Fonts | Total |
|---|---:|---:|---:|---:|---:|---:|---:|
| home | 23 | 93184 | 61953 | 66315 | 209984 | 93171 | 524607 |
| product | 12 | 47126 | 29898 | 39183 | 46089 | 79020 | 241316 |
| dictionary | 17 | 693749 | 29898 | 39183 | 152127 | 79020 | 993977 |
| article | 15 | 80291 | 32062 | 72270 | 85088 | 79020 | 348731 |
| media | 26 | 157800 | 42672 | 67434 | 641506 | 65297 | 974709 |

## Findings and advisory budgets

The dictionary is the outlier: 693,539 raw HTML bytes, versus locally computed gzip68,971 / Brotli50,079 bytes (compression estimates, not captured CDN transfers). Its ~6.31s simulated LCP cannot be called a production regression from this uncompressed server. It also has ~1.3–1.4s main-thread work and ~260ms TBT, worth profiling under production-equivalent compression before changing DOM generation or searchable content.

Homepage blocking CSS includes observatory (~23.6KB), base styles (~36.7KB), experience (~3.5KB) and language dropdown (~2.5KB), uncompressed. Lighthouse suggests ~72KB screenshot savings, but existing responsive sources already provide480/800w variants and emulated DPR needs ~522 physical pixels: blindly forcing480w risks blurring. A600w derivative experiment needs visual comparison and image-contract validation; no speculative source change is applied.

Report-only non-regression proposal: compare each page independently against these three raw runs. Flag deterministic HTML/JS/CSS/image byte or request-count increases for explanation, rather than assigning an arbitrary universal byte limit. For LCP/TBT/main-thread time, use each observed maximum as an initial investigation marker only; collect at least five further runs on an idle, pinned host and equivalent compression before setting any blocking threshold. Existing image/hero/preload/dimension contracts remain authoritative. This baseline does not justify suppressing animations or introducing CI failure thresholds.

Automated accessibility scores ranged91–98 (existing heading/name findings); best-practices/SEO100 across this corpus. No source change means no newly introduced navigation/localization/animation behavior; this audit does not certify those interactions. Production-compressed runtime optimization and functional browser QA remain open acceptance work for TI-530, separate from the measured installation-isolation benefit. No publication occurred.

Lighthouse cautions that underlying conditions affect scores; see [official scoring and variability guidance](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring).

## Evidence

Raw local evidence retained at `/private/tmp/ti530-evidence/`: `timings.json`, `root-timings.json`, build/install logs, `check.log`, `browser/summary.json` and15 full Lighthouse reports. These temporary files are not repository inputs. Tooling parsed/ran successfully; `git diff --check` passes. No CI configuration, source page, lockfile, shared data, or generated output changed.

## Follow-up: compressed dictionary and functional qualification

A temporary loopback-only server (`/private/tmp/ti530-compressed.cjs`, port8531) served the **same generated bytes** with gzip for HTML/CSS/JS/JSON/SVG, preserving clean-path resolution and MIME types. It did not alter canonical sources, CDN settings or generated files. Three fresh-profile Lighthouse13.4.1 mobile performance runs used the same default simulation as above. This is representative compressed local transport, not a replica of Cloudflare edge/cache/geographic latency.

| Run | FCP ms | LCP ms | TBT ms | Main-thread ms | CLS | Transfer bytes |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 1538.4 | 2790.4 | 219 | 1232.0 | 0 | 344480 |
| 2 | 1507.1 | 2854.8 | 190 | 1138.9 | 0 | 344480 |
| 3 | 1504.8 | 2703.2 | 224 | 1233.5 | 0 | 344480 |

The same-source compressed median LCP is2790.4ms versus6307.9ms uncompressed, with transfer344480B versus993977B. This isolates the transport condition; it is **not a delivered optimization gain**. Main-thread work remains about1.2s and TBT190–224ms. The generator eagerly renders150 searchable cards and scroll handlers read the26 letter sections. Replacing this with virtualization/content-visibility risks A-Z anchors and browser find; the evidence does not justify that architectural change here. Keep the current runtime and package isolation. Proposed next investigation marker is the compressed range above, still advisory and not a CI gate.

Functional Chrome qualification on the same local source, using supported CUA browser controls:

- Reject analytics: banner dismissed with “Continuer sans mesure”; it remained dismissed after same-origin navigation. No analytics opt-in was performed. Network-level nontransmission was not instrumented in this manual check.
- Search `serpent`: active-search status shows6results. Search `zzqzzq`: explicit no-result state and0results. “Vider la recherche” restores alphabet and category links. A programmatic empty fill did not clear the input; the actual visible clear button did, so no product failure is inferred from that automation discrepancy.
- Category “Nature19symboles” opens `/fr/symboles/nature` with matching heading/count. Selecting Eau opens `/fr/symboles/eau`, localized heading and breadcrumb. Header dictionary link returns to the corpus page.
- A-Z “Z” navigation with emulated reduced-motion reached a visible “Symboles commençant par Z” heading. The browser-control call stalled before returning; animation timing is therefore **indeterminate**. Source review finds explicit `behavior: 'smooth'` in the A-Z/back-to-top handlers regardless of reduced-motion. This pre-existing accessibility limitation is reported for a separate bounded correction, not silently certified. The temporary emulation override was reset and QA tab closed.

No runtime product edit is proposed from these timings. Installation isolation, repeatable builds, corpus measurements, compressed diagnosis and bounded functional paths are now evidenced. Complete accessibility/motion acceptance remains open due to the explicit smooth-scroll behavior; there is no claim of production field metrics. Raw compressed reports: `/private/tmp/ti530-evidence/compressed-{1,2,3}.json`. No further installs or Lighthouse repetitions were performed after these results.

## Final source correction: honor reduced motion

The parent approved correcting the concrete reduced-motion finding. `scripts/build-guides-pages.js` now reads `prefers-reduced-motion` at each of the three dictionary scroll actions (search reposition, A-Z, back-to-top), requesting `instant` when reduced and preserving `smooth` otherwise. `instant` avoids inheriting a smooth CSS scroll behavior. Horizontal alphabet scrolling uses `auto` under the same media preference. No animation was added, no timing/geometry/content/search logic changed.

Validation of final source: `node --check scripts/build-guides-pages.js`; all three actual emitted behavior expressions evaluated with both media states (six passing cases); `npm run build --prefix apps/site` and `npm run check --prefix apps/site` both pass, existing FAQ warnings unchanged; `git diff --check` passes. No dedicated dictionary browser-unit harness exists, so no large parallel framework was introduced for this correction. Logs: `reduced-motion-build.log`, `reduced-motion-check.log` in the existing evidence directory.

Independent post-fix Chrome headless verification now passes: A-Z, back-to-top and search reposition request instant scrolling under reduced motion and smooth scrolling otherwise; horizontal CSS resolves to auto/smooth respectively. The Z heading is visible, link focus and URL are preserved; serpent search returns six results with search focus preserved. Evidence: `/private/tmp/ti530-evidence/independent-reduced-motion-browser.json`. All Lighthouse metrics above remain the pre-fix baseline; no performance improvement from this accessibility fix is claimed. Prior statements about unchanged source describe the measurement stage, before this approved correction. Independent review accepted the final source and measurement claims; delivery remains separate.
