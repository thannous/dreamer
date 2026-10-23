## Docs Source

`docs-src/` is the editable source for the static marketing site.

- `config/`: global site configuration and routed static pages.
- `content/`: editable source content for managed pages and blog articles.
- `locales/`: shared UI strings for navigation, footer, and legal labels.
- `static/`: build-owned static files copied into `docs/`.
- `templates/`: shared HTML shells used by the renderer.

`docs/` is generated output. It is ignored by Git, should never be edited
manually, and is rebuilt locally from the tracked sources before a manual upload.

The canonical symbol catalogs shared by the app and the site are
`data/dream-symbols.json`, `data/dream-symbols-extended.json`, and
`data/dream-symbols-extended-tier3.json`. Edit those files only. The docs build
copies all three into `docs/data/` after static assets, and `docs:check` verifies
that the published copies are byte-for-byte identical to the canonical data.
It also writes `docs/content/symbols/<lang>.json`, the full interpretations the
native app downloads per language, so a symbol edit reaches the app only once
the site is published.

Symbol dates use the locale's `modifiedAt`, then the symbol's `modifiedAt`.
For undated records, `meta.fallbackModifiedAt` preserves their existing date;
`meta.lastUpdated` still records the latest catalog edit. Do not advance the
fallback date when editing individual symbols. Catalogs without this optional
field retain the `meta.lastUpdated` fallback.

## Illustrated symbol pages

Before generating symbol artwork, adding an Atlas entry or changing its motion, read
[the living illustrations guideline](../doc_web_interne/docs/symbol-atlas-guidelines.md).
It defines the approved visual direction, source files, per-image motion and review criteria.

## Image storage

Images are versioned by `config/site-media.json`. The build restores the exact
bytes from the configured CDN when missing; it does not re-encode this snapshot.
Use `npm run docs:media -- refresh` explicitly when preparing new media, then
upload and verify before delivery. See the [storage and recovery guide](../doc_web_interne/docs/site-media-storage.md).

## Daily Maintenance Workflow

### Preview changes live

Use the live docs server while editing source files:

```bash
npm run docs:dev
```

Open `http://localhost:8000/fr/` or any localized page. The command runs an initial
`docs:build`, watches editable sources, rebuilds after changes, and reloads the
browser automatically after a successful build.

Watched inputs:

- `docs-src/`
- `data/`
- `scripts/lib/`
- docs generator scripts in `scripts/`

Generated `docs/` output is intentionally not watched.

### Iterate quickly on one generated page

The live server can rebuild selected symbols automatically after a generator
edit:

```bash
npm run docs:dev -- --symbol=tiger --lang=fr
```

It starts with a full build. Subsequent edits to
`docs-src/static/scripts/generate-symbol-pages.js` rebuild only the selected
symbols and reload the browser. `--symbol` accepts comma-separated ids; omit
`--lang` to regenerate their supported languages. Unknown ids/languages fail.
Any other source edit, including one arriving alongside the generator edit,
forces a full build. Edits received during a build are queued together.

A selected-page preview deliberately blocks `docs:check` and release checks
until a full `npm run docs:build` succeeds: other pages may still be stale.
This mode speeds up local editing; the PR and release checks still build and
validate the entire site.

For a one-off regeneration without the live server:

When only a page generator changes (for example
`docs-src/static/scripts/generate-symbol-pages.js`), rebuild that page alone
instead of the whole site:

```bash
npm run docs:build   # once: docs/ needs the assets, data and version stamp
cp docs-src/static/scripts/generate-symbol-pages.js docs/scripts/
node docs/scripts/generate-symbol-pages.js --id=tiger --lang=fr
```

Measured on 2026-10-18: 0.3 s instead of about 17 s for `docs:build`, and the
page came out byte-identical to the full build. Run the copy in `docs/scripts/`,
never the source: the generator writes next to its own folder. `--id` takes a
comma-separated list; category and curation pages are skipped while it is set.
Run a full `docs:build` again when anything else changes (a file under
`docs-src/static/js/` or `css/`, `data/`, templates, locales): only it copies
the assets and sets the `?v=` stamp.

Two more habits keep the loop short:

- While iterating, run only the journey you change, for example
  `node tools/e2e/run.mjs site web run --grep atlas`, then the whole site suite
  (`npm run test:testerarmy:site`) once before pushing.
- Group the requested changes into one commit and one `npm run verify:pr`
  rather than one per change. On a site-only commit the typecheck and lint
  checks are reused from the previous run, so `verify:pr` takes about a minute
  (the `site` check).

### Edit an existing page

