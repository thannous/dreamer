# Editorial discovery wave 39 — 2026-08-10

This read-only real-Chrome pass refreshed one paused directory and evaluated
five new search surfaces at 02:12–02:27 CEST. No email, form, comment, account
change, product submission, attachment, payment or publication was used.

## PitchWall reclassification

The existing public profile at `https://pitchwall.co/user/tanuki` is now
self-canonical, indexable-looking and preserves the bio that names Noctalia.
It contains zero `noctalia.app` anchors, so it is an entity mention rather than
a backlink.

The current homepage and the sampled self-canonical product page
`https://pitchwall.co/product/2pr` both route product clicks through internal
`/out/` URLs. Every inspected product click carries
`rel="noopener nofollow"`, contradicting PitchWall's earlier public claim of a
dofollow launch link. Terms select Indian law and exclusive Indore,
Madhya Pradesh jurisdiction, so no Russian jurisdiction signal was found, but
they identify no legal entity or accountable address.

Decision: move PitchWall from P1 to P2 and do not submit Noctalia for DR. The
profile's persistence no longer blocks the route; current nofollow treatment
and opaque operator identity do.

## New surfaces

| Publisher | Current rendered evidence | Decision |
| --- | --- | --- |
| [Dazed](https://www.dazeddigital.com/life-culture/article/61680/1/lucid-dreams-tech-start-ups-trying-to-hack-our-dreams) | The January 10, 2024 feature names Günseli Yalcinkaya, contains one plain-text DreamKit mention and no Noctalia mention. Its inspected external editorial anchors include Know Your Meme and The Lucid Guide, but no app developer domain. Dazed Media publishes accountable London, New York, Dubai and Seoul office addresses; no Russian operator signal was found. | Reject for the DR sprint: the exact article demonstrates no app developer-domain citation pattern. |
| [Jyotirgamya](https://jyotirgamya.org/opinion/dream-journaling-explained/) | The self-canonical article links Lucid and DreamKit only to Google Play. It gives no named article author or accountable operator evidence on the inspected page and makes broad claims about sleep quality, anxiety, mental health, dream meanings and control. | Reject before contact: mobile-store-only links, high-stakes claim risk and unverified non-Russian operator. |
| [Appfigures](https://appfigures.com/top-apps/ios-app-store/qatar/iphone/lifestyle?profile=product.338147358147.similar) | Google surfaced Noctalia inside a dynamic similar-app result. The live URL redirects to `app.appfigures.com`, drops the profile parameter and renders a generic Qatar iOS chart; product `338147358147` resolves to Dream Master, not Noctalia. No stable Noctalia page or anchor exists. | Reject: a transient search snippet is not a referring page or submission opportunity. |
| [Hugging Face](https://huggingface.co/best-ai-dream-interpreter) | The exact indexed-looking URL currently renders Hugging Face's 404 page with no product comparison or Noctalia citation. | Reject as a stale result. Do not create an unrelated repository or Space for a host-DR link. |
| [Appelse](https://appelse.com/lucid-dream-apps/) | The current eight-app roundup gives differentiated commentary, but every inspected product call to action goes to Google Play or the App Store. The page exposes About and Contact surfaces but no accountable legal entity, address or jurisdiction. | Reject: no developer-domain citation path and non-Russian operation is unverified. |

## Measurement boundary

This pass creates no backlink, referring domain, indexation event, referral
session or DR movement. It removes PitchWall from the DR-oriented submission
queue and prevents five search-result false positives from becoming outreach.
