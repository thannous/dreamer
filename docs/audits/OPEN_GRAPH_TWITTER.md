# Open Graph & Twitter Cards -- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green (borderline Yellow) -- Strong OG/Twitter coverage with minor locale:alternate gaps on some blog articles.

| Metric | Value |
|--------|-------|
| og:image coverage | 100% (all 530 pages) |
| og:image:width/height coverage | 91% (96/106 per language; ~480/530 total) |
| og:locale correctness | 100% on pages that include it |
| og:locale:alternate completeness | ~95% (some blog articles list only 2 of 4 alternates) |
| twitter:card coverage | 100% (summary_large_image on all pages) |
| twitter:site coverage | 100% (@NoctaliaDreams) |
| og:site_name coverage | ~1% (only landing pages) |

## Current State

### og:type -- Correct Usage
- Landing, category, legal, about, and blog index pages use `og:type="website"` appropriately.
- Blog articles use `og:type="article"` with `article:published_time`, `article:modified_time`, and `article:author="Noctalia"`.
- Symbol pages use `og:type="article"` with dates and author, which is acceptable for reference content.
- Hub pages (dream-journal.html, dream-meanings.html, lucid-dreaming.html) correctly use `og:type="website"`.

### og:title -- Mirrors page title
- Blog articles: og:title omits the "| Noctalia" suffix from `<title>` (e.g., `<title>Snake Dreams: Hidden Warnings Decoded | Noctalia</title>` vs `og:title="Snake Dreams: Hidden Warnings Decoded"`). This is correct practice.
- Symbol pages: og:title matches `<title>` exactly (including "| Noctalia" suffix).
- Landing/legal pages: og:title matches `<title>` exactly.

### og:description -- Present everywhere
- Blog articles use a shorter, punchier og:description compared to meta description (e.g., "Decode whether snake dreams symbolize healing, danger, or transformation." vs the longer meta description). Good practice for social sharing.
- Symbol, guide, category, and legal pages use the same text for both og:description and meta description.

### og:url -- Matches canonical
- Verified on all sampled pages: og:url matches `<link rel="canonical">` exactly.

### og:image -- 100% coverage
- Blog articles use unique images: `/img/blog/{slug}.webp` (e.g., `/img/blog/snake-dreams-meaning.webp`).
- All other pages use the generic OG image: `/img/og/noctalia-{lang}-1200x630.jpg` (one per language).
- Images are hosted on the same domain (noctalia.app).

### og:image:width & og:image:height -- 91% coverage
- Present on 96 of 106 EN pages (all symbols, guides, blog articles, blog index, category pages).
- **Missing on 10 pages:** landing page (en/index.html), about page, privacy policy, terms, legal notice, account deletion, and hub pages (dream-journal.html, dream-meanings.html, lucid-dreaming.html). These pages also lack og:image:alt.

### og:image:alt
- Present on all symbol pages (uses the symbol page title as alt text).
- Present on all blog articles (uses descriptive alt text, e.g., "Artistic depiction of a snake, representing ancient wisdom or transformation").
- Present on guide pages and category pages.
- **Missing on:** landing page, about page, privacy policy, terms, legal notice, account deletion.

### og:locale -- Correct mapping
- `en_US` for English, `fr_FR` for French, `es_ES` for Spanish, `de_DE` for German, `it_IT` for Italian.
- Present on all pages.

### og:locale:alternate -- Mostly complete
- Symbol pages, guide pages, and category pages: all 4 alternates present (fr_FR, es_ES, de_DE, it_IT).
- Landing pages, legal pages, about pages: all 4 alternates present.
- **Blog articles: inconsistent.** Example: `en/blog/snake-dreams-meaning.html` lists only `fr_FR` and `es_ES` as og:locale:alternate -- missing `de_DE` and `it_IT`. This pattern is confirmed across multiple blog articles.
- Blog index page (en/blog/index.html): **missing all og:locale:alternate tags entirely**.

### og:site_name -- Sparse
- Present only on the landing page (`en/index.html`): `og:site_name="Noctalia"`.
- Missing on all blog articles, symbol pages, guide pages, category pages, and legal pages.

### article:published_time & article:modified_time
- Present on all blog articles (e.g., `2025-12-11` / `2026-01-06` on snake-dreams-meaning).
- Present on all symbol pages (e.g., `2025-01-21` / `2026-01-22` on snake symbol).
- Present on guide and category pages.
- Not present on landing, legal, or about pages (correct -- not articles).

### article:author
- "Noctalia" on all article-type pages. Consistent.

