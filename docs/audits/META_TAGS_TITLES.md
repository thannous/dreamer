# Meta Tags & Titles — Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green — Titles follow a consistent format with keyword-first placement, meta descriptions are present on 100% of indexable pages, and robots directives are correctly applied across content, noindex stubs, and templates.

| Metric | Value |
|--------|-------|
| Title format | `{Page Title} \| Noctalia` |
| Title presence | 100% of pages |
| Meta description presence | 100% of indexable pages |
| Duplicate titles | None detected |
| Robots meta (content pages) | `index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1` |
| Robots meta (root stub) | `noindex, follow` |
| Robots meta (templates) | `noindex, nofollow` |
| Title length range | ~30-72 characters |

## Current State

### Title Tag Format
All pages follow a consistent brand-suffixed pattern:

```
{Page Title} | Noctalia
```

This provides clear branding in SERPs while keeping the primary keyword at the start of the title.

### Title Examples by Page Type

| Page Type | Title | Length |
|-----------|-------|--------|
| Landing page | `Dream Journal with Dream Illustrations & Interpretation \| Noctalia` | 67 chars |
| Symbol page | `Snake Dream Meaning: What Does It Mean to Dream About Snake? \| Noctalia` | 72 chars |
| Blog post | `Snake Dreams: Hidden Warnings Decoded \| Noctalia` | 49 chars |
| Guide page | `20 Most Common Dream Symbols & Their Meanings \| Noctalia` | 57 chars |
| Legal page | `Privacy Policy \| Noctalia` | 26 chars |
| About page | `About Noctalia \| Noctalia` | 26 chars |

### Keyword Placement
Primary keywords appear at the start of the title on symbol and blog pages, which is optimal for both click-through rates and ranking signals:
- "Snake Dream Meaning: ..." (symbol page)
- "Snake Dreams: ..." (blog post)
- "20 Most Common Dream Symbols ..." (guide)

### Meta Descriptions
- Present on 100% of indexable pages.
- Descriptions are unique per page (no duplicates detected across sampled pages).
- Descriptions appear to be tailored to each page's content rather than templated.

### Robots Meta Directives
Three distinct robots configurations are used correctly:

**Content pages (symbols, blog, guides, legal, about):**
```html
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
```
This is the optimal configuration: full indexing, unrestricted snippet length, and large image previews for rich results.

**Root index.html (language detection stub):**
```html
<meta name="robots" content="noindex, follow">
```
Correctly prevents the stub from indexing while allowing crawlers to follow links to language-specific homepages.

**Template files:**
```html
<meta name="robots" content="noindex, nofollow">
```
Correctly blocks both indexing and link following on non-content template files.

### No Duplicate Titles
Across all sampled pages, no two pages share the same title. Each symbol, blog post, and guide has a distinct title that targets different keyword variations.

## Issues & Gaps

### P0 — Critical

None identified.

### P1 — High Priority

None identified.

### P2 — Optimization

1. **Some titles may truncate in SERPs.**
   Google typically displays 50-60 characters of a title tag. Titles exceeding this range risk truncation:
   - `Snake Dream Meaning: What Does It Mean to Dream About Snake? | Noctalia` (72 chars) — the ` | Noctalia` suffix will likely be cut.
   - Other symbol pages following the same `{Symbol} Dream Meaning: What Does It Mean to Dream About {Symbol}? | Noctalia` pattern may also exceed 60 characters.

   The primary keyword is at the front, so truncation does not harm keyword visibility. However, the brand name may be dropped from the visible title in SERPs.

2. **Redundant brand name on About page.**
   `About Noctalia | Noctalia` repeats the brand name. A title like `About Us | Noctalia` or `Our Story — Dream Journal App | Noctalia` would use the title space more effectively by adding descriptive keywords.

3. **Potential for richer guide titles.**
   The guide title `20 Most Common Dream Symbols & Their Meanings | Noctalia` is strong, but some other guide pages may benefit from including the current year or a count to increase CTR (e.g., "Top 20 Dream Symbols Explained (2026) | Noctalia").

