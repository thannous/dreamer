# Site measurements (TI-530)

Report-only tooling; no CI gate, publication or production access. Run from the
repository root. Keep evidence outside the checkout.

## Locked dependency comparison

```sh
python3 scripts/site-performance/measure-install.py /private/tmp/site-install-evidence
```

This copies tracked manifests into disposable directories and compares three
fresh-cache and three populated-cache `npm ci` runs for each package. Every run
removes/reinstalls node_modules through npm ci. Cold means a new npm cache, not a
cold OS filesystem cache. No audit/fund network requests are included. All six
installs for a target use the same directory. Temporary directories remain for
inspection. Do not run concurrent builds/audits when seeking low-noise results.

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
