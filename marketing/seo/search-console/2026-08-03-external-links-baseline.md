# Noctalia Search Console external-links baseline — 2026-08-03

Observed on 2026-08-03 CEST in the authenticated Google Search Console `sc-domain:noctalia.app` Links report through the user-designated Chrome session.

## Scope limits

The Search Console Links report has no selectable date range and can lag or sample Google's discoveries. The values below are the current report state observed on the evidence date, not a complete historical backlink index. Search Console also does not expose `rel`, canonical or source-page robots directives in this report, so those fields remain governed by the rendered manual audit.

## Current report

| Metric | Observed value |
| --- | ---: |
| External links | 149 |
| Source domains | 8 |
| Linked Noctalia pages | 4 |
| Internal links | 32,291 |

### Source-domain reconciliation

| Source domain | Source pages | Target pages | Current treatment |
| --- | ---: | ---: | --- |
| `google.com` | 89 | 1 | The detail report resolves all 89 rows to the base Google Play listing and its localized `hl=` variants. This is first-party store discovery, not an independent referring-domain endorsement. |
| `goodaitools.com` | 39 | 1 | Existing public entity listing; rendered Noctalia link is `nofollow`. |
| `saashub.com` | 14 | 1 | Existing alternatives page; the official-site link is followed while the separate main profile remains `noindex`. |
| `chrome-stats.com` | 3 | 1 | Store-derived citation; direct access remains blocked and link attributes are unverified. |
| `appbrain.com` | 1 | 1 | Verified public developer listing; website link is `nofollow`. |
| `crunchbase.com` | 1 | 1 | Search Console now confirms one source page linking to the homepage; direct session verification still prevents canonical and `rel` inspection. |
| `dreammeaniings.com` | 1 | 1 | Indexed but unstable, low-trust and `nofollow`; do not pursue. |
| `thamhiemmekong.com` | 1 | 1 | Newly reconciled indexed followed citation; technically live but low editorial value. |

### Target-page reconciliation

| Noctalia target | External links | Exact source composition |
| --- | ---: | --- |
| `https://noctalia.app/` | 133 | 89 Google Play variants + 39 Good AI Tools + 3 Chrome-Stats + 1 AppBrain + 1 Crunchbase |
| `https://noctalia.app/en/dream-journal-apps` | 14 | SaaSHub |
| `https://noctalia.app/es/blog/suenos-de-agua` | 1 | Dreammeaniings |
| `https://noctalia.app/it/blog/come-ricordare-i-tuoi-sogni-10-tecniche-efficaci` | 1 | Tham Hiem Mekong |

The domain and target totals reconcile exactly to 149. This is a discovery inventory, not a quality score and not evidence that Ahrefs DR changed.

## New source verification: Tham Hiem Mekong

Search Console identifies the exact referring page:

`https://it.thamhiemmekong.com/scienza/cosa-significa-sognare-durante-il-sonno.html`

Current rendered Chrome evidence:

- Google returns the exact page for an exact-URL `site:` query;
- the page is Italian, self-canonical and exposes no page-level robots restriction;
- the source text cites `Noctalia` and links directly to the Italian recall article;
- the link uses `rel="noopener noreferrer"` without `nofollow`, `ugc` or `sponsored`;
- the root site publishes Vietnamese tax number `1801226459`, a Cần Thơ address and tourism licence `92-008/2019`; current search results independently identify the operator as MEKONG DELTA EXPLORER AND EVENT CO., LTD in Vietnam.

The operator therefore has accountable non-Russian evidence. The citation still fails the quality-action gate: the Italian subdomain is a broad translated question-and-answer surface, the article's named automotive and mechanical-engineering author is not a dream or sleep specialist, and the page provides no local legal or editorial navigation. Retain the unsolicited followed link as low-trust technical evidence, but do not contact, pay, reciprocate or cite it as quality authority.

## Post-baseline manual discovery: Mental Momentum

This source is not present in the authenticated Search Console inventory above. It was found afterward through an exact Google search and verified in rendered Chrome:

`https://research.mental-momentum.ai/r/neuroscience-dreaming-memory-hj71od`

- the page is titled `Neuroscience of Dreaming and Memory` and was updated on 2026-06-14;
- source 37 links once to `https://noctalia.app/en/blog/ai-sleep-analysis-dreams`;
- the page is self-canonical and declares `index, follow`;
- the link uses `rel="nofollow noopener noreferrer"`;
- current Terms identify Mental Momentum Inc. as a Virginia, United States operator, with United States hosting and Delaware law.

The accountable non-Russian gate therefore passes. The citation increases the manual indexable nofollow-page count from 6 to 7, but it does not change the observed Search Console totals of 149 links and eight source domains. It is discovery and entity evidence only, not followed equity or proof of a DR increase; no outreach is needed.

## Decision

- Manual followed-page count moves from 5 to 6, with the sixth explicitly classified `followed_low_trust`.
- Manual indexable nofollow count moves from 6 to 7 after the post-baseline Mental Momentum discovery.
- Manual nonindexable profile count remains 2.
- The authenticated GSC report itself remains 149 external links from eight source domains to four Noctalia pages; Mental Momentum has not been observed there.
- Current Ahrefs DR is 0 and the project-card referring-domain value is 360 on 2026-08-03; neither may be substituted for GSC's separate corpus.
- The authority sprint should continue to prioritize independently edited Android, journaling, sleep and dream publications rather than raw store variants or translated content networks.
