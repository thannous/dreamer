# Noctalia SEO measurement check — 2026-08-03 21:50 CEST

Read-only measurement after the scheduled outreach wave and the localized citation-source push. No Ahrefs detailed report was opened, no Search Console export was requested, no mailbox message was sent, and no Cloudflare retry or promotion was performed.

## Ahrefs — project 9361004

The authenticated Site Explorer overview for `noctalia.app/` showed:

- Domain Rating: `0`
- URL Rating: `5`
- Backlinks: `412` (`+122`)
- Referring domains: `367` (`+136`)
- Organic traffic: `4.3K` (`+3K`)
- Organic keywords: `898` (`+303`)

Compared with the 21:12 CEST snapshot, the third-party index reports one additional backlink and one additional referring domain while DR remains `0`. These changes are not attributable to the outreach wave and do not prove followed editorial equity or a DR gain.

## Public backlink verifier

The read-only 19-row verifier run at 21:50 CEST returned the unchanged treatment summary: 6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410 result, with 4 mismatches. No new public referring page or link treatment was observed.

## Source-to-edge deployment status

Chrome's authenticated Cloudflare Pages dashboard shows automatic deployments enabled for `thannous/dreamer` on `master`. Production remains on `0ade8ef` (`docs(seo): record post-wave authority measurement`). The deployment for commit `76b263f` (`9d724fc5-a10d-4ba9-b2d2-c7827ba2355e`) failed before build submission with:

`Failed: unable to submit build job`

The local source build and GitHub Quality run `30846018711` are successful, but the four localized citation pages are not yet verified at the public edge. This is a Cloudflare deployment-state issue, not evidence of a source or SEO-check failure. No manual retry was performed.

## Decision

Keep DR at `0` as the authoritative current metric. Keep the six messages in transmission-only outreach states, retain the Victoria Song away-message route for its 2026-08-11 stop gate, and do not count any sent message, queued deployment or index movement as a backlink. No Russian domain was added to the tracked opportunities.
