# Noctalia backlink clean baseline — 2026-08-13 00:49 CEST

This read-only reset was run from the isolated
`codex/backlinks-baseline-20260813` worktree at current `origin/master`
`553cc4077`. It did not submit a form, send a message, sign in, edit an
account, upload a file, request indexing, publish content or spend money.
Dealroom remains retired.

## Automated public result

`npm run seo:backlinks:check -- --json` checked all nineteen tracked referring
pages and returned:

| Observed treatment | Pages |
| --- | ---: |
| Followed | 6 |
| Nofollow | 4 |
| Missing link | 2 |
| Non-indexable | 3 |
| HTTP 403 | 3 |
| HTTP 410 | 1 |

The six followed pages remain LaunchLlama, SaaSHub Alternatives, PeerPush,
JunkStartups, DroidSpy and Tham Hiem Mekong. This is retention of existing
links, not acquisition of six new links. JunkStartups remains Ahrefs-labelled
spam, DroidSpy remains DR 0 with an insufficiently accountable operator, and
Tham Hiem Mekong remains weakly relevant and low trust. PeerPush is still the
only previously measured clean high-DR followed domain.

## Rendered reconciliation

The user-designated real Chrome was used only for the four automated
mismatches:

- Reddit renders the public Noctalia post and a direct
  `https://noctalia.app/` anchor with `rel="noopener nofollow ugc"`. Its
  automated application shell omits the anchor, so the rendered evidence is
  authoritative for this dynamic page.
- Chrome-Stats and AppBrain return HTTP 403 to the verifier. Direct real-Chrome
  navigation produced no inspectable page under the browser safety policy.
  Their 2026-08-03 nofollow renders remain historical evidence only; current
  indexability and link treatment are downgraded to unverified.
- StackScope currently returns HTTP 200, a self-canonical, `noindex, follow`
  directives and no Noctalia anchor. The page is non-indexable and contributes
  no verified link.

After the rendered Reddit reconciliation, the current verified inventory is
6 followed, 5 nofollow and 3 non-indexable pages. Three HTTP 403 surfaces, one
missing-link surface and one HTTP 410 surface remain outside those authority
totals.

## Measurement boundary

No authenticated Ahrefs or Search Console dashboard was opened in this pass.
The last measured Ahrefs value therefore remains DR 0.1 on 2026-08-10, not a
new 2026-08-13 reading. No causal attribution is made to a message, commit,
deployment or individual referring page.

## Decision

1. Preserve the six reproducible followed pages; do not buy upgrades or add
   reciprocal badges.
2. Exclude Chrome-Stats and AppBrain from current followed/nofollow totals
   until a future safe rendered check succeeds.
3. Keep StackScope, Zearches and APKPure outside authority totals.
4. Keep AI Tools Inc pending until its scheduled 2026-08-30 public check; do
   not resubmit or pay.
5. Move the next authorized effort toward accountable topical editorial
   citations rather than additional generic directory profiles.
