# E-E-A-T & Trust Signals --- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Yellow --- The site has adequate medical disclaimers, source citations in blog articles, and complete legal information. However, it lacks individual author bios with credentials, editorial process documentation, and expert review claims --- key E-E-A-T signals for YMYL-adjacent content about dream psychology and mental health.

| Metric | Value |
|--------|-------|
| Author attribution | Organization only ("Noctalia"), no individual authors |
| About page | Present in all 5 languages, identifies publisher (TiMax), director (Thanh Chau), contact email |
| Legal notice | SIREN/SIRET: 99531698100019, Orleans France, sole proprietorship |
| Medical disclaimer (Terms) | "Important medical notice" alert box: "Noctalia is not a medical device" |
| Medical disclaimer (Blog) | Footer disclaimer on all blog articles: "does not constitute medical or psychological advice" |
| Medical disclaimer (About) | "Our content is for informational purposes only and does not replace medical advice" |
| Source citations | Blog articles include "Sources / Further Reading" with PubMed, APA, academic references |
| Expert quotes in articles | Named researchers cited (Dr. Deirdre Barrett, Dr. Thomas Kilduff, Dr. Antonio Zadra, etc.) |
| Privacy policy | GDPR-compliant, identifies Data Controller, EU hosting (Supabase Western Europe) |
| Social media presence | Instagram, X/Twitter, TikTok (@noctaliadreams) in Organization schema |
| User testimonials | None visible on site |
| Editorial process documentation | None |

## Current State

### Author Attribution
All content is attributed to the organization "Noctalia" rather than individual authors:
- Blog articles: `<meta content="Noctalia" property="article:author"/>`
- Schema.org structured data:
  ```json
  "author": {
    "@type": "Organization",
    "name": "Noctalia",
    "url": "https://noctalia.app",
    "logo": { "@type": "ImageObject", "url": "https://noctalia.app/logo/logo_noctalia.png" }
  }
  ```
- No individual author names, bios, or credentials appear on any content page.

### About Page
The about page (`en/about.html`, present in all 5 languages) provides:
- **Publisher identification**: TiMax (sole proprietorship in France)
- **Publication director**: Thanh Chau
- **Contact**: contact@noctalia.app
- **Content methodology statement**: "Our blog and guides are written to be clear, practical, and grounded in well-established concepts from sleep research and psychology. When we reference studies or institutions, we link to the original sources."
- **Medical disclaimer**: "Our content is for informational purposes only and does not replace medical advice."
- **Privacy reference**: Links to the privacy policy
- **Contact section**: Direct email for questions, feedback, or corrections

### Legal Notice
The legal notice (`en/legal-notice.html`, localized in all 5 languages) provides:
- **Publisher**: TiMax
- **Legal status**: Sole proprietorship established in France
- **Address**: Orleans, France
- **SIREN/SIRET**: 99531698100019
- **Publication director**: Thanh Chau
- Schema.org `WebPage` type with BreadcrumbList structured data

### Medical Disclaimers

**Terms of Use** (`en/terms.html`) includes a prominent red alert box:
```
Important medical notice
Noctalia is a wellbeing and self-discovery app. It is not a medical device.
AI insights are recreational and reflective only. They never replace professional medical,
psychological, or psychiatric advice. If you experience sleep disorders or distress,
contact a qualified healthcare professional.
```

**Blog articles** include a footer disclaimer (verified on `en/blog/snake-dreams-meaning.html`):
```
Important: This article is for informational purposes only and does not constitute medical
or psychological advice. If you experience persistent sleep disturbances or mental health
concerns, please consult a qualified healthcare professional.
```

**About page** includes: "Our content is for informational purposes only and does not replace medical advice."

### Source Citations
Blog articles include a "Sources / Further Reading" section at the bottom (added via TI-97 script). Example from `en/blog/snake-dreams-meaning.html`:
- APA Dictionary of Psychology: Dream (dictionary.apa.org)
- Nielsen (2010): Dream analysis and classification (PubMed: 20416888)
- DreamResearch.net: G. William Domhoff (dream research overview)
- Schredl (2010): Frequency of typical dream themes (PubMed: 20620045)
- Nielsen et al. (2003): Typical dreams and common themes (PubMed: 12927121)

