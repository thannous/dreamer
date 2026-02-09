# International SEO --- Noctalia SEO Audit

**Date:** 2026-02-09 | **Scope:** Full site (530 pages, 5 languages) | **Domain:** noctalia.app

---

## Executive Summary

**Health Score:** Green --- International SEO implementation is thorough with complete hreflang clusters, localized slugs, correct `<html lang>` attributes, and perfect content parity across all 5 languages.

| Metric | Value |
|--------|-------|
| Languages supported | 5 (EN, FR, ES, DE, IT) |
| Pages per language | 106 |
| Total pages | 530 |
| html lang attribute correctness | 100% |
| Hreflang clusters complete (5 langs + x-default) | 100% |
| Slug localization | Full (symbols, blog, legal pages) |
| og:locale correctness | 100% (en_US, fr_FR, es_ES, de_DE, it_IT) |
| Sitemap hreflang annotations | Present, mirrors in-page annotations |
| Content parity | 106 files per language, identical structure |

## Current State

### Language Structure
The site maintains perfect parity across all 5 languages with 106 HTML files each:
- **EN:** `en/` (symbols, blog, guides, legal, utility pages)
- **FR:** `fr/` (symboles, blog, guides, legal, utility pages)
- **ES:** `es/` (simbolos, blog, guides, legal, utility pages)
- **DE:** `de/` (traumsymbole, blog, guides, legal, utility pages)
- **IT:** `it/` (simboli, blog, guides, legal, utility pages)

### HTML lang Attribute
Every page has the correct `<html lang="xx">` attribute matching its language:
- EN pages: `<html lang="en">` or `<html class="scroll-smooth blog-article" lang="en">`
- FR pages: `<html lang="fr">`
- ES pages: `<html lang="es">`
- DE pages: `<html lang="de">`
- IT pages: `<html lang="it">`

### Hreflang Implementation
All pages include complete hreflang link elements in the `<head>` with all 5 languages plus `x-default`. Example from `en/symbols/snake.html`:
```html
<link rel="alternate" hreflang="en" href="https://noctalia.app/en/symbols/snake">
<link rel="alternate" hreflang="fr" href="https://noctalia.app/fr/symboles/serpent">
<link rel="alternate" hreflang="es" href="https://noctalia.app/es/simbolos/serpiente">
<link rel="alternate" hreflang="de" href="https://noctalia.app/de/traumsymbole/schlange">
<link rel="alternate" hreflang="it" href="https://noctalia.app/it/simboli/serpente">
<link rel="alternate" hreflang="x-default" href="https://noctalia.app/en/symbols/snake">
```

The `x-default` consistently points to the English version (or root `/` for the homepage).

### Slug Localization
Symbol paths are fully localized per language:
| Symbol | EN | FR | ES | DE | IT |
|--------|----|----|----|----|-----|
| Snake | `/en/symbols/snake` | `/fr/symboles/serpent` | `/es/simbolos/serpiente` | `/de/traumsymbole/schlange` | `/it/simboli/serpente` |
| House | `/en/symbols/house` | `/fr/symboles/maison` | `/es/simbolos/casa` | `/de/traumsymbole/haus` | `/it/simboli/casa` |

Blog slugs are fully localized:
| Article | EN | FR | ES | DE | IT |
|---------|----|----|----|----|-----|
| Snake dreams | `snake-dreams-meaning` | `reves-de-serpents` | `suenos-con-serpientes` | `traeume-von-schlangen-...` | `sogni-sui-serpenti-...` |

Legal/utility page paths are localized:
| Page | EN | FR | ES | DE | IT |
|------|----|----|----|----|-----|
| Legal notice | `legal-notice` | `mentions-legales` | `aviso-legal` | `impressum` | `note-legali` |
| Privacy | `privacy-policy` | `politique-confidentialite` | `politica-privacidad` | `datenschutz` | `privacy-policy` |
| Terms | `terms` | `cgu` | `terminos` | `agb` | `termini` |
| About | `about` | `a-propos` | `sobre` | `ueber-uns` | `chi-siamo` |
| Account deletion | `account-deletion` | `suppression-compte` | `eliminacion-cuenta` | `konto-loeschen` | `eliminazione-account` |

### og:locale Implementation
All pages set the correct `og:locale` for their language:
- EN: `en_US`
- FR: `fr_FR`
- ES: `es_ES`
- DE: `de_DE`
- IT: `it_IT`

The homepage and utility pages include all 4 `og:locale:alternate` values. Example from `en/index.html`:
```html
<meta property="og:locale" content="en_US">
<meta property="og:locale:alternate" content="fr_FR">
<meta property="og:locale:alternate" content="es_ES">
<meta property="og:locale:alternate" content="de_DE">
<meta property="og:locale:alternate" content="it_IT">
```

### Language Dropdown
Every page includes a language dropdown with hreflang-annotated links to the equivalent page in each language. The dropdown uses proper ARIA attributes (`aria-haspopup`, `aria-expanded`, `aria-label`, `role="menu"`, `role="menuitem"`).

### Sitemap Hreflang
The `sitemap.xml` includes `xhtml:link` hreflang annotations that mirror the in-page annotations. Each URL entry includes all 5 language alternates plus `x-default`:
```xml
<xhtml:link rel="alternate" hreflang="en" href="https://noctalia.app/en/terms"/>
<xhtml:link rel="alternate" hreflang="fr" href="https://noctalia.app/fr/cgu"/>
<xhtml:link rel="alternate" hreflang="es" href="https://noctalia.app/es/terminos"/>
<xhtml:link rel="alternate" hreflang="de" href="https://noctalia.app/de/agb"/>
<xhtml:link rel="alternate" hreflang="it" href="https://noctalia.app/it/termini"/>
<xhtml:link rel="alternate" hreflang="x-default" href="https://noctalia.app/en/terms"/>
```

