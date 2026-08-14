# Editorial discovery wave 73 — 2026-08-14

## Scope and evidence boundary

This pass performs a passive public-result check on ten already-contacted P1
pages and applies the current direct-domain, accountable-operator and
brand-safety gates to two newly discovered thematic pages plus one previously
qualified route that required stricter brand-safety revalidation. It does not
access the mailbox, transmit a message or change any result state.

## Passive public-result check

The following exact pages returned HTTP 200 and exposed no clickable Noctalia
anchor in their current HTML:

- Penzu dream journal;
- AllThingsAI homepage;
- Mattress Miracle dream-journal-app guide;
- Sleepopolis dream-app article;
- Holstee journaling-app guide;
- Gratitude Genie Android journaling-app guide;
- Android Police Pixel Journal alternatives;
- Sleep Review's Mintal dream feature.

The Android Police HTML serialized the request user-agent string, which included
the word `Noctalia`; those two machine-generated occurrences were telemetry,
not editorial mentions or anchors. Sleep.com's dream-journal page returned HTTP
403, so its current content is indeterminate rather than negative proof.

The checked KapanLagi article returned HTTP 200 and still names Noctalia eight
times in its serialized and rendered source material. Its source list prints
`https://noctalia.app/en/blog/water-dreams-meaning` as text but exposes zero
clickable Noctalia anchors. This remains an unlinked deep-URL mention, not a
backlink result.

## Genevieve Camp — reject P2

The January 2026 first-hand Elsewhere review is HTTP 200, self-canonical and
indexable. It names Genevieve Camp and links four public Elsewhere dream pages
without `nofollow`. The site publishes an official work address and identifies
Genevieve Camp LMHC LLC; public Florida records identify the entity as active.

Those are strong topical, link-pattern and accountability signals, but the
surrounding site materially conflicts with Noctalia's brand boundary. It
promotes astrology, karma resolution, spiritual guides, trauma-oriented
coaching and precognitive dream categories. The route is therefore rejected as
`rejected_spiritual_clinical_brand_mismatch`. No contact occurred.

## Tripsitter — reject P2

The exact dream-journaling guide is HTTP 200, self-canonical and `index, follow`,
names its author and contains a detailed app section. The current HTML does not
link the listed apps to their developer domains; the only adjacent external
Notion dream-template link is `nofollow`.

The publication also centers psychedelics and potentially dangerous dream-herb
content. The combined absence of a direct product-domain precedent and the
brand-safety mismatch closes the route. No contact occurred.

## Foreword Reviews — reject P2

Search-visible copy describes a Kelly Bulkeley interview and his work with
Elsewhere, but a fresh direct fetch of the exact page returns HTTP 403 with
`noindex,nofollow`. No current product anchor can be verified. The mention is
also supplied by the interview subject, who describes his own Elsewhere work,
rather than an independent product evaluation. No contact occurred.

## Outcome

The prospect register now contains 314 routes: 3 P0, 76 P1, 234 P2 and 1 P3.
The public-results register remains unchanged. No transmission, delivery,
reply, acceptance, linked publication, link attribute, referral traffic or
Ahrefs DR movement is claimed.