These are presented as a list with `rel="nofollow noopener noreferrer"` external links. Each includes a "Last updated" date.

### Expert Quotes
Blog articles include named expert quotes throughout the content body:
- **Dr. Deirdre Barrett**, Harvard Dream Researcher (cited in dream-incubation-guide, being-chased-dreams)
- **Dr. Thomas Kilduff**, Sleep Researcher (cited in why-we-forget-dreams)
- **Dr. Robert Stickgold**, Sleep Neuroscience Researcher, Harvard Medical School (cited in why-we-forget-dreams)
- **Dr. Antonio Zadra**, Dream Researcher (cited in teeth-falling-out-dreams)
- **Dr. Calvin Yu**, Sleep Researcher (cited in teeth-falling-out-dreams)
- **Dr. Lauri Loewenberg**, Dream Analyst (cited in being-chased-dreams)

These quotes are embedded inline with attribution but without links to researcher profiles or institutional affiliations beyond the name and title.

### Privacy & Trust
- **Privacy policy** (`en/privacy-policy.html`): GDPR-compliant, identifies TiMax as Data Controller, describes data processing purposes, mentions EU hosting (Supabase Western Europe)
- **Account deletion page**: Available in all 5 languages, providing transparency about data removal
- **Organization schema** on homepage includes `sameAs` links to social profiles:
  - Instagram: `https://www.instagram.com/noctaliadreams/`
  - X/Twitter: `https://x.com/NoctaliaDreams`
  - TikTok: `https://www.tiktok.com/@noctaliadreams`

### Structured Data Trust Signals
- `Organization` schema with logo, URL, and social profiles
- `BlogPosting` schema with author (Organization), publisher, dates, word count, time required
- `FAQPage` schema on homepage and blog articles
- `BreadcrumbList` schema on all interior pages
- `MobileApplication` schema on homepage

## Issues & Gaps

### P0 --- Critical

None identified.

### P1 --- High Priority

1. **No individual author bios or credentials**: All content is credited to "Noctalia" as an organization. Google's E-E-A-T guidelines strongly favor identifiable authors with visible credentials, especially for YMYL-adjacent topics (dream psychology, mental health connections, sleep science). Blog articles that discuss topics like "Dreams and Mental Health," "Sleep Paralysis," and "REM Sleep" touch on health-related subjects where author expertise is a ranking factor.

2. **No editorial process documentation**: The about page states content is "grounded in well-established concepts from sleep research and psychology" but does not describe:
   - Who researches and writes the articles
   - Whether content is reviewed by qualified experts
   - What editorial standards are applied
   - How accuracy is verified

3. **No author expertise credentials visible**: Thanh Chau is listed as Publication Director but no qualifications, education, or relevant expertise are shown. There is no "Our Team" section or author profile pages.

### P2 --- Optimization

1. **Sources presented as "Further Reading" rather than inline citations**: Academic references are grouped at the bottom of articles rather than cited inline where claims are made. Inline citations (e.g., superscript numbers linking to references) would present a more authoritative style.

2. **No content methodology page**: While the about page briefly mentions the approach, a dedicated "How We Write" or "Editorial Guidelines" page would strengthen E-E-A-T signals. This could describe research methods, fact-checking processes, and update frequency.

3. **No expert review claims**: Articles do not include statements like "Reviewed by a licensed psychologist" or "Fact-checked by a sleep researcher." Even if articles are reviewed, this is not communicated to users or search engines.

4. **No testimonials or user reviews visible**: The site does not display any user testimonials, app store reviews, or social proof beyond social media profile links. App store ratings could be surfaced on the homepage.

5. **Expert quotes lack institutional links**: While named researchers are quoted, their names are not linked to their institutional profiles, Google Scholar pages, or published works. Adding these links would strengthen the credibility chain.