### Legacy French Diacritics
French URLs use ASCII-safe slugs (e.g., `reves` instead of `reves`). Legacy diacriticized paths are handled via redirects (configured in `_redirects`).

## Issues & Gaps

### P0 --- Critical

None identified.

### P1 --- High Priority

1. **`guides/` path not localized in FR/ES/DE/IT**: While symbol section paths are fully localized (`symbols` / `symboles` / `simbolos` / `traumsymbole` / `simboli`), the guides section uses `guides/` uniformly across all languages. This is inconsistent with the localization pattern applied to other sections.

   Expected localized paths:
   - FR: `guides/` could be `guides/` (acceptable in French) or `ressources/`
   - ES: `guias/`
   - DE: `ratgeber/` or `leitfaden/`
   - IT: `guide/`

   Current state: All languages use `guides/` (e.g., `fr/guides/dictionnaire-symboles-reves.html`).

### P2 --- Optimization

~~1. **Incomplete og:locale:alternate on some blog articles**~~ -- **RESOLVED** (2026-02-09, commit `bd2acb0`). Added 374 missing `og:locale:alternate` tags across all 530 pages via `scripts/fix-p1-seo.js`. All pages now have all 4 alternates.

2. **No hreflang in HTTP headers**: Hreflang annotations are present in HTML `<link>` elements and in the sitemap, but not in HTTP response headers (`Link:` header). While HTML + sitemap is adequate for most search engines, HTTP headers provide an additional signal and defense in depth.

3. **Schema inLanguage consistency**: Blog articles use `"inLanguage": "en"` in structured data, which is correct. Verify this is localized correctly in all translated versions (e.g., `"inLanguage": "fr"` for French articles).

## Recommendations

1. **Add missing og:locale:alternate values to blog articles.** Ensure all blog articles in all languages include all 4 alternate locales (fr_FR, es_ES, de_DE, it_IT). This can be scripted since the pattern is consistent.

2. **Consider localizing the `guides/` path** in future site restructuring. This is a low-priority change since search engines can index the content regardless, but it would improve URL consistency with the symbol section localization pattern.

3. **Optionally add hreflang HTTP headers** via `_headers` file (Vercel/Netlify) or `vercel.json` configuration. Example:
   ```
   Link: <https://noctalia.app/fr/symboles/serpent>; rel="alternate"; hreflang="fr"
   ```

4. **Verify inLanguage in structured data** across all 530 pages to ensure each language version uses its own language code.

## Validation Commands

```bash
# Count HTML files per language
for lang in en fr es de it; do echo "$lang: $(find docs/$lang -name '*.html' | wc -l)"; done
# Expected: 106 each

# Verify all EN pages have hreflang for all 5 languages
for f in docs/en/**/*.html; do
  count=$(grep -c 'hreflang=' "$f")
  if [ "$count" -lt 6 ]; then echo "INCOMPLETE: $f ($count hreflang)"; fi
done

# Check og:locale:alternate completeness in blog articles
grep -c "og:locale:alternate" docs/en/blog/snake-dreams-meaning.html
# Expected: 4 (currently shows 2)

# Verify html lang attributes
grep -r '<html.*lang="en"' docs/en/ --include="*.html" | wc -l
grep -r '<html.*lang="fr"' docs/fr/ --include="*.html" | wc -l
grep -r '<html.*lang="es"' docs/es/ --include="*.html" | wc -l
grep -r '<html.*lang="de"' docs/de/ --include="*.html" | wc -l
grep -r '<html.*lang="it"' docs/it/ --include="*.html" | wc -l
# Expected: 106 each

# Check sitemap hreflang entries
grep -c 'xhtml:link' docs/sitemap.xml
# Expected: 530 x 6 = 3180 (5 alternates + x-default per URL)

# Verify x-default points to EN
grep 'hreflang="x-default"' docs/en/symbols/snake.html
```

## Sample Pages Audited

| Page | Type | Status |
|------|------|--------|
| `en/index.html` | Homepage | Complete hreflang cluster (5 + x-default), og:locale with all 4 alternates, x-default points to `/` |
| `en/symbols/snake.html` | Symbol page | Fully localized slug, complete hreflang cluster, correct og:locale |
| `fr/symboles/serpent.html` | Symbol page (FR) | Matches EN cluster, `lang="fr"`, `og:locale=fr_FR` |
| `de/traumsymbole/schlange.html` | Symbol page (DE) | Matches cluster, `lang="de"`, `og:locale=de_DE` |
| `en/blog/snake-dreams-meaning.html` | Blog article | Hreflang complete but og:locale:alternate missing de_DE, it_IT |
| `en/about.html` | Utility page | Complete hreflang cluster, all 4 og:locale:alternate values |
| `en/legal-notice.html` | Legal page | Localized slug (`mentions-legales` in FR, `impressum` in DE), complete hreflang |
| `en/terms.html` | Terms page | Localized slug (`cgu` in FR, `agb` in DE), complete hreflang, all og:locale:alternate |
| `en/guides/scary-dream-symbols.html` | Guide page | Uses `guides/` path (not localized), hreflang complete |
| `sitemap.xml` | Sitemap | All 530 URLs with 6 hreflang annotations each, x-default mirrors EN |
