# AI Visibility Audit

Date: 2026-03-05
Brand: Noctalia
Domain: https://noctalia.app

## Scope

This audit used live public web search sampling on 2026-03-05 plus a repository review of the static docs site.

It is a visibility proxy, not a logged-in manual run inside ChatGPT, Perplexity, or Google AI Overviews.

## Live query sample

Queries checked:

- `Noctalia app`
- `how to start a dream journal`
- `being chased dreams meaning`
- `sleep paralysis guide`
- `being chased noctalia`
- `sleep paralysis noctalia`

Observed pattern:

- Brand association is weak on `Noctalia app`. Public search results were mixed with unrelated `Noctalia` entities plus third-party listings.
- Generic head terms remain competitive. `Noctalia` did not surface prominently in sampled public results for `how to start a dream journal`, `being chased dreams meaning`, or `sleep paralysis guide`.
- Brand-qualified long-tail works better. `being chased noctalia` and `sleep paralysis noctalia` surfaced Noctalia resources.

Interpretation:

- The site is indexed and retrievable for brand-qualified and page-specific searches.
- It is still underpowered on generic intent queries where AI systems and search engines usually prefer stronger entities and more widely cited publishers.

## Repo findings before changes

- Blog articles already had useful structure: `BlogPosting`, `FAQPage`, `HowTo` on relevant guides, visible publish dates, and strong long-form content.
- The main trust gap was author attribution. Articles were still using organization-only authorship (`Noctalia`) instead of a named person.
- About pages did not expose a strong `Person` entity for the publication lead.
- Many articles lacked a short, answer-first block near the top, which reduces extractability for AI systems.

## Changes implemented

- Added a named author byline to `BlogPosting` pages across all supported languages.
- Updated blog article schema and `article:author` metadata from organization-only attribution to `Thanh Chau` plus `Noctalia`.
- Added a reusable `Quick answer` block near the top of article pages where the long-form template supports it.
- Added an `Editorial review` block and `reviewedBy` `WebPage` markup on health-adjacent articles.
- Expanded about pages with a founder section and an `@graph` that exposes `AboutPage`, `Organization`, and `Person`.
- Added a root command: `npm run docs:fix-eeat-signals`

## Immediate effect expected

- Better entity clarity for authorship and editorial ownership.
- Stronger passage extraction from the first screen of article pages.
- More defensible trust signals on health-adjacent dream and sleep content.

## Recommended next moves

- Create a dedicated author/profile page for `Thanh Chau` instead of routing all author links to the general about page.
- Add direct-answer blocks to the remaining article templates that did not receive the generated quick-answer section.
- Improve the homepage with a more explicit above-the-fold definition of Noctalia as a dream journal app.
- Track a fixed monthly query set across ChatGPT Search, Perplexity, and Google AI Overviews.
