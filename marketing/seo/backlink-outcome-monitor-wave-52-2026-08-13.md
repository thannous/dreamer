# Backlink outcome monitor — wave 52 — 2026-08-13

This pass looked only for publicly observable outcomes. It did not send an
email, reply, form, account action, attachment, payment, publication or second
follow-up.

## Known-result verification

`npm run seo:backlinks:check` rechecked the 19 rows in
`backlink-results-2026-07-31.csv` without modifying the tracker.

| Current treatment | Rows | Interpretation |
| --- | ---: | --- |
| Followed | 6 | Existing public authority evidence only; none is new in this pass. |
| Nofollow | 4 | Existing discovery/entity evidence only. |
| Missing link | 2 | Includes the known Reddit application-shell limitation; this automated result does not override the latest rendered-link evidence. |
| Non-indexable | 3 | Excluded from indexable authority totals. |
| HTTP 403 | 3 | Link treatment remains unverified without a permitted rendered check. |
| HTTP 410 | 1 | The referring page remains unavailable. |

The checker reported one changed or unreachable row: Reddit's direct response
still omits the expected anchor. The existing result row already records that
the public rendered post exposed `rel="noopener nofollow ugc"` on 2026-08-13.
The application-shell response is therefore retained as an automation
limitation, not treated as proof that the public link disappeared.

## New-citation discovery

Fresh exact-domain and exact-deep-link searches covered:

- `noctalia.app` outside the Noctalia domain;
- Noctalia with dream-journal, review and dream-interpretation terms;
- `/en/dream-journal-apps`;
- `/en/dreamkit-alternative`;
- `/fr/blog/reves-premonitoires-science`;
- `/en/blog/ai-sleep-analysis-dreams`.

The broad searches returned only Noctalia-owned pages, Google Play language
variants and already tracked surfaces such as Reddit, Chrome-Stats and APKPure.
The four exact deep-link searches returned no result. Search visibility alone
would not have been sufficient to count a backlink in any case.

## Priority-page public check

Direct HTTP inspection produced the following current public evidence:

| Page | HTTP | Canonical / robots | Noctalia anchor |
| --- | ---: | --- | ---: |
| Atlas Workspace journaling comparison | 200 | Self-canonical; `index, follow` | 0 |
| ILTY AI-journaling comparison | 200 | Self-canonical; `index, follow` | 0 |
| Marika Pech precognitive-dream article | 200 | Self-canonical; `follow, index` | 0 |
| DreamWell dream-journal comparison | 200 | Self-canonical; `index, follow` | 0 |

Atlas Workspace and ILTY therefore remain `followup_1_sent_waiting`. This pass
does not establish a new mailbox reply, bounce, opt-out or delivery state, and
no second automatic follow-up is allowed. Marika Pech (`D2`) and DreamWell
(`D5`) remain unsent and require their own exact authorization plus an immediate
public and full-mailbox stop gate before any transmission.

## Result

No new referring domain, topical editorial link or deep link is publicly
verified in wave 52. The results tracker remains at 19 rows and the prospect
register remains at 254 routes: 3 P0, 66 P1, 184 P2 and 1 P3. No traffic change
or Ahrefs DR movement is claimed because neither was freshly measured here.
