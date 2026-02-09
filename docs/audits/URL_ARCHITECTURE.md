# URL Architecture — Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green — URL structure is clean, flat, consistent, and well-localized across all five languages with perfect page parity.

| Metric | Value |
|--------|-------|
| Total HTML pages | 530 (106 per language x 5) |
| Max URL depth | 3 levels (/{lang}/{section}/{slug}) |
| Clean URLs | Yes, .html stripped via 301 redirects |
| Language prefixes | en/, fr/, es/, de/, it/ |
| Slug localization | Symbols, guides, and blog slugs localized per language |
| Section path localization | Symbols and legal sections localized; blog path shared |
| Page parity | 106 pages per language — perfect 1:1 match |

## Current State

### URL Pattern
All content follows a flat, predictable structure:

```
/{lang}/{section}/{slug}
```

Examples:
- `/en/symbols/snake`
- `/fr/symboles/serpent`
- `/de/traumsymbole/schlange`
- `/es/simbolos/serpiente`
- `/it/simboli/serpente`

### Language Prefixes
Each language has a dedicated top-level directory:

| Language | Prefix |
|----------|--------|
| English | `en/` |
| French | `fr/` |
| Spanish | `es/` |
| German | `de/` |
| Italian | `it/` |

### Section Paths
Section directories are localized to match each language:

| Section | en | fr | es | de | it |
|---------|----|----|----|----|-----|
| Symbols | `symbols/` | `symboles/` | `simbolos/` | `traumsymbole/` | `simboli/` |
| Guides | `guides/` | `guides/` | `guides/` | `guides/` | `guides/` |
| Blog | `blog/` | `blog/` | `blog/` | `blog/` | `blog/` |

Blog paths use a consistent `blog/` directory across all languages, which simplifies management while still allowing localized slugs within the path.

### Slug Localization
Slugs are translated per language for both symbol and blog pages:

**Symbol example:**
| Language | URL |
|----------|-----|
| English | `/en/symbols/snake` |
| French | `/fr/symboles/serpent` |
| Spanish | `/es/simbolos/serpiente` |
| German | `/de/traumsymbole/schlange` |
| Italian | `/it/simboli/serpente` |

**Blog example:**
| Language | URL |
|----------|-----|
| English | `/en/blog/snake-dreams-meaning` |
| French | `/fr/blog/reves-de-serpents` |
| Spanish | `/es/blog/suenos-con-serpientes` |
| German | `/de/blog/traeume-von-schlangen-wovor-ihr-unterbewusstsein-sie-wirklich-warnt` |
| Italian | `/it/blog/sogni-sui-serpenti-cio-di-cui-il-tuo-subconscio-ti-sta-davvero-avvertendo` |

### Clean URLs
`.html` extensions are stripped via 301 redirects defined in `_redirects` and `vercel.json`. Crawlers and users see clean paths; the server resolves them to `.html` files internally via rewrites.

### Root Index
`index.html` at the domain root acts as a language detection stub. It carries `<meta name="robots" content="noindex, follow">`, correctly preventing it from competing with the localized homepages while still passing link equity through to them.

### Trailing Slashes
- Directory-level URLs use trailing slashes: `en/`, `en/blog/`
- Leaf pages do not: `en/symbols/snake`, `en/blog/snake-dreams-meaning`

### Hierarchy Depth
Maximum depth is 3 levels, which is ideal for crawl efficiency:

```
Level 1: /en/
Level 2: /en/symbols/
Level 3: /en/symbols/snake
```

### Page Parity
Each language contains exactly 106 HTML pages, totaling 530 across all five languages. No language is missing content that exists in another.

## Issues & Gaps

### P0 — Critical

None identified.

### P1 — High Priority

None identified.

### P2 — Optimization

1. **Inconsistent internal link format.**
   Some pages use relative links (`../symbols/snake`) while others use absolute paths (`/en/symbols/snake`). Both resolve correctly, but absolute paths are more robust against path changes and easier to audit programmatically. Standardizing on absolute paths would improve maintainability.

2. **Long German and Italian blog slugs.**
   Some localized blog slugs are very long (e.g., `/de/blog/traeume-von-schlangen-wovor-ihr-unterbewusstsein-sie-wirklich-warnt`). While not a ranking issue, shorter slugs improve shareability and readability in analytics. Consider abbreviating where possible without losing keyword value.

## Recommendations

1. **Standardize internal links to absolute paths.** Run a find-and-replace across all HTML files to convert relative links (`../`, `./`) to absolute paths starting with `/{lang}/`. This prevents breakage if URL depth changes and simplifies link auditing.

2. **Audit German and Italian blog slugs for length.** Identify slugs exceeding 60 characters and evaluate whether shorter alternatives preserve the target keyword. Implement 301 redirects from old slugs if any are changed.

3. **Add a CI check for page parity.** A simple script can count HTML files per language directory and fail if the counts diverge, catching accidental omissions during content updates.

## Validation Commands

```bash
# Count HTML files per language
for lang in en fr es de it; do
  echo "$lang: $(find docs/$lang -name '*.html' | wc -l) pages"
done

# Verify clean URL redirect (should return 301 to path without .html)
curl -sI https://noctalia.app/en/symbols/snake.html | grep -E "HTTP|Location"

# Check root index has noindex
curl -s https://noctalia.app/ | grep -i "noindex"

# Find relative links in HTML files
grep -rn 'href="\.\.' docs/en/ | head -20

# Find absolute links for comparison
grep -rn 'href="/en/' docs/en/ | head -20

# Identify longest slugs
find docs/ -name '*.html' -printf '%f\n' | sort -t. -k1 | awk '{ print length, $0 }' | sort -rn | head -20
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `/en/` | Homepage | Clean URL, language prefix, trailing slash |
| `/fr/symboles/serpent` | Symbol page | Localized section + slug, clean URL |
| `/de/blog/traeume-von-schlangen-wovor-ihr-unterbewusstsein-sie-wirklich-warnt` | Blog post | Localized slug (long but valid) |
| `/es/guides/simbolos-suenos-mas-comunes` | Guide page | Localized slug, 3-level depth |
| `/it/simboli/serpente` | Symbol page | Localized section + slug |
| `/` | Root index | noindex language detection stub |
| `/en/privacy-policy` | Legal page | Clean URL, not localized section path |
| `/en/blog/` | Blog index | Trailing slash, directory-level |
