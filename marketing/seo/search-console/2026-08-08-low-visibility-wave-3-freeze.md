# GSC low-visibility wave 3 — metadata baseline and measurement freeze

Date of change: 2026-08-08

Comparison windows: Google Search Console, 2026-07-24 to 2026-07-30 versus 2026-07-31 to 2026-08-06

Property: `sc-domain:noctalia.app`

## Frozen URLs

| URL | Clicks | Impressions | CTR | Average position | Seven-day signal |
| --- | ---: | ---: | ---: | ---: | --- |
| `https://noctalia.app/es/simbolos/perro` | 7 | 3,796 | 0.18% | 8.41 | Impressions +88%; CTR -47% |
| `https://noctalia.app/it/simboli/ragno` | 18 | 2,836 | 0.63% | 6.48 | Impressions +62%; CTR -35% |
| `https://noctalia.app/it/simboli/casa` | 5 | 1,641 | 0.30% | 7.79 | Impressions +21%; CTR -59% |

Page aggregates are the baseline. Visible query rows are incomplete and must not replace the page-level totals.

## Isolated change scope

- Change only the document `<title>` and `<meta name="description">` for these three locale pages.
- Preserve H1, visible introduction and body copy, FAQ, canonical, hreflang, URL, images, Open Graph, Twitter metadata, JSON-LD and symbol freshness dates.
- Keep `/it/simboli/pioggia` unchanged because its CTR increased by 32% and clicks by 35% over the comparison window.
- Keep `/it/simboli/automobile` unchanged because its CTR increased by 31% and its previous freeze ended only on 2026-08-07.
- Keep the five wave-2 pages unchanged under their existing freeze through 2026-08-25.
- Keep `/en/blog/precognitive-dreams-science` outside this metadata test. It requires a separate intent and source-quality review after its own freeze.

## Freeze protocol

- Do not make another SEO change to these three URLs before the J+28 decision unless a critical factual, legal, security or broken-page issue is found.
- J+7 checkpoint: 2026-08-15.
- J+28 decision checkpoint and planned freeze end: 2026-09-05.
- Compare clicks, impressions, CTR and average position over equivalent page-level windows.
- Do not infer causality from an individual query row or a single ranking movement.

## Publication and crawl boundaries

- Production publication requires successful source validation and live verification of HTTP status, canonical, robots directives and the two document metadata fields.
- These are existing canonical URLs, so the sitemap does not need resubmission for this metadata-only wave.
- A new Search Console indexing request is a separate action and is not part of this publication unless explicitly authorized.
