# Noctalia backlink measurement check — 2026-08-09 15:58 CEST

## Fresh Ahrefs project overview

The authenticated Ahrefs project card for `*.noctalia.app/*` was read in the
real Chrome session with monthly-volume metrics. No detailed backlink or
referring-domain report was opened. The direct Ahrefs API connector was not used
for data because it reported zero remaining API units before returning any
metric.

| Metric | Current overview | 30-day change shown |
| --- | ---: | ---: |
| Domain Rating | 0 | — |
| Referring domains | 401 | +147 |
| Organic traffic | 4.6K | +3.1K |
| Organic keywords | 932 | +280 |
| Site Audit health score | 100 | — |
| Crawled pages | 1.6K | +7 |

The preceding authenticated 2026-08-03 21:50 CEST overview had 367 referring
domains, 4.3K organic traffic and 898 organic keywords. The current overview is
therefore higher by 34 referring domains, roughly 0.3K organic traffic and 34
organic keywords, while DR remains 0.

## Interpretation boundary

The 401 Ahrefs referring domains are an index-wide raw count, not 401 verified
followed editorial domains. The current public verifier still distinguishes only
6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP
410 tracked pages. The raw Ahrefs growth has not yet crossed the logarithmic DR
threshold.

The PeerPush screenshot edit completed minutes before this reading cannot have
caused these values and must not be credited for them. Screenshots improve an
already live profile; they do not create a new referring domain or a second
backlink. Likewise, these current Ahrefs values do not prove that recent
outreach, Git commits or Cloudflare deployments created any specific link.

## Cloudflare boundary

Commit `8f9206363` (`docs(seo): record PeerPush screenshot update`) is pushed to
`master`. Cloudflare Pages created production deployment
`17a88917-1afb-40c7-9090-524b54b403ce`, which was still queued at the evidence
time. The active custom-domain deployment was `97877f22-a808-40b3-aad2-67deefbea31d`
for commit `b7cb10546`. This establishes Git delivery and deployment-queue state,
not publication of `8f9206363`, indexation, backlink acquisition or DR movement.
