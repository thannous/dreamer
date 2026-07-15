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
