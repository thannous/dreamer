# Noctalia priority URL inspection - 2026-06-23

Scope: late-June editorial sprint priority URLs across `fr`, `en`, `es`, `de`, `it`.

## Actions

- Deployed validated `docs/` to Cloudflare Pages production branch `master`.
- Verified live `https://noctalia.app/version.txt` is `20260623-112558`.
- Verified live markers for:
  - dreams and creativity June 2026 refresh;
  - dream-control/problem-solving June 2026 refresh;
  - lucid-dreaming 55,000-dream corpus block.
- Submitted `https://noctalia.app/sitemap.xml` to Search Console through the Search Console API.
- Inspected 25 priority URLs through the URL Inspection API.
- Requested indexing in the Search Console UI for the 6 follow-up URLs below.

## Search Console Summary

- Submitted and indexed: 19
- Discovered, currently not indexed: 3
- Crawled, currently not indexed: 2
- Unknown to Google: 1

The 6 non-indexed / unknown URLs below were added to Google's priority crawl queue through the Search Console UI.

## Recheck - 2026-06-23 11:55 CEST

The 25 priority URLs were inspected again through the Search Console API with quota project `clawdeals`.

- Submitted and indexed: 25
- Indexing allowed: 25
- Robots.txt allowed: 25

Conclusion: the six follow-up URLs are no longer blocking; keep only a light spot-check before the next editorial publication wave.

## Initial Follow-up - Resolved on Recheck

| Priority | URL | Search Console state | Note |
| --- | --- | --- | --- |
| P0 | `https://noctalia.app/es/blog/ola-calor-sueno-suenos` | URL is unknown to Google | Indexing requested in GSC UI; submitted and indexed on 11:55 recheck. |
| P0 | `https://noctalia.app/fr/blog/canicule-sommeil-reves` | Discovered - currently not indexed | Indexing requested in GSC UI; submitted and indexed on 11:55 recheck. |
| P0 | `https://noctalia.app/de/blog/hitzewelle-schlaf-traeume` | Discovered - currently not indexed | Indexing requested in GSC UI; submitted and indexed on 11:55 recheck. |
| P0 | `https://noctalia.app/it/blog/ondata-calore-sonno-sogni` | Discovered - currently not indexed | Indexing requested in GSC UI; submitted and indexed on 11:55 recheck. |
| P1 | `https://noctalia.app/de/blog/traeume-und-kreativitaet` | Crawled - currently not indexed | Indexing requested in GSC UI; submitted and indexed on 11:55 recheck. |
| P1 | `https://noctalia.app/fr/blog/controler-reves-resolution-problemes` | Crawled - currently not indexed | Indexing requested in GSC UI; submitted and indexed on 11:55 recheck. |

## Indexing Requests Sent

- `https://noctalia.app/es/blog/ola-calor-sueno-suenos`
- `https://noctalia.app/fr/blog/canicule-sommeil-reves`
- `https://noctalia.app/de/blog/hitzewelle-schlaf-traeume`
- `https://noctalia.app/it/blog/ondata-calore-sonno-sogni`
- `https://noctalia.app/de/blog/traeume-und-kreativitaet`
- `https://noctalia.app/fr/blog/controler-reves-resolution-problemes`

## Already Indexed

- `https://noctalia.app/en/blog/heatwave-sleep-dreams`
- `https://noctalia.app/fr/blog/confidentialite-ia-journal-reves`
- `https://noctalia.app/en/blog/ai-dream-journal-privacy`
- `https://noctalia.app/es/blog/privacidad-ia-diario-suenos`
- `https://noctalia.app/de/blog/ki-traumtagebuch-datenschutz`
- `https://noctalia.app/it/blog/privacy-ia-diario-sogni`
- `https://noctalia.app/fr/blog/reves-et-creativite`
- `https://noctalia.app/en/blog/dreams-and-creativity`
- `https://noctalia.app/es/blog/suenos-y-creatividad`
- `https://noctalia.app/it/blog/sogni-e-creativita`
- `https://noctalia.app/en/blog/dream-control-problem-solving`
- `https://noctalia.app/es/blog/controlar-suenos-resolucion-problemas`
- `https://noctalia.app/de/blog/traumkontrolle-problemloesung`
- `https://noctalia.app/it/blog/controllare-sogni-risoluzione-problemi`
- `https://noctalia.app/fr/blog/reve-lucide`
- `https://noctalia.app/en/blog/lucid-dreaming`
- `https://noctalia.app/es/blog/suenos-lucidos`
- `https://noctalia.app/de/blog/klares-traeumen-anleitungen-und-techniken`
- `https://noctalia.app/it/blog/sogni-lucidi-guide-e-tecniche`

## Limitation

The Search Console API supports sitemap submission and URL inspection. It does not expose the UI-only "request indexing" action for ordinary web pages, so the six requests above were sent through the Search Console UI after user authorization.
