# Noctalia backlink measurement check — 2026-08-10 00:19 CEST

This is a read-only authority reconciliation. No message, submission, account
edit, publication, upload, payment, disavow file or crawl request was performed.

## Current authenticated Ahrefs overview

The Noctalia project card was reloaded in the authenticated Ahrefs dashboard.
It still reports:

| Metric | Current overview | 30-day change shown |
| --- | ---: | ---: |
| Domain Rating | 0 | — |
| Referring domains | 401 | +147 |
| Organic traffic | 4.6K | +3.1K |
| Organic keywords | 932 | +280 |
| Site Audit health score | 100 | — |
| Crawled pages | 1.6K | +7 |

The Ahrefs API connector was checked first. It has zero workspace API units
until the 2026-08-16 reset, so no paid API query was repeated after the limit
response. The authenticated web report was then used in read-only mode.

## Referring-domain quality split

The detailed report, sorted by DR, explains why 401 raw referring domains have
not produced a non-zero DR:

- most high-DR rows are explicitly marked `SPAM` by Ahrefs, including
  `rankyour.website`, `goodaitools.com`, `buybacklinks.agency` and the repeated
  `.shop` / `.site` SEO-link cluster;
- PeerPush is shown as new, DR 71 and included in Ahrefs' dofollow filter;
- LaunchLlama is shown as new and DR 67 in the all-links view, but is absent
  from the dofollow-filtered view even though the current public HTML exposes a
  followed Noctalia link;
- Tham Hiem Mekong is shown as new, DR 55 and dofollow, but remains a low-trust,
  weakly relevant translated-page citation under the existing qualification;
- Junk Startups is shown as dofollow but marked `SPAM` by Ahrefs;
- DroidSpy is shown as dofollow with DR 0 and remains low-authority secondary
  evidence.

The dofollow-filtered first page contains only eight domains. PeerPush is the
only clean, high-DR followed domain currently recognized there. This is the
quality bottleneck; the raw `401` count is mostly noise, not a base of 401
editorial endorsements.

## Public verifier reconciliation

The independent 19-row checker still reports 6 followed, 4 nofollow, 2
missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP 410. It confirms current
followed HTML on PeerPush, LaunchLlama, SaaSHub's indexable alternatives page,
Junk Startups, DroidSpy and Tham Hiem Mekong.

The LaunchLlama difference is therefore a measurement-lag or classification
gap between current rendered HTML and Ahrefs' present dofollow report. Do not
rewrite the public-link evidence to match the aggregate Ahrefs classification,
and do not claim Ahrefs recognition until its report changes.

## Decision

1. Keep PeerPush and LaunchLlama live; do not buy, relaunch or manipulate them.
2. Do not contact, pay, reciprocate with or otherwise engage the Ahrefs spam
   cluster.
3. Do not submit a Google disavow file without evidence of a manual action or
   harmful link scheme. Disavow is not an Ahrefs DR repair mechanism.
4. Prioritize the prepared D3A follow-ups to KapanLagi, Penzu and AllThingsAI,
   because they are the current routes most likely to add independent,
   relevant followed domains rather than another bulk-directory count.
5. Recheck both the public HTML and Ahrefs classification separately; neither
   one alone proves referral traffic, ranking gain or causation.

## Deployment boundary

Commit `55877b268` is confirmed on `origin/master`. Cloudflare Pages created
production deployment `91259e35-ae3c-4d93-88dd-aef35480a337` for that commit;
it was still queued during this measurement pass. This proves Git delivery and
queue state only, not live alias activation, indexation, backlink acquisition
or DR movement.
