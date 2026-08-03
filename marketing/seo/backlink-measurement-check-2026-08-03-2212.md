# Noctalia SEO measurement check — 2026-08-03 22:12 CEST

Read-only reconciliation after the successful Cloudflare deployment for the localized citation-source assets. No Ahrefs detailed report was opened, no Search Console export was requested, no mailbox message was sent, and no follow-up was sent ahead of its scheduled gate.

## Ahrefs — project 9361004

The authenticated Site Explorer overview for `noctalia.app/` showed:

- Domain Rating: `0`
- URL Rating: `5`
- Backlinks: `412` (`+122`)
- Referring domains: `367` (`+136`)
- Organic traffic: `4.3K` (`+3K`)
- Organic keywords: `898` (`+303`)

The dashboard also shows only 3 followed backlinks and 3 followed referring domains; the raw index totals have not produced a DR increase. No new followed editorial backlink is attributed to the outreach wave or to the site deployment.

## Public backlink verifier

The read-only 19-row verifier rerun at 22:12 CEST returned the unchanged treatment summary: 6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410 result, with 4 mismatches. No new external referring page or link treatment was observed.

## Source-to-edge deployment and rendered proof

Cloudflare Pages deployment `f5463610-a551-4f21-a60d-5e085b6d4b60` for commit `d8c84e5` succeeded at 22:11 CEST and aliases `noctalia.app`. Its clean checkout passed the docs build/check contract: 1,178 HTML pages, 96,883 internal links, 0 errors, 0 warnings and 1,175 sitemap URLs.

Chrome rendered the four localized comparison pages and verified, for each of `/fr/applications-journal-de-reves`, `/es/apps-diario-de-suenos`, `/de/traumtagebuch-apps` and `/it/app-diario-dei-sogni`:

- visible citation section (`#citation`),
- localized JSON-LD `Dataset`,
- self-referencing canonical URL, and
- `index, follow` robots directives.

These are citation-ready assets for future editorial outreach, not backlinks themselves. The public edge still has no verified new external link or DR gain. No Russian domain was added to the tracked opportunities.

## Decision

Keep DR at `0` as the authoritative current metric. Preserve the existing six followed-link records and the scheduled outreach stop gates; measure again after any publisher response or public link, not after a successful deployment alone.