### Twitter Cards
- `twitter:card="summary_large_image"` on all 530 pages.
- `twitter:site="@NoctaliaDreams"` on all 530 pages.
- `twitter:title` and `twitter:description` present on all pages.
- `twitter:image` present on all pages (matches og:image).
- `twitter:image:alt` present on blog articles, symbol pages, guide pages, and category pages. **Missing on** landing page, about page, privacy policy, terms, legal notice, account deletion.

## Issues & Gaps

### P0 -- Critical
None identified.

### P1 -- High Priority

1. **~50 pages missing og:image:width/height** (10 per language). Pages affected per language: landing page, about, privacy policy, terms, legal notice, account deletion, and 3 blog hub pages (dream-journal, dream-meanings, lucid-dreaming). Social platforms may render thumbnails incorrectly without explicit dimensions.
   - Example: `en/index.html` has `og:image` but no `og:image:width` or `og:image:height`.
   - Example: `en/privacy-policy.html` -- same issue.

2. **Blog articles missing de_DE and it_IT from og:locale:alternate** (~22 blog articles x 5 languages = ~110 pages affected). Only `fr_FR` and `es_ES` are listed. This means social platforms in Germany and Italy may not surface the localized version.
   - Verified on: `en/blog/snake-dreams-meaning.html` (lines 26-27: only fr_FR, es_ES).
   - Blog index page (`en/blog/index.html`) has **zero** og:locale:alternate tags.

### P2 -- Optimization

1. **og:site_name not consistently present.** Only the landing page has it. Adding `og:site_name="Noctalia"` to all pages would improve brand attribution in social cards.

2. **og:image:alt and twitter:image:alt missing on ~30 pages** (landing, about, legal pages across 5 languages). Not critical since these pages use a generic OG image, but adding alt text improves accessibility of social shares.

3. **Blog articles use relative image paths in srcset** (e.g., `../../img/blog/snake-dreams-meaning.webp`) while og:image uses absolute URLs. Functional but inconsistent.

## Recommendations

1. **Add og:image:width="1200" and og:image:height="630"** to the 10 pages per language that are missing them. All OG images are 1200x630, so this is a simple template addition.

2. **Add de_DE and it_IT to og:locale:alternate** on all blog articles. The hreflang alternate links are already correct (de and it hreflangs are present), so the og:locale:alternate tags just need to match.

3. **Add og:locale:alternate tags** to the blog index page (en/blog/index.html and equivalents).

4. **Add og:site_name="Noctalia"** to all pages site-wide.

5. **Add og:image:alt and twitter:image:alt** to the ~30 pages currently missing them (landing, about, legal pages). Use the page title or a standard description like "Noctalia - Dream Journal App".

## Validation Commands

```bash
# Count pages missing og:image:width in English
grep -rL "og:image:width" docs/en/*.html docs/en/blog/*.html docs/en/symbols/*.html docs/en/guides/*.html 2>/dev/null | wc -l

# Check which EN pages are missing og:image:width
grep -rL "og:image:width" docs/en/*.html docs/en/blog/*.html docs/en/symbols/*.html docs/en/guides/*.html 2>/dev/null

# Verify og:locale:alternate on a blog article
grep "og:locale:alternate" docs/en/blog/snake-dreams-meaning.html

# Count pages with og:site_name
grep -rl "og:site_name" docs/en/ | wc -l

# Verify twitter:image:alt presence on landing page
grep "twitter:image:alt" docs/en/index.html

# Check blog index for og:locale:alternate
grep "og:locale:alternate" docs/en/blog/index.html
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| en/index.html | Landing | Missing og:image:width/height, og:image:alt, twitter:image:alt |
| en/blog/snake-dreams-meaning.html | Blog article | Missing de_DE/it_IT locale:alternate, missing og:site_name |
| en/symbols/snake.html | Symbol page | Full OG + Twitter coverage. All 4 locale:alternates present. |
| en/symbols/animals.html | Category page | Full OG + Twitter coverage. All 4 locale:alternates present. |
| en/guides/most-common-dream-symbols.html | Guide page | Full OG + Twitter coverage. All 4 locale:alternates present. |
| en/blog/index.html | Blog index | Missing all og:locale:alternate tags. Has og:image:width/height. |
| en/privacy-policy.html | Legal page | Missing og:image:width/height, og:image:alt, og:site_name |
| en/about.html | About page | Missing og:image:width/height, og:image:alt, twitter:image:alt |
| en/blog/dream-journal.html | Blog hub | Missing og:image:width/height, rel="prev"/"next" |
| en/blog/dream-meanings.html | Blog hub | Missing og:image:width/height, rel="prev"/"next" |
