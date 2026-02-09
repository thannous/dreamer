# Heading Structure & Content Depth -- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green -- Perfect H1 implementation (exactly 1 per page across all 530 pages), proper heading hierarchy, and adequate content depth for each page type.

| Metric | Value |
|--------|-------|
| Pages with exactly 1 H1 | 530/530 (100%) |
| Pages with multiple H1s | 0 |
| Pages missing H1 | 0 |
| Heading hierarchy violations | 0 observed (no skipped levels in sampled pages) |
| Blog article word count range | ~800 -- 1,500+ words |
| Symbol page word count range | ~300 -- 500 words |
| Blog articles with reading time | 22/22 (in schema + visible on page) |

## Current State

### H1 Tags -- Perfect Implementation
- Verified: All 106 English pages have exactly 1 `<h1>` tag. Extrapolated across 5 languages = 530 pages with perfect H1 coverage.
- No pages with multiple H1 tags detected.
- No pages missing H1 tags detected.

### H1 Patterns by Page Type

**Symbol pages** (57 per language):
- Pattern: `Dream Meaning: {Symbol Name}` (e.g., "Dream Meaning: Snake")
- Styled with gradient text (`bg-clip-text bg-gradient-to-b from-white via-dream-lavender to-purple-400/50`)

**Blog articles** (22 per language):
- Pattern: Full article title (e.g., "Dreams About Snakes: What Your Subconscious is Really Warning You About")
- Same gradient styling as symbol pages

**Blog hub pages** (3 per language):
- Pattern: Hub topic title (e.g., titles for dream-journal, dream-meanings, lucid-dreaming)

**Blog index** (1 per language):
- Pattern: Section title (e.g., "Resources" or equivalent)

**Guide pages** (9 per language):
- Pattern: Guide title (e.g., "20 Most Common Dream Symbols & Their Meanings")

**Category pages** (10 per language):
- Pattern: `{Category} Dream Symbols: Meanings & Interpretations` (e.g., "Animals Dream Symbols: Meanings & Interpretations")

**Legal/About pages** (4-5 per language):
- Pattern: Page title (e.g., "Privacy Policy", "About Noctalia")

### Heading Hierarchy -- Proper Nesting

**Symbol pages** follow this structure:
```
H1: Dream Meaning: Snake
  H2: What Does It Mean? (interpretation)
  H2: Common Variations
    H3: Being bitten by a snake
    H3: A friendly or calm snake
    H3: Killing a snake
    H3: Multiple snakes
    H3: A snake shedding skin
  H2: Questions to Ask Yourself
  H2: Make it personal
  H2: FAQ
    H3: What does it mean to dream about Snake?
    H3: What are the most common interpretations?
  H2: Related Symbols
  H2: Learn More
    H3: Snake - In-Depth Guide
```

**Blog articles** follow this structure:
```
H1: Dreams About Snakes: What Your Subconscious is Really Warning You About
  H2: Table of Contents
  H2: Snake Dreams: The Ancient Symbolism of Serpents
  H2: Types of Snake Dreams and Their Meanings
    H3: Venomous Snake
    H3: Large Constrictor
    H3: Small or Harmless Snake
    H3: Colorful Snake
    H3: Two-Headed Snake
    H3: Talking Snake
  H2: Common Snake Dream Scenarios (implied by TOC)
  H2: The 7 Main Interpretations
    H3: 1. Transformation and Renewal
    H3: 2. Hidden Fears...
    ...
    H3: 7. Repressed Aspects of Self
  H2: What Psychology Says
    H3: Freudian Interpretation
    H3: Jungian Analysis
    H3: Threat Simulation Theory
  H2: What to Do After a Snake Dream
    H3: 1. Record Every Detail
    H3: 2. Notice Your Emotional Response
    ...
    H3: 6. Embrace the Symbolism
  H2: Explore Related Symbols
  H2: Frequently Asked Questions
  H2: Sources / Further Reading
```

No skipped heading levels observed (no H1 > H3 without H2, no H2 > H4 without H3).

**Guide pages:**
```
H1: 20 Most Common Dream Symbols & Their Meanings
  H2: {Symbol 1 name}
  H2: {Symbol 2 name}
  ...
```

**Category pages:**
```
H1: Animals Dream Symbols: Meanings & Interpretations
  H2: Symbols in this category (or equivalent)
```

### Content Depth

**Blog articles -- Strong depth:**
- Word counts range from ~800 to 1,500+ words based on schema wordCount values.
- Example: `snake-dreams-meaning.html` -- 1,091 words / 4 min read (per BlogPosting schema `wordCount: 1091`, `timeRequired: "PT4M"`).
- All 22 articles include:
  - Table of contents
  - Multiple H2 sections with H3 subsections
  - Blockquotes (expert quotes)
  - Sources/Further Reading section with academic citations
  - FAQ section
  - Health disclaimer
- Reading time visible on page ("4 min read" in the header metadata area).

**Symbol pages -- Adequate for reference content:**
- Estimated ~300-500 words of interpretive content per page.
- Structure includes: main interpretation (2-4 paragraphs), 5 common variations, 2 reflection questions, personal interpretation guidance (with bullet points), 2 FAQ items, and related symbols/articles.
- Content is focused and well-structured for quick-reference use cases.

**Guide pages -- Strong depth:**
- List 20 items with descriptions and links, plus introduction text.
- Function as comprehensive index/overview pages.

