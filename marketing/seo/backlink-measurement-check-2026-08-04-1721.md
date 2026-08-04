# Public backlink measurement check — 2026-08-04 17:21 CEST

This was a read-only rerun of `node scripts/check-backlink-results.js --concurrency=3 --timeout-ms=15000` against the 19 rows in `marketing/seo/backlink-results-2026-07-31.csv`. The command does not rewrite the tracker.

## Result

- 19 referring-page rows checked;
- 6 indexable followed pages;
- 4 indexable nofollow pages;
- 2 missing-link pages;
- 3 non-indexable pages;
- 3 HTTP 403 pages;
- 1 HTTP 410 page;
- 4 rows changed or unreachable relative to their expected evidence: Reddit, Chrome Stats, AppBrain and StackScope.

The treatment summary is unchanged from the 2026-08-03 checks. No new public referring page or link-treatment change was observed, and no Ahrefs DR movement is claimed. A sent message, queued deployment or directory qualification is not counted as a backlink.
