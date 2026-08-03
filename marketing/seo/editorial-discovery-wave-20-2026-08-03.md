# Editorial discovery wave 20 — post-send public page recheck

Evidence date: 2026-08-03 23:18 CEST. This was a read-only HTTP check of the twenty current article or source URLs whose routes are already in an outreach or accepted-form state. No account, form, email, CAPTCHA, product data or payment was used.

## Aggregate result

| Result | Count | Interpretation |
| --- | ---: | --- |
| HTTP 200, no `noctalia.app` string in the fetched HTML | 19 | No new static-HTML backlink or public citation was observed. Client-rendered pages still require a browser recheck before treating the absence as definitive. |
| HTTP 403 | 1 | App Charts remains access-protected; no link or publication claim is possible. |

The checked routes were App Charts, World of Lucid Dreaming, Mattress Miracle, Android Central, Holstee, Sleep Review, Dream Studies Portal, DeepJournal, TechRadar, Tom's Guide, Get Acuity, CortexOS, Dearly/Brooo, Individuate, Dreamly, Elsewhere Dreams on Medium, VoWise, AndroidGuías, SlashGear and The Verge. The request used a neutral user agent, an 8-second connection timeout and a 15-second read timeout; only the first 2 MB of each response was scanned for the literal `noctalia.app` string. No response body was copied into the registry.

## Decision

No route is upgraded to published, linked or accepted. A sent message, a 200 response, or a page that may render additional content in JavaScript is not a backlink. The due-date follow-up packs remain unchanged: perform a fresh stop check on the scheduled day, use the original route, and close immediately on a reply, opt-out, failure or verified public citation.