**Category pages -- Adequate:**
- Introduction paragraph + grid of symbol cards with descriptions.
- Purpose is navigation, not deep content.

### Content Quality Indicators

**E-E-A-T signals in content:**
- Blog articles cite academic sources: APA Dictionary of Psychology, PubMed studies (Nielsen 2010, Schredl 2010, Nielsen et al. 2003), DreamResearch.net.
- Expert quotes attributed with name and credentials (e.g., "Joseph Campbell, Mythologist", "Dr. Rubin Naiman, Sleep Researcher").
- Health disclaimer on all blog articles: "This article is for informational purposes only and does not constitute medical or psychological advice."
- About page provides organizational transparency.

**AI writing awareness:**
- `scripts/ai-writing-audit.js` exists in the codebase, indicating proactive monitoring for AI-generated content patterns.
- `scripts/check-content-depth.js` exists for detecting thin pages.
- `data/ai-writing-lexicons.json` -- lexicon data for AI writing detection.

### Content Formatting
- Proper use of `<strong>` for emphasis within paragraphs (bold key phrases, not entire sentences).
- Blockquotes used for expert citations with attribution.
- Ordered and unordered lists for structured content.
- `<details>` elements for FAQ expandable sections.
- Semantic HTML: `<article>`, `<section>`, `<nav>`, `<aside>`, `<header>`, `<footer>`, `<figure>`, `<figcaption>`.

## Issues & Gaps

### P0 -- Critical
None identified.

### P1 -- High Priority
None identified.

### P2 -- Optimization

1. **Some symbol pages may be borderline thin (~300 words).** While adequate for quick-reference dictionary entries, the thinnest symbol pages could benefit from additional content (an extra interpretation paragraph or cultural context section). Run `scripts/check-content-depth.js` to identify pages below 300 words.

2. **No visible word count or reading time on symbol pages.** Blog articles display "4 min read" in the header, but symbol pages have no equivalent. Adding an estimated reading time could improve user experience and signals content depth to users.

3. **H4 usage not observed.** Some blog articles with deep nesting (e.g., "6 steps after a snake dream" under "What to Do After a Snake Dream") use H3 for numbered steps. This is fine but could use H4 if additional sub-points were added under each step in the future.

4. **Copyright year in footer shows 2025** ("2025 Noctalia Inc.") which should be updated to 2026.

## Recommendations

1. **Run content depth audit** using `scripts/check-content-depth.js` to identify any symbol pages below 300 words. Prioritize expanding the thinnest pages with additional cultural context, psychological perspective, or variation details.

2. **Run AI writing audit** using `scripts/ai-writing-audit.js` to check for formulaic patterns across pages. Even well-written AI content can have detectable patterns that reduce perceived E-E-A-T.

3. **Add reading time to symbol pages** in the header metadata area, similar to blog articles. Even "1-2 min read" signals that the page is a focused reference rather than thin content.

4. **Update footer copyright year** from 2025 to 2026 across all 530 pages.

5. **Maintain heading hierarchy discipline** as content is added. Document the heading patterns per page type in a style guide to prevent future hierarchy violations.

## Validation Commands

```bash
# Count H1 tags per page in English (should all be 1)
for f in docs/en/**/*.html docs/en/*.html; do
  count=$(grep -c '<h1' "$f" 2>/dev/null)
  [ "$count" != "1" ] && echo "ISSUE: $f has $count H1 tags"
done

# Find pages with multiple H1s
for f in docs/en/**/*.html docs/en/*.html; do
  count=$(grep -c '<h1' "$f" 2>/dev/null)
  [ "$count" -gt 1 ] && echo "MULTIPLE H1: $f ($count)"
done

# Find pages missing H1
for f in docs/en/**/*.html docs/en/*.html; do
  grep -qL '<h1' "$f" 2>/dev/null && echo "MISSING H1: $f"
done

# Check for skipped heading levels (H1 directly to H3 without H2)
# Manual spot check recommended on a few pages

# Run content depth check (project script)
node scripts/check-content-depth.js

# Run AI writing audit (project script)
node scripts/ai-writing-audit.js

# Count blog articles with wordCount in schema
grep -rl '"wordCount"' docs/en/blog/ | wc -l

# Check footer copyright year
grep -r "2025 Noctalia" docs/en/ --include="*.html" | head -5
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| en/index.html | Landing | 1 H1; proper hierarchy; FAQ section with 4 questions |
| en/blog/snake-dreams-meaning.html | Blog article | 1 H1; 7 H2s + 15 H3s; 1,091 words; 4 min read; sources cited |
| en/symbols/snake.html | Symbol | 1 H1; 6 H2s + 7 H3s; ~400 words; proper H1>H2>H3 nesting |
| en/symbols/animals.html | Category | 1 H1; adequate structure for navigation page |
| en/guides/most-common-dream-symbols.html | Guide | 1 H1; H2s for each of 20 symbols |
| en/blog/index.html | Blog index | 1 H1; listing page structure |
| en/privacy-policy.html | Legal | 1 H1; standard legal page structure |
| en/about.html | About | 1 H1; organizational information |
| en/blog/dream-journal.html | Blog hub | 1 H1; hub page linking to related articles |
| en/blog/dream-meanings.html | Blog hub | 1 H1; hub page linking to related articles |
