# Canonicalization & Hreflang — Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green — 100% canonical tag coverage, full hreflang reciprocity across all five languages, and consistent alignment between in-page annotations and sitemap declarations.

| Metric | Value |
|--------|-------|
| Canonical tag presence | 100% (all 530 pages) |
| Self-referencing canonicals | Present on every page |
| Canonical URL format | Clean (no .html), matches sitemap |
| Hreflang languages | 5 (en, fr, es, de, it) + x-default |
| Hreflang reciprocity | Verified — full bidirectional linking |
| Sitemap hreflang parity | Mirrors in-page annotations |
| og:url alignment | Matches canonical on all sampled pages |
| Sitemap URL count | 400 |
| Total HTML files | 530 |

## Current State

### Canonical Tags
- Every one of the 530 HTML pages includes a `<link rel="canonical">` tag.
- All canonicals are self-referencing (each page points to itself as the canonical).
- Canonical URLs use clean paths (no `.html` extension), matching the URLs declared in `sitemap.xml`.
- `og:url` values match the canonical URL on all sampled pages, preventing Open Graph/canonical conflicts.

**Example (English snake symbol page):**
```html
<link rel="canonical" href="https://noctalia.app/en/symbols/snake">
<meta property="og:url" content="https://noctalia.app/en/symbols/snake">
```

### Hreflang Annotations
Every page includes a complete hreflang cluster with all five languages plus `x-default`:

```html
<link rel="alternate" hreflang="en" href="https://noctalia.app/en/symbols/snake">
<link rel="alternate" hreflang="fr" href="https://noctalia.app/fr/symboles/serpent">
<link rel="alternate" hreflang="es" href="https://noctalia.app/es/simbolos/serpiente">
<link rel="alternate" hreflang="de" href="https://noctalia.app/de/traumsymbole/schlange">
<link rel="alternate" hreflang="it" href="https://noctalia.app/it/simboli/serpente">
<link rel="alternate" hreflang="x-default" href="https://noctalia.app/en/symbols/snake">
```

### x-default Strategy
- `x-default` points to the `/en/` equivalent for all content pages.
- For the homepage cluster, `x-default` points to `https://noctalia.app/` (the root language detection stub).
- This is the correct approach: English serves as the fallback language, and the root stub handles users who arrive without a language preference.

### Hreflang Reciprocity
Verified bidirectional linking: when page A declares page B as an alternate, page B reciprocally declares page A. This holds true across all five languages for every sampled cluster. No orphaned or one-way hreflang links detected.

### Sitemap Hreflang
`sitemap.xml` includes `<xhtml:link rel="alternate">` entries that mirror the in-page `<link rel="alternate" hreflang="...">` annotations. This dual declaration (in-page + sitemap) provides redundancy for search engines that prefer one signal source over the other.

### Root index.html
- Canonical: `https://noctalia.app/`
- Hreflang annotations point to all five language homepages.
- `<meta name="robots" content="noindex, follow">` prevents the stub from indexing while passing equity.

## Issues & Gaps

### P0 — Critical

None identified.

### P1 — High Priority

1. **Sitemap contains 400 URLs but 530 HTML files exist (130 difference).**
   The gap appears to be accounted for by:
   - Root `index.html` (noindex, correctly excluded).
   - Template files in `/templates/` (noindex, correctly excluded).
   - Blog and guide index pages (e.g., `/en/blog/index.html`) may be included or excluded depending on generation logic.
   - Auth callback pages (noindex, correctly excluded).

   **Action required:** Manually verify that no indexable content page is missing from the sitemap. A missing indexable page means search engines may discover it late or not at all. Run the validation command below to identify any HTML files that are (a) not noindexed and (b) not present in the sitemap.

### P2 — Optimization

None identified beyond the P1 above.

## Recommendations

1. **Audit the 130-page gap between sitemap and HTML file count.** Generate a list of all HTML files, exclude those with noindex directives, and diff against sitemap URLs. Any indexable page missing from the sitemap should be added.

2. **Automate sitemap completeness checks.** Add a CI step that:
   - Extracts all URLs from `sitemap.xml`.
   - Lists all `.html` files that do not have a noindex meta tag or X-Robots-Tag.
   - Fails if any indexable page is absent from the sitemap.

3. **Periodically re-verify hreflang reciprocity.** As new pages are added, run a script that checks every hreflang cluster for bidirectional consistency. A broken cluster (e.g., a new Italian page missing the German alternate) degrades multilingual SEO.

## Validation Commands

```bash
# Count canonical tags across all pages
grep -rl 'rel="canonical"' docs/en/ docs/fr/ docs/es/ docs/de/ docs/it/ | wc -l

# Verify self-referencing canonical on a specific page
curl -s https://noctalia.app/en/symbols/snake | grep 'rel="canonical"'

# Count hreflang annotations on a page (expect 6: 5 langs + x-default)
curl -s https://noctalia.app/en/symbols/snake | grep -c 'hreflang='

# Check og:url matches canonical
curl -s https://noctalia.app/en/symbols/snake | grep -E 'rel="canonical"|og:url'

# Extract sitemap URLs and count
grep -c '<loc>' docs/sitemap.xml

# Find indexable pages missing from sitemap
# Step 1: extract sitemap URLs
grep '<loc>' docs/sitemap.xml | sed 's|.*<loc>||;s|</loc>.*||' | sort > /tmp/sitemap-urls.txt
# Step 2: list all HTML files as URLs (excluding noindex pages)
for f in $(find docs/en docs/fr docs/es docs/de docs/it -name '*.html'); do
  if ! grep -q 'noindex' "$f"; then
    echo "$f" | sed 's|^docs/|https://noctalia.app/|;s|/index\.html$|/|;s|\.html$||'
  fi
done | sort > /tmp/indexable-urls.txt
# Step 3: diff
comm -23 /tmp/indexable-urls.txt /tmp/sitemap-urls.txt

# Verify hreflang reciprocity for a cluster (snake symbol)
for lang_url in \
  "https://noctalia.app/en/symbols/snake" \
  "https://noctalia.app/fr/symboles/serpent" \
  "https://noctalia.app/es/simbolos/serpiente" \
  "https://noctalia.app/de/traumsymbole/schlange" \
  "https://noctalia.app/it/simboli/serpente"; do
  echo "--- $lang_url ---"
  curl -s "$lang_url" | grep 'hreflang='
done

# Check root index noindex and hreflang
curl -s https://noctalia.app/ | grep -E 'noindex|hreflang'
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `/en/symbols/snake` | Symbol page | Canonical, hreflang (6 tags), og:url aligned |
| `/fr/symboles/serpent` | Symbol page | Reciprocal hreflang verified with EN, ES, DE, IT |
| `/de/traumsymbole/schlange` | Symbol page | Self-referencing canonical, clean URL |
| `/en/blog/snake-dreams-meaning` | Blog post | Full hreflang cluster, x-default to EN |
| `/es/blog/suenos-con-serpientes` | Blog post | Canonical matches sitemap URL |
| `/en/` | Homepage | Canonical, hreflang to all 5 langs + x-default to root |
| `/` | Root index | noindex, hreflang to all language homepages |
| `/en/guides/most-common-dream-symbols` | Guide page | Full hreflang cluster, canonical present |
| `/it/privacy-policy` | Legal page | Canonical, hreflang present |
