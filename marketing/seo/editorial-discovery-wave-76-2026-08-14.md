# Editorial discovery wave 76 — 2026-08-14

## Scope and evidence boundary

This pass tests four previously unregistered sleep or journaling editorial
routes against the direct-product-link, independence, operator and public
contact gates. It does not transmit a message, submit a form, create an account,
attach a file, pay or publish.

## Men’s Health / Isadora Baum — P1 low-probability hold

The current Men’s Health sleep-app article returns HTTP 200, is self-canonical
and exposes `index, follow`. Its SleepScore recommendation links directly to
`https://www.sleepscore.com/` with an empty `rel`. Other commercial app actions
mostly use affiliate redirects marked `nofollow`, so the SleepScore citation is
the narrow qualifying precedent.

The current Men’s Health About page names its editorial team, describes its
reporting and fact-checking rules, asserts editorial independence and links the
Hearst Magazines privacy and terms pages. Isadora Baum's current official
Men’s Health author page links her own site and still shows Men’s Health work
from 2025. Her official site publishes `isadora@isadorabaum.com` and a Chicago
business address.

The route has material weaknesses. The article was published in 2018 and last
modified in December 2019. The author's official HTTPS endpoint currently
fails certificate validation with a self-signed certificate, although its HTTP
page remains publicly readable. The route is therefore recorded as
`qualified_author_route_low_probability_hold`, deferred behind D15 Service95
and D12 Woman & Home. It is not authorized or sent.

## Techinch / Matthew Guay — reject P2

The current apex Techinch page returns HTTP 200, identifies Matthew Guay and
links his December 2025 Wirecutter journaling-app review. Techinch's About page
publishes `maguay@techinch.com`. The `www` hostname currently fails certificate
hostname validation, while the apex certificate works.

The exact Techinch article links Wirecutter and Reproof but no comparable
journaling-app domain. The underlying Wirecutter article uses product redirects
marked `sponsored`, including for Day One and Rosebud, rather than direct
developer-domain citations. The route is rejected as
`rejected_no_direct_product_domain_precedent`. No contact occurred.

## Macworld — reject P2

The current sleep-app page returns HTTP 200, is self-canonical and exposes
`index, follow`. It dates from November 2016, exposes no named author and sends
the Sleep Cycle action through `go.skimresources.com` with `rel="nofollow"`.
The route is rejected as
`rejected_stale_anonymous_affiliate_only_product_link`. No contact occurred.

## Coach — reject P2

The current page returns HTTP 200, is self-canonical and names Nick Harris-Fry,
but it dates from August 2018. Sleep Cycle uses a sponsored affiliate redirect;
direct Calm and Pillow-domain links are `nofollow`, and other comparable
actions are store links. The route is rejected as
`rejected_stale_affiliate_and_nofollow_product_links`. No contact occurred.

## Outcome

The prospect register now contains 323 routes: 3 P0, 77 P1, 242 P2 and 1 P3.
The public-results register remains unchanged. Men’s Health expands the
qualified sleep-editorial reserve but does not displace the D15 Service95 and
D12 Woman & Home authorization pair. No transmission, delivery, reply,
acceptance, publication, backlink, link attribute, indexation, referral traffic
or Ahrefs DR movement is claimed.
