# Site measurements (TI-530)

Report-only tooling; no CI gate, publication or production access. Run from the
repository root. Keep compact evidence in the ignored `outputs/` directory.

## Locked dependency comparison

```sh
mise exec -- python3 scripts/site-performance/measure-install.py outputs/site-install-evidence
```

Output paths outside the repository's `outputs/`, including symlinks resolving
outside it, are refused before creating the report directory or workspace.

This copies tracked manifests into disposable directories and compares three
fresh-cache and three populated-cache `npm ci` runs for each package. Every run
removes/reinstalls node_modules through npm ci. Cold means a new npm cache, not a
cold OS filesystem cache. No audit/fund network requests are included. All six
installs for a target use the same directory. Scratch and the six isolated cold
caches live under `~/Projects/.workspaces/<repo>/measure-install`, with a live
owner lease; a concurrent benchmark is refused. `finally` removes them after
success or failure, while preserving partial logs, measurements and the compact
`workspace-receipt.json` in the output directory. No real package install is run
by the lifecycle tests. Pass `--keep-workspace` only for explicit diagnosis; its
receipt records retention, and a later run refuses to overwrite that evidence.
Inspect it, then use `npm run workspace -- release --task measure-install` when
finished. Regular installs continue to use the existing configured npm/pnpm
cache; no additional global cache is created. Do not run concurrent builds/audits
when seeking low-noise results.

## Build and validation

```sh
npm ci --prefix apps/site --cache /private/tmp/site-npm-cache --no-audit --no-fund
npm run build --prefix apps/site
npm run check --prefix apps/site
```

Time build separately at least three times. The first build has no generated
`docs/`; later builds reuse filesystem caches and tracked image derivatives.
Record that distinction; do not describe this as three cold image builds.

## Browser corpus

Install pinned Lighthouse outside the project, then start the canonical preview
server in a separate terminal. No root/mobile dependencies are needed.

```sh
npm install --prefix /private/tmp/site-lighthouse --cache /private/tmp/site-tool-cache --no-audit --no-fund lighthouse@13.4.1
npm run serve:docs -- --port=8530
LIGHTHOUSE_CLI=/private/tmp/site-lighthouse/node_modules/lighthouse/cli/index.js node scripts/site-performance/measure.cjs /private/tmp/site-browser-evidence
```

The script runs five pages three times sequentially, with a fresh headless Chrome
profile per Lighthouse invocation and default simulated mobile throttling. Chrome
must be installed. The output records exact Lighthouse version, settings, source
SHA, individual metrics, category scores, resource breakdowns and render-blocking
resources. A runtime failure stops the corpus; it never becomes a successful row.

This server does not compress HTML/CSS/JS like a CDN. Local transfer sizes and
simulated network times must not be presented as production observations. Main
thread time is browser lab work, not device battery or operating-system CPU use.
Consent remains unset; analytics are not enabled by the harness. Automated
accessibility scores do not prove keyboard, screen-reader, animation or CTA flow
correctness. Run functional browser QA separately for source changes.

## Landing lab

`landing-lab.mjs` measures the home landing with Lighthouse on the mobile and
desktop presets, pinning hardware hints so each preset lands on the experience
tier real devices get (light on phones, full on desktops), then samples the
idle main-thread cost after the intro. `serve-compressed.cjs` serves `docs/`
with Brotli and clean URLs so transfer sizes approximate a CDN.

```sh
npm install --prefix /tmp/landing-lab lighthouse@13.4.1 puppeteer-core@24
node scripts/site-performance/serve-compressed.cjs docs 8530
LAB_TOOLS=/tmp/landing-lab CHROME_PATH=<chrome> node scripts/site-performance/landing-lab.mjs /tmp/landing-evidence 5
```

Chromium builds without H.264 fetch an MP4 source before failing over to the
next one; read media rows from `summary.json` before comparing transfer sizes.
These are lab results, not production Core Web Vitals.
