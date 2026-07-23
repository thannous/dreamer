## Docs Source

`docs-src/` is the editable source for the static marketing site.

- `config/`: global site configuration and routed static pages.
- `content/`: editable source content for managed pages and blog articles.
- `locales/`: shared UI strings for navigation, footer, and legal labels.
- `static/`: build-owned static files copied into `docs/`.
- `templates/`: shared HTML shells used by the renderer.

`docs/` is generated output. It is ignored by Git, should never be edited
manually, and is rebuilt locally or by Cloudflare Pages from the tracked sources.

The canonical symbol catalogs shared by the app and the site are
`data/dream-symbols.json`, `data/dream-symbols-extended.json`, and
`data/dream-symbols-extended-tier3.json`. Edit those files only. The docs build
copies all three into `docs/data/` after static assets, and `docs:check` verifies
that the published copies are byte-for-byte identical to the canonical data.

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

### Preview and publish on Cloudflare Pages

Production is deployed by the Cloudflare Pages Git integration from the `master`
branch. Cloudflare checks out the tracked sources, rebuilds `docs/`, validates the
result, then uploads that generated directory. Generated HTML is not stored in Git.

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

A commit on another branch may create a Cloudflare Preview deployment, but it does
not update `noctalia.app`. A commit on `master` triggers the production build.

Commit source changes under `docs-src/`, `data/`, and the relevant generator or
configuration files. If `docs:build` updates a tracked manifest under `data/`,
commit that small manifest change too. Never force-add `docs/` or
`docs-src/static/version.txt`.

Deployment helper settings live in `docs-src/config/cloudflare-pages.json`.

### Choose the right preview level

Use the smallest preview level that answers the current question:

| Command | Environment | External effect | Use |
| --- | --- | --- | --- |
| `npm run docs:dev` | Local live server | None | Default while editing. Rebuilds on source changes and resolves the site's clean URLs. |
| `npm run docs:preview:cf` | Local Wrangler server | None | Final local check of Cloudflare Pages routing, redirects, and headers. |
| `npm run docs:deploy:preview` | Remote Cloudflare Pages preview | Publishes a public preview | Cross-browser and click-through QA on Cloudflare before publication. |
| `npm run docs:deploy:prod` | Production Cloudflare Pages deployment | Publishes production | Manual production fallback only, with explicit publication intent. |

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

`docs:deploy:prod` is a manual fallback that runs `docs:release-check` before a
direct upload. It does not require a Git commit, so use it only with explicit
publication intent and record the corresponding source change in Git afterward.
If the Cloudflare Pages project or build settings change, update
`docs-src/config/cloudflare-pages.json` and mirror the same values in the
Cloudflare dashboard.

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
