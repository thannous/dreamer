# Noctalia SEO measurement check — 2026-08-03 23:55 CEST

Read-only reconciliation after the successful Cloudflare Pages deployment and the Andro4all qualification. No Ahrefs detailed report was opened, no Search Console export was requested, no mailbox message was sent and no follow-up was sent ahead of its gate.

## Source-to-edge deployment

Cloudflare Pages deployment `220ef95a-93bc-4c4e-b406-41c8bb07b663` for commit `5d0abc27a550fd1988b539a9742fe18ed5ea676f` completed with `build=success` and `deploy=success` at 23:53 CEST. The deployment exposes the production alias `https://noctalia.app` and the preview `https://220ef95a.noctalia.pages.dev`.

The clean SEO worktree independently passed the same contracts before the edge completed: `npm run docs:build` generated 750 symbol pages with 0 errors, and `npm run docs:check` reported 1,178 HTML pages, 1,175 sitemap URLs, 0 broken internal links, 0 errors and 0 warnings.

## Rendered route matrix

The five localized comparison pages returned HTTP 200 on both preview and production. Every response had the expected production self-canonical, an `index, follow` robots directive, localized JSON-LD `Dataset` markup and a rendered `citation` marker:

| Surface | Routes checked | Result |
| --- | ---: | --- |
| Preview | 5/5 | 200, canonical, robots, Dataset and citation all verified |
| Production | 5/5 | 200, canonical, robots, Dataset and citation all verified |

These are citation-ready assets for future editorial outreach, not backlinks themselves.

## Public backlink verifier

The fresh 19-row verifier rerun remained unchanged: 6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410 result, with 4 mismatches. No new external referring page or link treatment was observed.

## Authority metric boundary

The latest available Ahrefs snapshot remains the 22:12 CEST dashboard view: Domain Rating `0`, URL Rating `5`, 412 backlinks, 367 referring domains and only 3 followed backlinks / 3 followed referring domains. A new API request was not made because the account had 0 units remaining. The snapshot and successful deployment do not prove a DR increase.

No Russian domain was added to the opportunity register. The Andro4all route is prepared for a single Spanish factual suggestion at 10:30 CEST on 2026-08-04, after the exact mailbox stop check; no message, account or form action was performed.

## Decision

Keep the current authority metric and live-link totals unchanged. Continue with the publisher stop gates and measure again only after a publisher response or a publicly verified clickable citation.
