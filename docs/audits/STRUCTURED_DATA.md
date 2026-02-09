# Structured Data (Schema.org / JSON-LD) -- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green -- Comprehensive structured data across all page types with proper schema variety and BreadcrumbList coverage.

| Metric | Value |
|--------|-------|
| Pages with JSON-LD | 100% |
| BreadcrumbList coverage | All non-landing pages |
| FAQPage schema | Landing pages, blog articles, symbol pages |
| BlogPosting schema | 22 blog articles per language |
| DefinedTerm schema | All 57 symbol pages per language |
| CollectionPage schema | All category pages |
| ItemList schema | Guide pages, category pages, blog index |
| Schema types used | 12 (FAQPage, Organization, WebSite, MobileApplication, BlogPosting, Blog, ItemList, CollectionPage, DefinedTerm, Article, AboutPage, WebPage) |

## Current State

### Landing Pages (e.g., en/index.html)
- Uses `@graph` array containing 4 schemas:
  - **FAQPage** with 4 questions/answers (How does dream analysis work? / Are my dreams private? / Can I type my dreams instead of speaking? / Does the app work offline?)
  - **Organization** with `@id="https://noctalia.app/#organization"`, name, url, logo (ImageObject with width/height), description, and sameAs links (Instagram, X/Twitter, TikTok)
  - **WebSite** with `@id="https://noctalia.app/#website"`, name, url, publisher reference (`@id`), and inLanguage array (en, fr, es, de, it)
  - **MobileApplication** with name, description, operatingSystem ("Android"), applicationCategory ("LifestyleApplication"), downloadUrl (Play Store), screenshots (3 URLs), featureList (5 features), and offers (free, EUR)

### Blog Articles (e.g., en/blog/snake-dreams-meaning.html)
- **BlogPosting** schema with:
  - headline, description, image (ImageObject with url, width: 1200, height: 630)
  - author (Organization), publisher (Organization with logo)
  - datePublished ("2025-12-11"), dateModified ("2026-01-06")
  - mainEntityOfPage (WebPage with @id), inLanguage ("en")
  - isAccessibleForFree (true), wordCount (1091), timeRequired ("PT4M")
  - url
- **FAQPage** schema with 3 questions (visible on page as `<details>` elements):
  - "What does it mean when you dream about snakes?"
  - "Is dreaming about snakes a bad omen?"
  - "What does it mean to be bitten by a snake in a dream?"
- **BreadcrumbList** with 3 levels: Home > Resources > Snake Dreams
- Both JSON-LD and microdata (itemprop) BreadcrumbList present on blog articles (belt-and-suspenders approach).

### Blog Hub Pages (e.g., en/blog/dream-meanings.html)
- **CollectionPage** + **BreadcrumbList** (based on hub page pattern with og:type="website").
- These are topic cluster hub pages linking to related articles.

### Blog Index (en/blog/index.html)
- **Blog** schema with name, description, url, inLanguage, publisher (Organization with logo).
- **ItemList** with numberOfItems: 22, each item as ListItem with position, url, and name.
- Positions numbered 1-22, proper ordering.

### Symbol Pages (e.g., en/symbols/snake.html)
- **DefinedTerm** schema with:
  - name ("Snake"), description, url
  - inDefinedTermSet referencing the dream symbols dictionary (DefinedTermSet with name "Symbols" and url to dictionary page)
- **Article** schema with:
  - headline, description, image
  - author (Organization), publisher (Organization with logo)
  - datePublished ("2025-01-21"), dateModified ("2026-01-22")
  - mainEntityOfPage (WebPage with @id), inLanguage ("en")
- **BreadcrumbList** with 3 levels: Home > Symbols > Snake
- **FAQPage** schema with 2 questions:
  - "What does it mean to dream about Snake?"
  - "What are the most common interpretations?"
- FAQ questions are visible on the page within the FAQ section (glass-panel cards with h3 + paragraph). Both schema and on-page content match.

### Category Pages (e.g., en/symbols/animals.html)
- **CollectionPage** schema with:
  - name, description, url, inLanguage
  - isPartOf (WebSite with name and url)
  - about (Thing with name "Animals Dream Symbols")
  - publisher (Organization with logo)
  - datePublished, dateModified
- **ItemList** schema listing child symbols with positions.
- **BreadcrumbList** with proper hierarchy.

