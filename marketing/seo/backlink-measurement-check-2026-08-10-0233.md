# Noctalia backlink measurement check — 2026-08-10 02:33 CEST

This is a read-only authority reconciliation in the authenticated Ahrefs
project and against the public backlink verifier. No message, submission,
account edit, publication, upload, payment, disavow file or crawl request was
performed.

## Current authenticated Ahrefs overview

| Metric | Current overview | 30-day change shown | Previous 00:19 reading |
| --- | ---: | ---: | ---: |
| Domain Rating | 0.1 | +0.1 | 0 |
| URL Rating | 5 | +0.2 | not recorded |
| Backlinks | 453 | +151 | not recorded |
| Referring domains | 406 | +152 | 401 |
| Organic traffic | 4.6K | +3.1K | 4.6K |
| Organic keywords | 936 | +284 | 932 |

The measured change since 00:19 is therefore `+0.1` DR and `+5` referring
domains. This is an Ahrefs index movement, not proof that the D3A follow-ups,
the latest Git deployment or any specific referring page caused it.

## Followed-domain quality split

The same overview reports 8 followed and 398 not-followed referring domains;
the backlink split is 8 followed and 445 not followed. The DR-sorted Ahrefs
dofollow report contains eight domains:

| Domain | Ahrefs DR | Current Ahrefs treatment |
| --- | ---: | --- |
| `peerpush.com` | 71 | New, followed, not labelled spam |
| `thamhiemmekong.com` | 55 | New, followed, not labelled spam |
| `junkstartups.com` | 10 | Followed, labelled `SPAM` |
| `wecelebrities.com` | 6 | Followed, labelled `SPAM` |
| `quotesblom.com` | 3.2 | Followed, labelled `SPAM` |
| `bestnz-poker-casinoslot.com` | 1.5 | Followed, labelled `SPAM` |
| `vibeking.fun` | 0.2 | Followed, labelled `SPAM` |
| `droidspy.ai` | 0 | New, followed, not labelled spam |

Five of the eight followed domains are therefore Ahrefs-labelled spam. The two
clean, non-zero-DR domains in this report are PeerPush and Tham Hiem Mekong.
The latter remains low-trust and weakly relevant under the existing public-page
qualification; its DR must not be presented as an editorial endorsement.
DroidSpy is technically followed but carries DR 0 and an opaque public
operator identity.

## Public-page reconciliation

The independent 19-row checker was rerun at 02:33 CEST and remains unchanged:
6 followed, 4 nofollow, 2 missing-link, 3 non-indexable, 3 HTTP 403 and 1 HTTP
410. It still verifies current followed HTML on PeerPush, LaunchLlama,
SaaSHub's indexable alternatives page, Junk Startups, DroidSpy and Tham Hiem
Mekong.

LaunchLlama remains followed in current public HTML but absent from Ahrefs'
dofollow-domain view. Conversely, Ahrefs includes several domains that the
curated public tracker excludes as spam or unqualified. Keep the two evidence
sets separate.

## Decision

1. Record DR 0.1 as the first measured non-zero Ahrefs value, without causal
   attribution.
2. Do not engage, pay, reciprocate with or disavow the five Ahrefs-labelled
   spam domains merely to influence a third-party metric.
3. Keep the one-time D3A follow-ups in monitoring state; do not send a second
   follow-up.
4. Prioritize accountable, topically relevant editorial corrections and
   followed-domain patterns over additional bulk-directory counts.
5. Continue measuring public link treatment, Ahrefs classification, referral
   sessions and conversions as separate outcomes.
