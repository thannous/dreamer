# Noctalia Search Console external-links refresh — 2026-08-09

Observed on 2026-08-09 CEST in the authenticated Google Search Console `sc-domain:noctalia.app` Links report through the user-designated Chrome session.

## Scope limits

The Search Console Links report has no selectable date range and can lag or sample Google's discoveries. It counts source pages, not independently audited followed backlinks. It does not expose source-page canonical, robots or `rel` attributes, so the public verifier remains authoritative for those properties.

## Current report

| Metric | 2026-08-03 | 2026-08-09 | Change |
| --- | ---: | ---: | ---: |
| External links | 149 | 148 | -1 |
| Source domains | 8 | 8 | 0 |
| Linked Noctalia pages | 4 | 4 | 0 |
| Internal links | 32,291 | 33,803 | +1,512 |

### Source-domain reconciliation

| Source domain | Source pages | Target pages | Change since 2026-08-03 |
| --- | ---: | ---: | ---: |
| `google.com` | 89 | 1 | 0 |
| `goodaitools.com` | 39 | 1 | 0 |
| `saashub.com` | 13 | 1 | -1 |
| `chrome-stats.com` | 3 | 1 | 0 |
| `appbrain.com` | 1 | 1 | 0 |
| `crunchbase.com` | 1 | 1 | 0 |
| `dreammeaniings.com` | 1 | 1 | 0 |
| `thamhiemmekong.com` | 1 | 1 | 0 |

The domain and source-page totals reconcile exactly to 148. No new source domain appears in this authenticated report.

### Target-page reconciliation

| Noctalia target | External links | Exact source composition |
| --- | ---: | --- |
| `https://noctalia.app/` | 133 | 89 Google Play variants + 39 Good AI Tools + 3 Chrome-Stats + 1 AppBrain + 1 Crunchbase |
| `https://noctalia.app/en/dream-journal-apps` | 13 | SaaSHub |
| `https://noctalia.app/es/blog/suenos-de-agua` | 1 | Dreammeaniings |
| `https://noctalia.app/it/blog/come-ricordare-i-tuoi-sogni-10-tecniche-efficaci` | 1 | Tham Hiem Mekong |

## SaaSHub row-level evidence

The current drill-down exposes these 13 SaaSHub source pages, all targeting `https://noctalia.app/en/dream-journal-apps`:

1. `https://www.saashub.com/alternatives/post-noctalia-2026-05-09-best-dream-journal-apps-and-noctalia-alternatives`
2. `https://www.saashub.com/compare-chatgpt-vs-dreamapp`
3. `https://www.saashub.com/compare-dreamapp-vs-150-chatgpt-4-0-prompts-for-seo`
4. `https://www.saashub.com/compare-facebook-ar-studio-vs-dreamapp`
5. `https://www.saashub.com/compare-instrumental-vs-oniri`
6. `https://www.saashub.com/compare-oniri-vs-150-chatgpt-4-0-prompts-for-seo`
7. `https://www.saashub.com/compare-oniri-vs-dreamboard-com`
8. `https://www.saashub.com/compare-oniri-vs-machine-learning-playground`
9. `https://www.saashub.com/compare-oniri-vs-rise-track-sleep-and-circadian`
10. `https://www.saashub.com/compare-oniri-vs-running-by-gyroscope`
11. `https://www.saashub.com/compare-oniri-vs-the-dream-board`
12. `https://www.saashub.com/compare-pulse-vs-oniri`
13. `https://www.saashub.com/oniri`

The 2026-08-03 baseline retained the aggregate SaaSHub count of 14 but not its full row-level URL list. The exact removed row therefore cannot be identified honestly from the preserved evidence. Separately, the public verifier still sees the indexable `https://www.saashub.com/noctalia-app-alternatives` page and its followed Noctalia link. That audited page targets the homepage and is not one of the 13 deep-page rows above, so the one-row GSC decrease does not identify or prove the loss of the audited followed citation.

## Decision

- Treat the `149 -> 148` movement as a GSC source-page inventory fluctuation, not as a DR or authority loss.
- Keep SaaSHub in the verified followed set while its audited public alternatives page remains live and indexable.
- Do not create duplicate SaaSHub listings or send a recovery request without evidence that the verified followed page itself changed.
- Continue to prioritize new topical editorial domains; the authenticated GSC corpus remains concentrated in the same eight domains.
- The last authenticated Ahrefs DR snapshot remains the dated 2026-08-03 value. This GSC refresh does not update or infer DR.
