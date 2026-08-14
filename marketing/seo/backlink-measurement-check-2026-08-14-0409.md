# Noctalia backlink measurement check — 2026-08-14 04:09 CEST

This is a read-only authority reconciliation in the authenticated Ahrefs
project and against the existing public backlink register. No email, form,
account edit, export, publication, payment, disavow file or crawl request was
performed.

## Current authenticated Ahrefs dashboard

The Noctalia project `9361004`, scoped to `*.noctalia.app/*`, currently shows:

| Metric | Current value | 30-day change shown |
| --- | ---: | ---: |
| Domain Rating | 0 | not shown separately |
| Referring domains | 419 | +151 |
| Total visitors | 8.6K | +6.8K |
| Organic traffic | 4.6K | +3.1K |
| Organic keywords | 974 | +271 |
| Site Audit health | 100 | — |

`Total visitors` is Ahrefs Web Analytics telemetry. It is not referral traffic
from backlinks and is therefore kept separate from the referring-domain and
organic-search values. The displayed DR is back at `0`; no DR increase is
claimed.

The connected Ahrefs API was checked first and returned `0` remaining API
units. The authenticated UI remains available, so this audit used the real
Chrome session without exporting data. API-unit exhaustion and UI access are
separate states.

## DR-sorted referring-domain quality check

The first 50 rows of the all-domain report, sorted by DR descending, contain:

- 47 domains explicitly labelled `SPAM` by Ahrefs;
- 3 domains not labelled spam: `peerpush.com`, `launchllama.co` and
  `thamhiemmekong.com`;
- 8 rows labelled `New`, including both spam and non-spam rows.

The three non-spam rows do not represent three newly acquired quality domains:

| Domain | Ahrefs row | Reconciliation |
| --- | --- | --- |
| `peerpush.com` | DR 71, `New`, one link | Existing product-listing domain already tracked since July. Ahrefs exposes the PeerPush product page linking to `https://noctalia.app/?ref=peerpush`; it is not an independent editorial citation. |
| `launchllama.co` | DR 67, `New`, one link | Existing LaunchLlama ecosystem already tracked through its Noctalia directory page. The current root site promotes its newsletter and product directory; this is not a new thematic editorial domain. |
| `thamhiemmekong.com` | DR 55, `New`, one link | Existing followed but low-trust source already reconciled in the public results register. Its unrelated tourism/operator context does not make it a quality dream or sleep citation. |

The `+151` dashboard change is therefore a raw Ahrefs index movement dominated,
at the high-DR end, by Ahrefs-labelled spam and already-known listing or
low-trust sources. It is not evidence that the outreach sprint acquired 151
links, 151 quality domains or any new editorial backlink.

## Public-page verifier

The 19-row read-only verifier was rerun after the Ahrefs check. It reproduced
6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP
410 result. Its only mismatch is the known Reddit application-shell boundary:
the raw response contains no anchor, while the most recent real-Chrome render
on 2026-08-13 exposes the existing `nofollow ugc` link. The reconciled tracked
inventory therefore remains 6 followed, 5 nofollow and 3 non-indexable pages.
No newly published referring page appeared.

## Decision

1. Record the fresh DR `0`, 419 referring domains, 4.6K organic traffic and 974
   organic keywords without causal attribution.
2. Do not add a row to the public backlink results register: no new public
   referring domain passed the independent, topical and editorial gates.
3. Do not contact, pay, reciprocate with or disavow the unsolicited spam cluster
   merely to influence Ahrefs.
4. Keep Atlas Workspace and ILTY in passive monitoring and send no second
   follow-up.
5. Continue prioritizing accountable sleep, dream and journaling publishers
   that already cite comparable product domains directly.
