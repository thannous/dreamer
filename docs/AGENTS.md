# Docs Guidelines (Noctalia Static Site + pSEO)

`docs/` is the generated static output for the marketing site.

Editable source now lives in `docs-src/`:

- `docs-src/content/`: source content for landing, legal pages, and blog.
- `docs-src/config/`: shared routing + site configuration.
- `docs-src/locales/`: shared nav/footer/legal UI strings.
- `docs-src/static/`: build-owned static files copied into `docs/`.

Do not edit generated HTML in `docs/` manually. Use `npm run docs:build` after source changes.

## Project Structure

- `en/`, `fr/`, `es/`, `de/`, `it/`: Localized static site output (HTML files).
  - `*/symbols|symboles|simbolos|traumsymbole|simboli/`: Symbol + category hub pages (generated).
  - `*/guides/`: Dictionary hub + curation guide pages (generated).
  - `*/blog/`: Blog pages generated from `docs-src/content/blog/`.
- `data/`: Source data for generation.
  - `data/dream-symbols.json`: Base symbol list (56 symbols currently).
  - `data/dream-symbols-extended.json`: Enriched per-symbol content (fullInterpretation + variations).
  - `data/curation-pages.json`: Curation guide definitions (8 guides).
  - `data/symbol-i18n.json`: i18n strings + meta templates + category slugs.
- `scripts/`: Generators / maintenance scripts.
  - `scripts/docs-build.js`: End-to-end docs build.
  - `scripts/docs-check.js`: Docs validation gate.
  - `scripts/generate-symbol-pages.js`: Generates symbols, categories, and curation pages.
- `templates/`: Legacy templates used by the symbol/guides generator.
- `sitemap.xml`: XML sitemap (keep consistent with generated output).
- `_redirects`, `_headers`: Hosting redirects/headers (clean URLs, legacy slugs).
- `version.txt`: Cache-busting version used by generators for `dateModified` + asset querystrings.

## pSEO Build / Update Commands

```bash
# Full docs build (source -> docs output)
npm run docs:build

# Validate generated docs
npm run docs:check

# Generate all symbol pages only
node docs/scripts/generate-symbol-pages.js

# Generate only category pages
node docs/scripts/generate-symbol-pages.js --categories

# Generate only curation guide pages
node docs/scripts/generate-symbol-pages.js --curation

# Limit scope
node docs/scripts/generate-symbol-pages.js --lang=en
node docs/scripts/generate-symbol-pages.js --priority=1
node docs/scripts/generate-symbol-pages.js --dry-run
```

## Data / Content Workflow

- Update shared layout/config in `docs-src/` for footer/header/meta changes.
- Update blog and static pages in `docs-src/content/`.
- Update `data/dream-symbols.json` (base fields + slugs) and/or `data/dream-symbols-extended.json` (long-form interpretation + variations).
- Re-run the docs build.
- Ensure `sitemap.xml` reflects the correct canonical URLs.
  - Site uses `/[lang]/guides/*` for guides in all languages (including ES).
  - Keep legacy redirects if URLs ever shipped under a different path segment (see `_redirects`).

## SEO Quality Bar (Programmatic Pages)

- Avoid thin/doorway pages: each symbol page should have substantial unique content (interpretation + contextual variations).
- Maintain clean internal linking:
  - Symbol pages link to category hubs.
  - Category hubs cross-link to relevant curation guides.
  - Curation guides link to symbols.
- Keep titles/meta/hreflang consistent across EN/FR/ES.

## Source of Truth

- Roadmap + remaining work: `REMAINING_WORK.md` (keep it aligned with current generated output and `sitemap.xml`).

