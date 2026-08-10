# Backlink measurement check — 2026-08-10 22:30 CEST

This read-only check verifies the public outcome of the July 31 SaaSHub
product-change submission. The audit used the user-designated real Chrome
session and the two exact public SaaSHub routes. No login, email, form, account
change, payment, publication or product data was used.

## Main profile

URL: `https://www.saashub.com/noctalia-app`

The public profile now exposes the requested product-level corrections:

- an accurate Android dream-journal description;
- freemium and Noctalia Plus pricing with a link to the official press page;
- a direct Google Play link;
- eight relevant product/category tags;
- four existing screenshots;
- an `Officially verified details` marker.

The public outcome therefore shows that the submission produced a material
content update. There is no separate moderation notification in this audit, so
the tracker records the visible outcome rather than claiming a formal approval
message.

The authority gate is not resolved:

- HTTP/rendered route resolves at the expected URL;
- canonical is self-referential;
- robots remains `noindex, follow`;
- the `Visit website` CTA targets `https://noctalia.app/` with an empty `rel`;
- the pricing and footer official-site links are `nofollow`;
- the page contains 21 rendered `Noctalia.app` mentions.

The page remains excluded from indexable referring-page totals despite the
followed-looking primary CTA.

## Alternatives page

URL: `https://www.saashub.com/noctalia-app-alternatives`

The already counted authority route remains intact:

- self-canonical;
- no page-level `noindex` directive;
- H1 `Noctalia.app Alternatives & Competitors`;
- one direct `Visit website` link to `https://noctalia.app/` with empty `rel`;
- the separate official-pricing link remains `nofollow`.

This confirms retention of the existing indexable followed SaaSHub referring
domain. It is not a newly acquired domain or a new DR result.

## Decision

Update the submission state to `public_profile_updated_still_noindex`. Do not
send a second indexation request, add a reciprocal badge, pay for promotion or
record a new backlink. Recheck both routes on 2026-08-24 or sooner only if
SaaSHub sends a material moderation notice.