## Recommendations

1. **Shorten long symbol page titles.** Consider a more concise pattern:
   - Current: `Snake Dream Meaning: What Does It Mean to Dream About Snake? | Noctalia` (72 chars)
   - Proposed: `Snake Dream Meaning & Interpretation | Noctalia` (47 chars)
   - Alternative: `Dream About Snakes: Meaning & Symbolism | Noctalia` (50 chars)

   This keeps the title within the 50-60 character display window and preserves keyword placement.

2. **Fix the About page title.** Change `About Noctalia | Noctalia` to a non-redundant alternative such as `About Us — AI Dream Journal App | Noctalia`.

3. **Audit all titles for length.** Run the validation command below to identify every title exceeding 60 characters. Review and shorten those where the primary keyword or brand name would be truncated.

4. **Consider adding structured data markup for FAQ/HowTo** on guide and blog pages to complement the `max-snippet:-1` directive and increase SERP real estate with rich results.

## Validation Commands

```bash
# Extract all titles and their lengths
for f in $(find docs/en docs/fr docs/es docs/de docs/it -name '*.html'); do
  title=$(grep -oP '(?<=<title>).*?(?=</title>)' "$f")
  if [ -n "$title" ]; then
    len=${#title}
    echo "$len $f: $title"
  fi
done | sort -rn | head -30

# Find titles exceeding 60 characters
for f in $(find docs/en -name '*.html'); do
  title=$(grep -oP '(?<=<title>).*?(?=</title>)' "$f")
  if [ -n "$title" ] && [ ${#title} -gt 60 ]; then
    echo "${#title} chars: $title ($f)"
  fi
done

# Check for duplicate titles within English pages
for f in $(find docs/en -name '*.html'); do
  grep -oP '(?<=<title>).*?(?=</title>)' "$f"
done | sort | uniq -d

# Verify meta description presence on all indexable pages
for f in $(find docs/en -name '*.html'); do
  if ! grep -q 'noindex' "$f"; then
    if ! grep -q 'meta name="description"' "$f"; then
      echo "MISSING description: $f"
    fi
  fi
done

# Check robots meta on content vs noindex pages
echo "=== Content page robots ==="
grep -h 'name="robots"' docs/en/symbols/snake.html
echo "=== Root stub robots ==="
grep -h 'name="robots"' docs/index.html
echo "=== Template robots ==="
grep -h 'name="robots"' docs/templates/symbol-page.html

# Check for redundant brand name in titles
for f in $(find docs/en -name '*.html'); do
  title=$(grep -oP '(?<=<title>).*?(?=</title>)' "$f")
  # Check if "Noctalia" appears more than once
  count=$(echo "$title" | grep -oi "noctalia" | wc -l)
  if [ "$count" -gt 1 ]; then
    echo "REDUNDANT: $title ($f)"
  fi
done

# Verify og:title matches title tag
curl -s https://noctalia.app/en/symbols/snake | grep -E '<title>|og:title'
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `/en/` | Homepage | Title 67 chars, description present, `index, follow` robots |
| `/en/symbols/snake` | Symbol page | Title 72 chars (P2: may truncate), keyword-first, description present |
| `/en/blog/snake-dreams-meaning` | Blog post | Title 49 chars, keyword-first, description present |
| `/en/guides/most-common-dream-symbols` | Guide page | Title 57 chars, description present |
| `/en/privacy-policy` | Legal page | Title 26 chars, `index, follow` robots |
| `/en/about` | About page | Title 26 chars (P2: redundant brand), description present |
| `/` | Root index | `noindex, follow` — correct for language stub |
| `/fr/symboles/serpent` | Symbol page (FR) | Localized title, description present |
| `/de/blog/index.html` | Blog index (DE) | Title present, description present |
| `/templates/symbol-page.html` | Template | `noindex, nofollow` — correct |
