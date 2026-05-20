# Noctalia 90-Day SEO Execution Log - 2026-05-20

## Published Scope

- Rebuilt the multilingual dream journal app comparison page.
- Added multilingual DreamApp alternative pages.
- Added multilingual Oniri alternative pages.
- Added multilingual AI dream interpretation app pages.
- Expanded the dream-symbol dictionary from 62 to 150 symbols.
- Updated `llms.txt` with comparison, alternative, category, and dictionary URLs.
- Added a clearer privacy summary to the privacy policy pages.
- Prepared Google Play ASO copy, screenshot priorities, localized keyword angles, and review prompts.

## Baseline To Record After Publication

Record the publication date and deployed commit, then export Search Console when data is available.

```bash
npm run seo:gsc:export
```

Use the generated `marketing/seo/search-console/<start>_to_<end>/action-plan.md` as the weekly working document.

## J+7 Measurement

- Check whether the new pages appear in Search Console.
- Check impressions for:
  - `dream journal apps`
  - `DreamApp alternative`
  - `Oniri alternative`
  - `AI dream interpretation app`
  - top new symbol queries
- Identify pages with impressions and CTR below 1%.
- Adjust only titles/metas or intro copy first unless the page clearly misses intent.

## J+14 Measurement

- Compare page-level impressions and indexed symbol pages against J+7.
- Review query/page pairs where the ranking URL is unexpected.
- Add internal links from blog posts to the strongest new symbol pages.
- If symbol pages with impressions have no clicks, add a clearer first paragraph and FAQ answer.

## J+30 Measurement

- Decide whether to publish the next symbol batch or improve the first batch.
- Compare Google Play clicks from the site with store listing installs.
- Update Google Play screenshots or short description if store conversion lags web clicks.
- Refresh competitor facts for DreamApp, Oniri, Dreamiary, Dreamlab, Dreamz, DreamStream, DreamMirror, DreamNotes, DreamKit, and Rosebud.

## Monthly Competitive Refresh

- Re-check public store ratings, downloads, pricing, platforms, and privacy disclosures.
- Update source links and visible modified dates on comparison pages when facts change.
- Keep competitor strengths visible; avoid claims that cannot be verified from public sources.

## Non-Automated Items

- Google Play listing edits must be applied manually in Play Console.
- Review campaign execution requires real user outreach and should not be simulated.
- Search Console sitemap submission requires authenticated API/UI access after deployment.
