# Technical Infrastructure — Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green — Core technical SEO infrastructure is solid with proper robots, sitemap, caching, redirects, and security headers in place.

| Metric | Value |
|--------|-------|
| robots.txt | Valid, sitemap declared |
| Sitemap URLs | 400 with hreflang annotations |
| Cache strategy | Tiered (HTML revalidate, assets immutable 1yr, SEO files 1hr) |
| Redirect coverage | .html cleanup, www/http normalization, legacy slugs |
| Security headers | X-Content-Type-Options, X-Frame-Options, Referrer-Policy |
| noindex protection | Templates, auth callbacks, 404, reports, scripts, agent files |
| Hosting config | Dual: Cloudflare (_headers/_redirects) + Vercel (vercel.json) |

## Current State

### robots.txt
- `Allow: /` permits full crawling of the public site.
- `Sitemap: https://noctalia.app/sitemap.xml` declared so all major crawlers can discover URLs.
- `/cdn-cgi/speculation` explicitly allowed (Cloudflare Speculation Rules for prefetch).
- `/cdn-cgi/` disallowed to block internal Cloudflare endpoints from indexing.

### sitemap.xml
- Contains 400 URLs covering all five languages.
- Every URL includes hreflang annotations for all 5 languages (en, fr, es, de, it) plus `x-default`.
- Clean URLs throughout (no `.html` extensions).
- `<lastmod>` dates present on all entries.
- Priority values are properly tiered: `1.0` for homepages, `0.8` for guides and symbol pages, `0.3` for legal pages.

### _headers (Cloudflare)
- **HTML pages:** `Cache-Control: max-age=0, must-revalidate` ensures crawlers always get fresh content.
- **Static assets (JS, CSS, images, fonts):** `Cache-Control: public, max-age=31536000, immutable` for optimal performance.
- **SEO files (robots.txt, sitemap.xml):** `Cache-Control: public, max-age=3600` (1-hour TTL).
- **X-Robots-Tag noindex** applied to non-content paths: `/templates/*`, `/auth/callback/*`, `/404*`, `/reports/*`, `/scripts/*`, `/.agent/*`, `/.claude/*`.
- **Security headers present:**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: SAMEORIGIN`
  - `Referrer-Policy: strict-origin-when-cross-origin`

### _redirects (Cloudflare)
- `.html` to clean URL via 301 redirects — prevents duplicate content.
- `www.noctalia.app` and `http://` both redirect to `https://noctalia.app` (canonical domain normalization).
- Legacy French diacritics redirects (e.g., old accented slugs to new normalized slugs).
- Historical slug renames covered with 301s to preserve link equity.

### vercel.json
- Mirrors `_redirects` rules for Vercel hosting environment.
- Includes rewrites so clean URLs resolve to the underlying `.html` files server-side.

## Issues & Gaps

### P0 — Critical

None identified.

### P1 — High Priority

None identified.

### P2 — Optimization

1. **No HSTS header in `_headers`.**
   Cloudflare likely adds HSTS at the edge, but explicitly declaring `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` in `_headers` would guarantee coverage regardless of CDN configuration and support HSTS preload list submission.

2. **Dual hosting configuration may diverge.**
   `_redirects` + `_headers` (Cloudflare Pages) and `vercel.json` (Vercel) serve the same purpose. If one is updated and the other is not, redirect or header rules will differ between environments. Consider a build script that generates `vercel.json` from `_redirects`/`_headers` (or vice versa) to keep them in sync.

3. **No Content-Security-Policy header.**
   Adding a CSP header would harden the site against XSS and data injection attacks. A report-only policy (`Content-Security-Policy-Report-Only`) can be deployed first to identify violations before enforcement.

## Recommendations

1. **Add an explicit HSTS header** to `_headers` (and mirror it in `vercel.json` custom headers):
   ```
   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
   ```

2. **Introduce a sync check** (CI script or pre-deploy hook) that compares redirect and header rules between `_redirects`/`_headers` and `vercel.json`, flagging any drift.

3. **Deploy a Content-Security-Policy-Report-Only header** as a first step, monitor reports for 2 weeks, then promote to enforcing CSP.

4. **Verify Cloudflare HSTS settings** in the dashboard (SSL/TLS > Edge Certificates > HSTS) to confirm edge-level enforcement is active while the header-level fix is pending.

## Validation Commands

```bash
# Check robots.txt is accessible and correct
curl -sI https://noctalia.app/robots.txt | grep -E "HTTP|Content-Type|Cache-Control"
curl -s https://noctalia.app/robots.txt

# Validate sitemap is well-formed XML with expected URL count
curl -s https://noctalia.app/sitemap.xml | grep -c "<url>"

# Verify .html redirect to clean URL (should return 301)
curl -sI https://noctalia.app/en/index.html | grep -E "HTTP|Location"

# Check www redirect
curl -sI http://www.noctalia.app/ | grep -E "HTTP|Location"

# Inspect security and caching headers on an HTML page
curl -sI https://noctalia.app/en/ | grep -iE "cache-control|x-content-type|x-frame|referrer-policy|strict-transport"

# Inspect noindex on protected paths
curl -sI https://noctalia.app/templates/ | grep -i "x-robots-tag"

# Compare redirect rule count between files
grep -c "301" docs/_redirects
grep -c '"statusCode": 301' docs/vercel.json
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `/robots.txt` | SEO file | Valid, sitemap declared, cdn-cgi blocked |
| `/sitemap.xml` | SEO file | 400 URLs, hreflang + lastmod + priority present |
| `/en/` | Homepage | Cache revalidate, security headers present |
| `/en/symbols/snake` | Symbol page | Clean URL, 301 from .html variant |
| `/templates/symbol-page.html` | Template | noindex via X-Robots-Tag |
| `/auth/callback/` | Auth callback | noindex via X-Robots-Tag |
| `/` | Root index | Serves language detection stub |