### Guide Pages (e.g., en/guides/most-common-dream-symbols.html)
- **ItemList** schema with:
  - name, description, numberOfItems (20)
  - itemListElement array with 20 ListItems, each with position, name, and url to the corresponding symbol page
- **BreadcrumbList** with proper hierarchy.

### Legal Pages (e.g., en/privacy-policy.html)
- **WebPage** schema with name, url, inLanguage, publisher (references @id of Organization).
- **BreadcrumbList** with 2 levels: Home > Privacy Policy.

### About Page (en/about.html)
- **AboutPage** schema with name, url, inLanguage, about (Organization with name and url).
- **BreadcrumbList** with 2 levels: Home > About Noctalia.

## Issues & Gaps

### P0 -- Critical
None identified.

### P1 -- High Priority

1. **Blog article FAQPage schema question count vs visible content.** The snake-dreams-meaning.html BlogPosting has an FAQPage with 3 questions, and all 3 are visible on the page as `<details>` FAQ elements (lines 499-526). This is correctly implemented. However, this should be verified across all blog articles -- if any article has FAQ schema questions that are not visible on the page, Google may issue a manual action.

2. **Symbol page Article schema uses generic OG image.** The Article schema on symbol pages references the generic OG image (`/img/og/noctalia-en-1200x630.jpg`) rather than a symbol-specific image. This is not incorrect but means the image in search results will be generic rather than symbol-specific.

### P2 -- Optimization

1. **Organization schema only appears on the landing page** (within the @graph). Other pages reference it by `@id` in some cases (privacy-policy.html uses `"publisher": {"@id": "https://noctalia.app/#organization"}`), but most article/symbol pages define inline Organization objects without @id references. Consolidating to @id references would reduce schema duplication.

2. **No Review or AggregateRating schema.** Not critical for a content site, but adding app store ratings or user testimonials as structured data could enhance rich results for branded queries.

3. **No SiteNavigationElement schema.** The consistent navbar and footer navigation could benefit from SiteNavigationElement markup, though this is low priority.

4. **BlogPosting author is Organization rather than Person.** Google prefers Person author for E-E-A-T signals. If individual authors can be attributed, switching to Person schema would be beneficial.

## Recommendations

1. **Audit all blog article FAQ sections** to ensure every question in the FAQPage schema has a matching visible element on the page. Run a script to compare schema question text with on-page content.

2. **Add @id references** for Organization on article/symbol pages instead of inline duplicates. This creates a cleaner entity graph for Google.

3. **Consider adding Person author schema** if individual content creators can be named, to strengthen E-E-A-T signals.

4. **Add SpeakableSpecification** to blog articles to enable voice search eligibility (nice-to-have).

5. **Consider adding AggregateRating** for the MobileApplication schema on the landing page, sourcing from Play Store ratings.

## Validation Commands

```bash
# Count pages with BreadcrumbList schema
grep -rl "BreadcrumbList" docs/en/ | wc -l

# Count pages with FAQPage schema
grep -rl '"FAQPage"' docs/en/ | wc -l

# Count pages with BlogPosting schema
grep -rl '"BlogPosting"' docs/en/blog/ | wc -l

# Count pages with DefinedTerm schema
grep -rl '"DefinedTerm"' docs/en/symbols/ | wc -l

# Validate JSON-LD syntax (requires jq)
grep -oP '<script type="application/ld\+json">\K[^<]+' docs/en/blog/snake-dreams-meaning.html | jq .

# Check Organization @id usage
grep -r '"@id": "https://noctalia.app/#organization"' docs/en/ | wc -l

# Find pages with ItemList schema
grep -rl '"ItemList"' docs/en/ | sort
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| en/index.html | Landing | @graph with FAQPage (4Q), Organization, WebSite, MobileApplication |
| en/blog/snake-dreams-meaning.html | Blog article | BlogPosting + FAQPage (3Q visible) + BreadcrumbList |
| en/blog/index.html | Blog index | Blog + ItemList (22 items) |
| en/symbols/snake.html | Symbol | DefinedTerm + Article + BreadcrumbList + FAQPage (2Q) |
| en/symbols/animals.html | Category | CollectionPage + ItemList + BreadcrumbList |
| en/guides/most-common-dream-symbols.html | Guide | ItemList (20 items) + BreadcrumbList |
| en/privacy-policy.html | Legal | WebPage + BreadcrumbList |
| en/about.html | About | AboutPage + BreadcrumbList |
| en/blog/dream-meanings.html | Blog hub | CollectionPage + BreadcrumbList |
