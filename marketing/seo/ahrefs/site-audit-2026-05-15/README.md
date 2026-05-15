# Ahrefs Site Audit export - Noctalia - 2026-05-15

Source: Ahrefs Site Audit project `9361004`, project `Noctalia`.

Context shown in Ahrefs during export:

- Crawl selector: `Today` / `15 May 2026`
- Compared with: `11 May`
- Health score: `100`
- Errors: `0`
- Warnings: `212`
- Notices: `91`
- Actual issue rows exported: `13`

## Exported issue datasets

| File | Ahrefs issue | Rows |
| --- | --- | ---: |
| `page-has-links-to-redirect.csv` | Page has links to redirect | 129 |
| `3xx-redirect.csv` | 3XX redirect | 4 |
| `http-to-https-redirect.csv` | HTTP to HTTPS redirect | 2 |
| `redirect-chain.csv` | Redirect chain | 1 |
| `title-too-long.csv` | Title too long | 47 |
| `meta-description-too-long.csv` | Meta description too long | 31 |
| `title-too-short.csv` | Title too short | 1 |
| `page-and-serp-titles-do-not-match.csv` | Page and SERP titles do not match | 60 |
| `serp-title-changed.csv` | SERP title changed | 2 |
| `open-graph-tags-missing.csv` | Open Graph tags missing | 5 |
| `twitter-card-missing.csv` | X/Twitter card missing | 5 |
| `pages-to-submit-to-indexnow.csv` | Pages to submit to IndexNow | 15 |
| `structured-data-schema-validation-error.csv` | Structured data has schema.org validation error | 1 |
| `link-opportunities.csv` | Internal link opportunities | 79 |

## Suggested fix order

1. Fix internal links pointing to redirects, especially links to `https://noctalia.app/en/`.
2. Fix the schema.org validation error on `/en/press`.
3. Shorten long titles and meta descriptions.
4. Add missing Open Graph and X/Twitter tags.
5. Review SERP title mismatch data for CTR-oriented title updates.
6. Use IndexNow data as a publication/indexing follow-up after content fixes.
7. Use `link-opportunities.csv` for contextual internal links, prioritizing high-volume dream topics over legal-page suggestions.
