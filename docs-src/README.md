## Docs Source

`docs-src/` is the editable source for the static marketing site.

- `config/`: global site configuration and routed static pages.
- `content/`: editable source content for managed pages and blog articles.
- `locales/`: shared UI strings for navigation, footer, and legal labels.
- `static/`: build-owned static files copied into `docs/`.
- `templates/`: shared HTML shells used by the renderer.

`docs/` is generated output. It is ignored by Git, should never be edited
manually, and is rebuilt locally or by Cloudflare Pages from the tracked sources.

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

Run a Cloudflare-compatible local preview:

```bash
npm run docs:preview:cf
```

Upload a preview deployment:

```bash
npm run docs:deploy:preview
```

Upload production manually:

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

- `full` (recent desktops): WebGL sky (three.js stars/nebula/moon + bloom),
  Lenis + GSAP/ScrollTrigger scenes, magnetic buttons.
- `light` (mobiles, older laptops): simplified WebGL sky (fewer particles, no
  bloom, pixel ratio <= 1.5), Lenis, IntersectionObserver reveals.
- `static` (`prefers-reduced-motion`, save-data, very weak hardware): no
  libraries at all; CSS fallbacks in `static/css/experience.css` keep content
  visible and add scroll-driven effects where supported.

Runtime guards: the three.js chunk is a dynamic import that only loads after
the LCP; the render loop pauses when the hero leaves the viewport or the tab
is hidden; an FPS watchdog degrades particles, then bloom, then kills WebGL
and falls back to CSS. Cross-document view transitions stay disabled on
purpose (`scripts/lib/docs-view-transitions.js`): an aborted transition can
leave Chrome stuck in a washed-out composited state.

The layer is bundled from `docs-src/experience/` into
`static/js/experience/` by esbuild (tree-shaken three.js, code-split chunks):

```bash
npm run docs:build:experience
```

`docs:build` runs this step automatically before computing the asset version
hash. Edit sources in `docs-src/experience/`, never the bundled output. The
hero LCP image and `observatory.css` remain the static baseline: the WebGL
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
