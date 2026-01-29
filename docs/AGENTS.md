# Docs Guidelines (Noctalia Static Site + pSEO)

This folder (`docs/`) is a static website that includes programmatic SEO pages for the Dream Symbols dictionary (EN/FR/ES).

## Project Structure

- `en/`, `fr/`, `es/`: Localized static site output (HTML files).
  - `*/symbols|symboles|simbolos/`: Symbol + category hub pages (generated).
  - `*/guides/`: Dictionary hub + curation guide pages (generated).
  - `*/blog/`: Blog pages (static HTML).
- `data/`: Source data for generation.
  - `data/dream-symbols.json`: Base symbol list (56 symbols currently).
  - `data/dream-symbols-extended.json`: Enriched per-symbol content (fullInterpretation + variations).
  - `data/curation-pages.json`: Curation guide definitions (8 guides).
  - `data/symbol-i18n.json`: i18n strings + meta templates + category slugs.
- `scripts/`: Generators / maintenance scripts.
  - `scripts/generate-symbol-pages.js`: Generates symbols, categories, and curation pages.
- `templates/`: Shared HTML templates/snippets used by the site.
- `sitemap.xml`: XML sitemap (keep consistent with generated output).
- `_redirects`, `_headers`: Hosting redirects/headers (clean URLs, legacy slugs).
- `version.txt`: Cache-busting version used by generators for `dateModified` + asset querystrings.

## pSEO Build / Update Commands

```bash
# Generate all symbol pages (EN/FR/ES)
node scripts/generate-symbol-pages.js

# Generate only category pages (8 categories × 3 languages)
node scripts/generate-symbol-pages.js --categories

# Generate only curation guide pages (8 guides × 3 languages)
node scripts/generate-symbol-pages.js --curation

# Limit scope
node scripts/generate-symbol-pages.js --lang=en
node scripts/generate-symbol-pages.js --priority=1
node scripts/generate-symbol-pages.js --dry-run
```

## Data / Content Workflow

- Update `data/dream-symbols.json` (base fields + slugs) and/or `data/dream-symbols-extended.json` (long-form interpretation + variations).
- Re-run generators (see commands above).
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

