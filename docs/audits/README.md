# SEO Audits — Noctalia Docs Site

**Date:** 2026-02-09 | **Domain:** noctalia.app | **Pages:** 530 (5 languages × 106 pages)

This directory contains 12 per-topic SEO audit files for the Noctalia static documentation site. Each audit examines specific HTML pages, configuration files, and structured data to identify issues and recommend improvements.

---

## Health Dashboard

| # | Audit | Health | P0 | P1 | P2 |
|---|-------|--------|----|----|-----|
| 1 | [Technical Infrastructure](TECHNICAL_INFRASTRUCTURE.md) | Green | 0 | 0 | 3 |
| 2 | [URL Architecture](URL_ARCHITECTURE.md) | Green | 0 | 0 | 2 |
| 3 | [Canonicalization & Hreflang](CANONICALIZATION_HREFLANG.md) | Green | 0 | 1 | 0 |
| 4 | [Meta Tags & Titles](META_TAGS_TITLES.md) | Green | 0 | 0 | 3 |
| 5 | [Open Graph & Twitter](OPEN_GRAPH_TWITTER.md) | Green | 0 | 1 | 2 |
| 6 | [Structured Data](STRUCTURED_DATA.md) | Green | 0 | 1 | 2 |
| 7 | [Internal Linking](INTERNAL_LINKING.md) | Green | 0 | 1 | 3 |
| 8 | [Heading Structure & Content](HEADING_STRUCTURE_CONTENT.md) | Green | 0 | 0 | 4 |
| 9 | [Image SEO](IMAGE_SEO.md) | Green | 0 | 1 | 3 |
| 10 | [International SEO](INTERNATIONAL_SEO.md) | Green | 0 | 1 | 2 |
| 11 | [Mobile SEO](MOBILE_SEO.md) | Yellow | 0 | 1 | 5 |
| 12 | [E-E-A-T & Trust Signals](EEAT_TRUST_SIGNALS.md) | Yellow | 0 | 3 | 6 |

**Overall: 10 Green, 2 Yellow, 0 Red** — Total: 0 P0, 10 P1, 35 P2

---

## Audit Files

### Infrastructure & Technical

1. **[TECHNICAL_INFRASTRUCTURE.md](TECHNICAL_INFRASTRUCTURE.md)** — robots.txt, sitemap.xml, `_headers`, `_redirects`, `vercel.json`, HTTPS, security headers, cache strategy
2. **[URL_ARCHITECTURE.md](URL_ARCHITECTURE.md)** — URL structure, clean URLs, slug localization, language path patterns, trailing slashes, hierarchy depth

### On-Page SEO

3. **[CANONICALIZATION_HREFLANG.md](CANONICALIZATION_HREFLANG.md)** — Canonical tags, hreflang clusters (5 langs + x-default), reciprocity, self-referencing canonicals, sitemap alignment
4. **[META_TAGS_TITLES.md](META_TAGS_TITLES.md)** — Title tags, meta descriptions, robots meta directives, keyword placement, brand suffix
5. **[OPEN_GRAPH_TWITTER.md](OPEN_GRAPH_TWITTER.md)** — OG tags (type, title, description, image, locale), Twitter cards, article timestamps, image dimensions
6. **[STRUCTURED_DATA.md](STRUCTURED_DATA.md)** — JSON-LD schemas (DefinedTerm, BlogPosting, FAQPage, Organization, WebSite, MobileApplication, CollectionPage, ItemList, BreadcrumbList, WebPage, AboutPage)

### Content & Linking

7. **[INTERNAL_LINKING.md](INTERNAL_LINKING.md)** — Hub-and-spoke architecture, cross-linking, anchor text quality, breadcrumbs, rel=prev/next, orphan pages
8. **[HEADING_STRUCTURE_CONTENT.md](HEADING_STRUCTURE_CONTENT.md)** — H1 uniqueness, heading hierarchy, content depth, word counts, AI writing detection awareness

### Media & UX

9. **[IMAGE_SEO.md](IMAGE_SEO.md)** — Alt text, WebP usage, lazy loading, srcset/responsive images, og:image dimensions, preloading
10. **[MOBILE_SEO.md](MOBILE_SEO.md)** — Viewport meta, responsive design, touch targets, glass-panel/aurora-bg performance, prefers-reduced-motion

### Multilingual & Trust

11. **[INTERNATIONAL_SEO.md](INTERNATIONAL_SEO.md)** — Translation completeness, `<html lang>` attributes, i18n parity, slug localization, locale mapping
12. **[EEAT_TRUST_SIGNALS.md](EEAT_TRUST_SIGNALS.md)** — Author attribution, source citations, disclaimers, about page, editorial process, expert review, social proof

---

## Related

- **[../SEO_AUDIT.md](../SEO_AUDIT.md)** — Original general SEO audit (2026-02-02, French)

## Key Validation Scripts

```bash
# Full local SEO gate (links, canonicals, hreflang, sitemap)
node scripts/check-site.js

# AI writing pattern detection
node scripts/ai-writing-audit.js

# Thin page detection
node scripts/check-content-depth.js
```

## Top Priority Actions

### P1 — Should Fix

1. **Sitemap completeness**: Verify no indexable page is missing from the 400-URL sitemap (vs 530 HTML files) — [Canonicalization](CANONICALIZATION_HREFLANG.md)
2. **OG image dimensions**: Add `og:image:width`/`og:image:height` to ~50 pages missing them — [Open Graph](OPEN_GRAPH_TWITTER.md)
3. **FAQ schema visibility**: Ensure all FAQPage JSON-LD questions have corresponding visible content — [Structured Data](STRUCTURED_DATA.md)
4. **Blog pagination**: Add missing `rel="prev"`/`"next"` on 5 blog articles per language — [Internal Linking](INTERNAL_LINKING.md)
5. **Image dimensions**: Add `og:image:width`/`og:image:height` to remaining 10 pages per language — [Image SEO](IMAGE_SEO.md)
6. **og:locale:alternate completeness**: Add missing DE/IT locales to some blog articles — [International SEO](INTERNATIONAL_SEO.md)
7. **Mobile performance**: Add `prefers-reduced-motion` for aurora/blur animations — [Mobile SEO](MOBILE_SEO.md)
8. **Author bios**: Add individual author attribution with credentials — [E-E-A-T](EEAT_TRUST_SIGNALS.md)
9. **Editorial process**: Document content methodology and review process — [E-E-A-T](EEAT_TRUST_SIGNALS.md)
10. **Expert review claims**: Add "Reviewed by" attributions on health-adjacent articles — [E-E-A-T](EEAT_TRUST_SIGNALS.md)
