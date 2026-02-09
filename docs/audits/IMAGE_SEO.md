# Image SEO --- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green --- Image implementation is modern and well-optimized with WebP, responsive srcset, lazy loading, and descriptive alt text across all pages.

| Metric | Value |
|--------|-------|
| Blog featured image format | WebP (e.g. `/img/blog/snake-dreams-meaning.webp`) |
| OG image format | JPG (`/img/og/noctalia-en-1200x630.jpg`) |
| OG image dimensions | 1200x630 consistently |
| Pages with og:image:width/height | **106/106 per language (100%)** -- Fixed 2026-02-09 |
| Pages missing og:image:width/height | **0** (was ~10 per language) |
| Blog images with srcset | 23 blog articles (all articles) |
| Images with loading="lazy" | 27 per language (blog index thumbnails + homepage) |
| Images with loading="eager" | 23 per language (blog featured images, above the fold) |
| Blog featured images preloaded | Yes, via `<link rel="preload" as="image" type="image/webp">` |
| AVIF usage | None detected |
| Empty alt attributes | 0 detected (no `alt=""` found in EN pages) |
| Favicon formats | SVG primary, ICO fallback, PNG for Apple touch icon |

## Current State

### Image Formats
- Blog featured images use **WebP** format exclusively, which is the modern standard for web images. Example: `/img/blog/snake-dreams-meaning.webp`
- OG images for social sharing use **JPG** format (`/img/og/noctalia-en-1200x630.jpg`), which is the standard expected by social platforms
- Favicon stack is comprehensive: SVG primary (`/favicon.svg`), ICO fallback (`/favicon.ico` with multiple sizes), PNG for Apple touch icon (`/logo192.png`)

### Alt Text
- Blog featured images have descriptive, meaningful alt text. Example from `snake-dreams-meaning.html`:
  ```html
  alt="Artistic depiction of a snake, representing ancient wisdom or transformation"
  ```
- Symbol pages use the page title as alt text for og:image:alt. Example: `alt="Snake Dream Meaning: What Does It Mean to Dream About Snake?"`
- No empty `alt=""` attributes were found in the English pages, indicating decorative elements are handled via CSS or Lucide icon library (`data-lucide` attributes) rather than `<img>` tags

### Responsive Images
- All 23 blog articles include `srcset` with three breakpoints (480w, 800w, 1200w) plus a `sizes` attribute:
  ```html
  srcset="../../img/blog/snake-dreams-meaning-480w.webp 480w,
          ../../img/blog/snake-dreams-meaning-800w.webp 800w,
          ../../img/blog/snake-dreams-meaning-1200w.webp 1200w"
  sizes="(max-width: 768px) 100vw, 1200px"
  ```
- This was added systematically via `scripts/add-blog-srcset.js`

### Loading Strategy
- Blog featured images correctly use `loading="eager"` with `fetchpriority="high"` for above-the-fold content (23 blog articles)
- Blog index page uses `loading="lazy"` for thumbnail grid (22 lazy images on blog index)
- Homepage uses `loading="lazy"` for below-fold screenshots (5 lazy images)
- Blog featured images are also preloaded in `<head>`:
  ```html
  <link as="image" href="/img/blog/snake-dreams-meaning.webp" rel="preload" type="image/webp">
  ```

### OG Image Metadata
- 96 out of 106 English pages include `og:image:width` (1200) and `og:image:height` (630)
- All pages include `og:image:alt` text
- Twitter card images mirror OG images consistently

### Decorative Elements
- Background effects (aurora-bg, orbs, noise-overlay) are implemented as CSS elements, not `<img>` tags --- this is the correct approach and does not impact image SEO

## Issues & Gaps

### P0 --- Critical

None identified.

### P1 --- High Priority

~~1. **~10 pages per language missing og:image:width/height**~~ -- **RESOLVED** (2026-02-09, commit `bd2acb0`). Added `og:image:width="1200"` and `og:image:height="630"` to all 50 pages (10 per language) via `scripts/fix-p1-seo.js`. Coverage now 100%.

### P2 --- Optimization

1. **No AVIF format support**: All images use WebP only. While WebP is well-supported, AVIF offers 20-30% better compression. No `<picture>` elements with AVIF source fallback were detected anywhere on the site.

2. **No explicit width/height on all img tags**: While blog featured images include `width="1200" height="630"` attributes (preventing CLS), verify that all homepage screenshot images and blog index thumbnails also include explicit dimensions to prevent Cumulative Layout Shift.

~~3. **Consider adding og:image:alt to pages that have it missing**~~ -- twitter:image:alt now at 100% coverage (fixed 2026-02-09).

## Recommendations

1. **Add og:image:width and og:image:height to the ~10 missing pages per language.** These are the homepage, about, legal notice, privacy policy, terms, and account deletion pages. Since the OG image is consistently `1200x630`, add:
   ```html
   <meta property="og:image:width" content="1200">
   <meta property="og:image:height" content="630">
   ```

2. **Consider AVIF support for blog featured images.** Wrap existing `<img>` tags in `<picture>` elements with an AVIF source and WebP fallback. This can save 20-30% bandwidth for browsers that support AVIF (Chrome, Firefox, Safari 16+).

3. **Audit all img tags for explicit width/height attributes** to prevent CLS. Blog featured images already have them; ensure homepage screenshots and blog index thumbnails also include them.

4. **Verify the ~51 "missing alt" flags per language** (if flagged by automated tools) are Lucide icon elements (`data-lucide`) rather than actual `<img>` tags. These are SVG icons rendered by JavaScript and do not need alt text.

## Validation Commands

```bash
# Count pages with og:image:width in EN
grep -rl "og:image:width" docs/en/ | wc -l
# Expected: 96

# Count pages WITHOUT og:image:width in EN
find docs/en/ -name "*.html" | while read f; do grep -qL "og:image:width" "$f" && echo "$f"; done

# Check all blog featured images have srcset
grep -c "srcset" docs/en/blog/*.html

# Verify no empty alt attributes
grep -r 'alt=""' docs/en/ --include="*.html" | wc -l
# Expected: 0

# Check for AVIF usage
grep -r "avif\|AVIF" docs/ --include="*.html" | wc -l
# Expected: 0

# Count loading="eager" images in blog articles
grep -c 'loading="eager"' docs/en/blog/*.html

# Verify blog featured images are preloaded
grep -c 'rel="preload" as="image"' docs/en/blog/*.html
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `en/index.html` | Homepage | Missing og:image:width/height; has srcset for screenshots; lazy loading correct |
| `en/blog/snake-dreams-meaning.html` | Blog article | Full compliance: WebP, srcset (480/800/1200w), loading="eager", preloaded, descriptive alt, og:image dimensions present |
| `en/blog/index.html` | Blog index | 22 lazy-loaded thumbnails, 1 eager image, srcset on all cards |
| `en/symbols/snake.html` | Symbol page | og:image:width/height present, no inline images (content is text-based) |
| `en/about.html` | Utility page | Missing og:image:width/height; no inline images |
| `en/legal-notice.html` | Legal page | Missing og:image:width/height; no inline images |
| `en/terms.html` | Legal page | Missing og:image:width/height; no inline images |
| `en/guides/most-common-dream-symbols.html` | Guide page | og:image dimensions present, no inline images |
| `en/blog/dream-incubation-guide.html` | Blog article | Full compliance: WebP srcset, eager loading, preloaded, descriptive alt |
| `fr/blog/reves-de-serpents.html` | Blog (FR) | Mirrors EN implementation: WebP srcset, eager loading, preloaded |
