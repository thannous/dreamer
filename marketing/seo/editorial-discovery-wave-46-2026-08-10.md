# Editorial discovery — wave 46 — 2026-08-10

This pass audits uncovered mainstream publishers that have reported on Pixel
Journal or AI journaling. Discovery and page inspection used the
user-designated real Chrome session. No email, form, account, attachment,
payment, publication or product data was used.

## Discovery scope

The focused search covered missing prospect-register domains among CNET,
ZDNET, Mashable, WIRED, Ars Technica, PCMag and How-To Geek. The strongest
visible exact-topic results were:

- Mashable's Rosebud AI-journaling review;
- PCMag UK's Pixel Journal launch article;
- How-To Geek's Pixel Journal launch article;
- a broader WIRED Pixel 10 hardware roundup.

Mashable and PCMag were blocked by Chrome's site-safety policy. They were not
retried through another browser, raw protocol, web fetch or indirect route.
Neither domain is qualified, rejected or assigned an operator/trust verdict
from that incomplete evidence. WIRED was not promoted because the surfaced
result is a broad hardware roundup rather than the strongest exact journaling
route.

## How-To Geek decision

| Gate | Rendered evidence | Decision |
| --- | --- | --- |
| Topic and freshness | Joe Fedewa's August 20, 2025 article is self-canonical, has no `noindex` directive and covers Pixel Journal directly. | Pass for topical discovery. |
| Existing Noctalia result | The rendered page contains zero Noctalia mentions or anchors. | No existing citation to reclaim. |
| Editorial citation pattern | The exact article links Google's Pixel feature source with `nofollow`; its other product actions are affiliate links marked `nofollow sponsored`. The page exposes no direct followed developer-domain citation comparable to Atlas or ILTY. | Reject at the authority-value gate. |
| Operator and contact | The footer identifies Valnet Publishing Group, but deeper operator and contact enrichment was unnecessary after the link-pattern failure. | Not opened; no outreach route collected. |

How-To Geek is therefore recorded as P2
`rejected_no_followed_editorial_or_developer_domain_pattern`. The article is a
legitimate topical source, but pitching it would add an unproven broad-media
route below the already prepared D2, D5 and D7 opportunities.

## Result

The central register now contains 239 routes: 3 P0, 66 P1, 169 P2 and 1 P3.
No Russian-operated site was opened or promoted. The two site-safety blocks are
limitations, not evidence that Mashable or PCMag is unsafe, low quality or
Russian-operated.