6. **No `author` Person schema in blog structured data**: The schema uses `@type: Organization` for author. Adding a `Person` schema with name, credentials, and sameAs links would better satisfy E-E-A-T signals in structured data:
   ```json
   "author": {
     "@type": "Person",
     "name": "Thanh Chau",
     "jobTitle": "Founder",
     "url": "https://noctalia.app/en/about"
   }
   ```

## Recommendations

1. **Create individual author profiles.** Add an author bio section to each blog article with at minimum:
   - Author name and photo
   - Brief bio with relevant credentials or experience
   - Link to an author profile page
   - Update schema.org author from `Organization` to `Person` (or include both)

2. **Add an "Editorial Guidelines" section to the about page** (or create a dedicated page) describing:
   - How articles are researched (academic sources, expert consultation)
   - Content review process
   - Update and accuracy-checking methodology
   - Any expert advisors or reviewers

3. **Add "Reviewed by" attributions to health-adjacent articles.** For articles touching on mental health, sleep science, or medical topics (at minimum: `dreams-mental-health`, `sleep-paralysis-guide`, `rem-sleep-dreams`, `stop-nightmares-guide`), add a visible "Reviewed by [Name], [Credential]" line.

4. **Convert "Further Reading" sections to inline citations.** Add superscript reference numbers at the point of claim in article text, linking to the corresponding source at the bottom. This demonstrates that specific claims are backed by specific sources.

5. **Surface app store ratings on the homepage.** Add an `AggregateRating` to the `MobileApplication` schema and display the rating visually to provide social proof.

6. **Link expert quotes to researcher profiles.** When citing Dr. Deirdre Barrett or Dr. Robert Stickgold, link their names to their institutional profile pages or published works.

## Validation Commands

```bash
# Check author attribution in blog articles
grep -r "article:author" docs/en/blog/ --include="*.html" | head -5
# Expected: all show "Noctalia"

# Check for Person schema type in author field
grep -r '"@type": "Person"' docs/en/blog/ --include="*.html" | wc -l
# Expected: 0 (currently Organization only)

# Verify medical disclaimers in Terms
grep -c "medical device\|medical notice" docs/en/terms.html
# Expected: 2+

# Verify blog article disclaimers
grep -rl "informational purposes only" docs/en/blog/ --include="*.html" | wc -l
# Expected: 23 (all blog articles)

# Check Sources sections in blog articles
grep -rl "Sources / Further Reading" docs/en/blog/ --include="*.html" | wc -l
# Expected: 23

# Verify expert quotes in articles
grep -r "Dr\." docs/en/blog/ --include="*.html" | wc -l

# Check Organization schema
grep -l '"@type": "Organization"' docs/en/index.html

# Verify SIREN/SIRET in legal notice
grep "99531698100019" docs/en/legal-notice.html
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `en/about.html` | About page | Publisher identified (TiMax, Thanh Chau), medical disclaimer present, no individual author bios |
| `en/legal-notice.html` | Legal page | SIREN/SIRET present, address, legal status complete |
| `en/terms.html` | Terms page | Prominent red medical notice alert, "not a medical device" disclaimer |
| `en/privacy-policy.html` | Privacy page | GDPR-compliant, Data Controller identified, EU hosting mentioned |
| `en/blog/snake-dreams-meaning.html` | Blog article | Sources/Further Reading section with 5 academic references, footer medical disclaimer, author = Organization |
| `en/blog/why-we-forget-dreams.html` | Blog article | Expert quotes (Dr. Kilduff, Dr. Stickgold), PubMed citations, medical disclaimer |
| `en/blog/dream-incubation-guide.html` | Blog article | Dr. Deirdre Barrett cited with Harvard affiliation, sources section present |
| `en/blog/being-chased-dreams.html` | Blog article | Two named experts cited (Dr. Barrett, Dr. Loewenberg), footer disclaimer |
| `en/blog/teeth-falling-out-dreams.html` | Blog article | Dr. Zadra and Dr. Yu cited, sources section present |
| `en/index.html` | Homepage | Organization schema with social sameAs, MobileApplication schema, no testimonials |