1. Edit the source file under `docs-src/content/pages/<pageId>/<lang>.md`.
2. Keep the JSON front matter valid between the `---` markers.
3. Run or keep running `npm run docs:dev`.
4. Before publishing, run:

```bash
npm run docs:build
npm run docs:check
```

Never edit the matching HTML file in `docs/` by hand.

### Add a blog article

1. Create `docs-src/content/blog/blog.<article-id>/`.
2. Add one file for every supported language: `en.md`, `fr.md`, `es.md`, `de.md`, `it.md`.
3. Copy `docs-src/templates/blog-article.example.md` as a starting point.
4. Update each file's `pageId`, `lang`, `slug`, title, description, social metadata, body, and JSON-LD.
5. Run:

```bash
npm run docs:build
npm run docs:check
```

The build fails if any blog article is missing one of the configured languages.

### Add a language with partial collection coverage

Site languages live in `docs-src/config/site.config.json` (`languages`). Some
collections can restrict their coverage: `collections.blog`,
`collections.symbols`, and `collections.guides` each declare their own
`languages` list, while static pages declare availability per page through the
`slugs` keys of `docs-src/config/static-pages.json`. Brazilian Portuguese
(`pt-br`) is the reference example: it covers the pages listed in
`static-pages.json`, the symbol dictionary (240 symbols and 8 categories under
`/pt-br/simbolos/`) and the guides (hub, dictionary and 8 curated guides), but
never the blog. The symbol catalogs in `data/` are shared with the app and keep
its key `pt` for this language: read them through `scripts/lib/symbol-locales.js`
(`catalogKey`, `aliasWebLocales`), never with a second copy of the content.

To add such a language:

1. Add the internal identifier (lowercase, e.g. `pt-br`) to `languages`.
2. Add its public BCP 47 tag to `languageTags` (e.g. `"pt-br": "pt-BR"`, used
   for `<html lang>` and `hreflang`) and its Open Graph locale to
   `localeCodes` (e.g. `"pt-br": "pt_BR"`).
3. If the Play Store `hl` parameter differs from the identifier, add
   `storeLinks.hlOverrides` (e.g. `"pt-br": "pt-BR"`).
4. Keep the language out of `collections.*.languages` for collections it does
   not cover; those collections emit no URL and no `hreflang` for it.
5. Add the language only to the `slugs` of the static pages that have a
   translation, then create `docs-src/locales/<lang>.json` and one
   `docs-src/content/pages/<pageId>/<lang>.md` per declared slug. A declared
   slug without its source file fails the build; there is no English fallback
   under a `/<lang>/` URL.
6. Run `npm run docs:build` and `npm run docs:check`.

Pages available in the new language emit reciprocal `hreflang` only between
existing translations, plus `x-default` pointing to the English URL. Pages
without an English version omit `x-default`. Navigation, footer, and the
language switcher only link to destinations that exist in the current
language.

### Preview and publish on Cloudflare Pages

Production of https://noctalia.app is manual. The Pages project `noctalia` is
connected with the Cloudflare Git integration, which is a dashboard setting.
This repository has no `wrangler.toml` and no CI job that runs
`wrangler pages deploy`. Automatic production deployments and Git previews were confirmed disabled on
2026-10-22. A push to `master` does not publish the site; use the guarded manual
commands described in `AGENTS.md`. Generated HTML is not stored in Git.
When a build does run, Cloudflare checks out the tracked sources, rebuilds
`docs/`, validates the result, then uploads that generated directory.

The Pages project must use these build settings:

| Setting | Value |
| --- | --- |
| Root directory | Repository root (leave the field empty) |
| Build command | `npm run docs:build && npm run docs:check` |
| Build output directory | `docs` |
| Production branch | `master` |

The Node version comes from the repository's `.nvmrc`. An empty `rootDirectory`
in `config/cloudflare-pages.json` means the repository root. Keep the Cloudflare
dashboard aligned with that file whenever the build command, output directory,
or branch changes.

