# Backlink measurement check — 2026-08-04 18:22 CEST

This was a read-only run of `npm run seo:backlinks:check` from the isolated SEO worktree. It did not modify the tracker and did not contact any publisher.

## Summary

The verifier checked 19 recorded public surfaces:

| State | Count |
| --- | ---: |
| Indexable + followed | 6 |
| Indexable + nofollow | 4 |
| Expected link missing | 2 |
| Non-indexable | 3 |
| HTTP 403 / unverified | 3 |
| HTTP 410 / retired | 1 |

## Changed or unreachable surfaces

- Reddit still lacks the expected `https://noctalia.app/` link.
- Chrome Stats and AppBrain remain HTTP 403, so link treatment is unverified.
- StackScope remains non-indexable.
- APKPure remains HTTP 410 and is treated as a retired historical listing.

No new public referring page, followed link, referring domain or Domain Rating movement was observed. The measurement is separate from the current four-language press asset rollout: those first-party pages are now public and citable, but they are not external backlinks.