Disable automatic Git deployments for both production and preview branches in the
Cloudflare dashboard. A tracked config file does not apply that setting. Check it
before pushing if its state is unknown; this guide does not attest the live dashboard.
Previews are uploaded on demand with `npm run docs:deploy:preview`; production uses
`npm run docs:deploy:prod` from the approved SHA after release validation. See the
[Pages procedure](../doc_web_interne/docs/repository-operations.md#cloudflare-pages-httpsnoctaliaapp).

Commit source changes under `docs-src/`, `data/`, and the relevant generator or
configuration files. If `docs:build` updates a tracked manifest under `data/`,
commit that small manifest change too. Never force-add `docs/` or
`docs-src/static/version.txt`.

Deployment helper settings live in `docs-src/config/cloudflare-pages.json`.

### Build inputs and image reuse

The `buildWatchPaths` entry in that file describes the proposed Pages watch
rules. It is not automatically applied to Cloudflare by a Git push. Compare
and apply it separately when changing hosting settings is authorized; keep
the provider's existing branch and deployment settings unchanged. The rules
include all paths by default and exclude identified application-only and
internal documentation trees. Shared `data/`, all `scripts/`, root manifests,
Node configuration and unknown paths continue to trigger builds. A site
generator acquiring an input from an excluded tree requires updating these
rules in the same change.

Preview the result for a Git diff without changing Pages or cancelling CI:

```bash
npm run docs:build-impact -- --base <previous-sha> --head <new-sha>
```

The diagnostic includes both sides of moves, preserves shared inputs in mixed
changes and conservatively builds on an unusable diff or the provider's large
push fallbacks. A mobile-only change to a script in `package.json` still counts
as a build input; these rules do not attempt semantic manifest filtering.

SEO and responsive symbol images use content fingerprints instead of file
modification times. Their provenance files are
`docs-src/config/image-build-cache/seo.json` and `symbols.json`. After editing
sources, rendering recipes or generators, run `npm run docs:build` and
`npm run docs:check`, and include the updated provenance files and tracked image
derivatives in the change. Do not edit or seed fingerprints manually: an absent
or incompatible record intentionally rebuilds the image. Each record includes
the source/recipe/generator/toolchain fingerprint and the encoded output hash;
changed or missing outputs are regenerated even if their dates appear fresh.
The existing `--force` generator option bypasses reuse.

An unchanged fresh checkout can reuse the tracked derivatives when its Sharp
toolchain matches. An encoder version change intentionally invalidates them.
These files are generator inputs under `config/`, not public assets copied to
`docs/`. Keep them separate from the ignored generated HTML directory.

### Choose the right preview level

Use the smallest preview level that answers the current question:

| Command | Environment | External effect | Use |
| --- | --- | --- | --- |
| `npm run docs:dev` | Local live server | None | Default while editing. Rebuilds on source changes and resolves the site's clean URLs. |
| `npm run docs:preview:cf` | Local Wrangler server | None | Final local check of Cloudflare Pages routing, redirects, and headers. |
| `npm run docs:deploy:preview` | Remote Cloudflare Pages preview | Publishes a public preview | Cross-browser and click-through QA on Cloudflare before publication. |
| `npm run docs:deploy:prod` | Production Cloudflare Pages deployment | Publishes production | Manual production publish after thanh authorizes it and release proof passes. Requires `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`. |

`docs:preview:cf` serves the existing generated output, so build and validate it
first:

```bash
npm run docs:build
npm run docs:check
npm run docs:preview:cf
```

Open the local URL printed by Wrangler. This command does not upload the site and
does not require a Cloudflare login.

### Remote preview before publication

As verified on 2026-07-23, a remote preview of this static site is covered by the
Cloudflare Pages Free plan. The generated site contains no Pages Functions, and
[static asset requests are free and unlimited](https://developers.cloudflare.com/pages/functions/pricing/).
The Free plan currently documents 500 builds per month, 20,000 files per site,
a 25 MiB per-file limit, and
[unlimited active preview deployments](https://developers.cloudflare.com/pages/platform/limits/).
Recheck those official limits if Pages Functions, Workers, storage, or another
paid Cloudflare product is added later.

Remote preview URLs are public by default. Never use them for confidential or
unreleased sensitive content.

With explicit preview-publication intent and an authenticated Wrangler session,
upload the already-configured preview branch:

```bash
npm run docs:deploy:preview
```

The helper runs `docs:build` and `docs:check`, copies only allowlisted runtime
files to a temporary directory, and uploads that directory to the `noctalia`
Pages project with `--branch preview`. It does not update `noctalia.app` or the
production `master` deployment. Cloudflare returns:

- an immutable URL such as `<hash>.noctalia.pages.dev`, which should be recorded
  as QA evidence;
- the moving branch alias `preview.noctalia.pages.dev`, which points to the
  latest upload on the `preview` branch.

Cloudflare also adds `X-Robots-Tag: noindex` to preview deployments by default.
Confirm it on the immutable URL:

```bash
curl -I https://<hash>.noctalia.pages.dev
```

Before production, test the immutable preview URL by clicking through the shared
header, footer, and CTA links in every supported locale. Reload at least one
nested clean URL directly, verify that localized links stay in the selected
locale, and confirm that the response includes `x-robots-tag: noindex`. Preview
deployments do not affect custom domains, as documented in Cloudflare's
[preview deployment guide](https://developers.cloudflare.com/pages/configuration/preview-deployments/).

Do not use `docs:deploy:prod` for preview QA. Upload production manually only
when publication is explicitly requested:

```bash
npm run docs:deploy:prod
```

`docs:deploy:prod` is the manual production publish. It first runs the publish
guard (`scripts/check-site-publish-proof.mjs`): it refuses unless `HEAD` is
`origin/master` after `git fetch`, the checkout is clean, and
`npm run verify:release:site` (or `npm run verify:release`) passed on that
`master` SHA. There is no override. It
then runs `docs:release-check` and uploads an allowlisted directory with
`wrangler pages deploy --project-name noctalia --branch master --commit-hash <HEAD>`.
Right before the upload it fetches and runs every check again, and must
accept the same `HEAD`, which labels the upload. Run `npm run verify:release:site`
first, from a clean checkout of the approved `master` SHA: it leaves out the
app checks (`build:web`, the native backend journey, the TesterArmy app
campaigns), which the static site does not ship. `docs:deploy:preview`
is not guarded, but accepts only the exact preview branch `preview` (compared
byte for byte) and refuses any other value. The token and account
id stay in the environment (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`).
If the Cloudflare Pages project or build settings change, update
`docs-src/config/cloudflare-pages.json` and mirror the same values in the
Cloudflare dashboard.

External link validation remains enabled during publication. After bounded retries,
HTTP 502/503/504 from third-party sites are reported with their URL and status as
non-blocking availability warnings, not as validated links. Broken internal links,
missing external pages (404/410), and other HTTP failures still block publication.
This avoids making a release depend on a third-party maintenance window.

## Source Templates

- `templates/blog-article.example.md`: starting point for a localized blog article.
- `templates/page.example.md`: starting point for a managed static page.
- `templates/front-matter.example.json`: copyable front matter shape for new content.

## Landing experience layer

The landing pages (`layout: "landing"`) ship an adaptive visual layer on top of
the static HTML. Content, SEO, and conversion markup are identical for every
visitor; only the visual layer changes.

Three tiers, decided by a synchronous inline `<script>` in the `<head>`
(source: `scripts/lib/experience-tier.js`, unit-tested) and exposed as
`html[data-exp-tier]`:

- `full` (recent desktops): canvas sky (2D canvas stars/nebula/moon plus an
  occasional shooting star, pixel ratio <= 1.5), Lenis + GSAP/ScrollTrigger
  scenes, magnetic buttons.
- `light` (mobiles, older laptops): simplified canvas sky (fewer stars, pixel
  ratio 1), Lenis, IntersectionObserver reveals.
- `static` (`prefers-reduced-motion`, save-data, very weak hardware): no
  libraries at all; CSS fallbacks in `static/css/experience.css` keep content
  visible and add scroll-driven effects where supported.

Runtime guards: the sky chunk is a dynamic import that only loads after the
LCP; rendering is capped at 30 fps and pauses when the hero leaves the
viewport or the tab is hidden; an FPS watchdog halves the stars and pins the
pixel ratio, then kills the sky and falls back to CSS. Cross-document view transitions stay disabled on
purpose (`scripts/lib/docs-view-transitions.js`): an aborted transition can
leave Chrome stuck in a washed-out composited state.

The layer is bundled from `docs-src/experience/` into
`static/js/experience/` by esbuild (code-split chunks):

```bash
npm run docs:build:experience
```

`docs:build` runs this step automatically before computing the asset version
hash. Edit sources in `docs-src/experience/`, never the bundled output. The
hero LCP image and `observatory.css` remain the static baseline: the sky
canvas is an additive layer above them and must never replace them.

Landing pages load two stylesheets: the shared `styles.min.css` and
`css/landing.css`, which `docs:build` generates from `language-dropdown.css`,
`observatory.css` and `experience.css` in that order
(`scripts/lib/landing-stylesheet.js`). Edit those three source files, never
the generated bundle.

## Consent-gated analytics

`static/js/site-shell.js` contains the shared Microsoft Clarity consent control.
It is inert by default and never loads Clarity until the visitor explicitly allows
analytics. The localized control stores a granted or denied choice in local storage
for at most 180 days, respects Global Privacy Control, and remains available from
the footer so the visitor can change the choice. Advertising storage is always
denied. A separate consent UI or CMP can use the same bridge with:

```js
window.NoctaliaAnalyticsConsent.update(true);
```

or by dispatching `noctalia:analytics-consent` with
`detail: { analytics: true }`. Pass `false` when consent is refused or withdrawn.
The bridge loads Clarity asynchronously once and removes a blocked loader so a
later opt-in can retry. The caller is responsible for persisting any choice made
outside the built-in control before calling `update(true)` or `update(false)`.
