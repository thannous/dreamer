# How to Add New Dream Symbols

## Quick Reference Guide

### Prerequisites
- Python 3.x installed
- Node.js installed
- Access to `docs/data/` directory

### Step-by-Step Process

#### 1. Add Basic Symbol Entry
**File:** `docs/data/dream-symbols.json`

Add new symbol to the `symbols` array:
```json
{
  "id": "symbol-id",
  "category": "actions|places|nature|animals|body|objects|people|celestial",
  "priority": 2,
  "en": {
    "slug": "english-slug",
    "name": "English Name",
    "shortDescription": "Brief 80-120 character description...",
    "askYourself": ["Question 1?", "Question 2?"]
  },
  "fr": {
    "slug": "french-slug",
    "name": "Nom Français",
    "shortDescription": "Description courte...",
    "askYourself": ["Question 1 ?", "Question 2 ?"]
  },
  "es": {
    "slug": "spanish-slug",
    "name": "Nombre Español",
    "shortDescription": "Descripción corta...",
    "askYourself": ["¿Pregunta 1?", "¿Pregunta 2?"]
  },
  "de": {
    "slug": "german-slug",
    "name": "Deutscher Name",
    "shortDescription": "Kurze Beschreibung...",
    "askYourself": ["Frage 1?", "Frage 2?"]
  },
  "it": {
    "slug": "italian-slug",
    "name": "Nome Italiano",
    "shortDescription": "Descrizione breve...",
    "askYourself": ["Domanda 1?", "Domanda 2?"]
  },
  "relatedSymbols": ["symbol1", "symbol2", "symbol3"],
  "relatedArticles": {}
}
```

**Don't forget:** Update `meta.totalSymbols` (must match `symbols.length`) and `meta.lastUpdated`

#### 2. Add Extended Content
**File:** `docs/data/dream-symbols-extended.json`

Add comprehensive interpretation:
```json
"symbol-id": {
  "en": {
    "fullInterpretation": "<p>First paragraph (100-150 words)...</p>\n<p>Second paragraph...</p>\n<p>Third paragraph...</p>\n<p>Fourth paragraph (500-600 total)...</p>",
    "variations": [
      {
        "context": "Context 1",
        "meaning": "Meaning description (60-80 words)..."
      },
      // 6-7 total variations
    ]
  },
  "fr": { /* Same structure in French */ },
  "es": { /* Same structure in Spanish */ },
  "de": { /* Same structure in German */ },
  "it": { /* Same structure in Italian */ }
}
```

**Content Guidelines:**
- **fullInterpretation:** 500-600 words total
  - Para 1: Introduction (100-150 words)
  - Para 2: Psychological significance (150-200 words)
  - Para 3: Context & variations (150-200 words)
  - Para 4: Personal application (100-150 words)
- **variations:** 6-8 contexts, each 60-80 words
- **Tone:** Empathetic, non-prescriptive, psychologically informed
- **HTML:** Use `<p>`, `<strong>`, `<em>` tags
- **Avoid:** Jargon, judgment, prescriptive language

#### 3. Generate HTML Pages
```bash
cd docs
node scripts/generate-symbol-pages.js
```

This creates 5 pages per symbol (EN, FR, ES, DE, IT):
- `en/symbols/{slug}.html`
- `fr/symboles/{slug}.html`
- `es/simbolos/{slug}.html`
- `de/traumsymbole/{slug}.html`
- `it/simboli/{slug}.html`

#### 4. Update Sitemap
Create a Python script or manually add entries to `sitemap.xml`:

```xml
<url>
  <loc>https://noctalia.app/en/symbols/{slug}</loc>
  <lastmod>YYYY-MM-DD</lastmod>
  <priority>0.6</priority>
  <xhtml:link rel="alternate" hreflang="en" href="https://noctalia.app/en/symbols/{en-slug}"/>
  <xhtml:link rel="alternate" hreflang="fr" href="https://noctalia.app/fr/symboles/{fr-slug}"/>
  <xhtml:link rel="alternate" hreflang="es" href="https://noctalia.app/es/simbolos/{es-slug}"/>
  <xhtml:link rel="alternate" hreflang="de" href="https://noctalia.app/de/traumsymbole/{de-slug}"/>
  <xhtml:link rel="alternate" hreflang="it" href="https://noctalia.app/it/simboli/{it-slug}"/>
  <xhtml:link rel="alternate" hreflang="x-default" href="https://noctalia.app/en/symbols/{en-slug}"/>
</url>
```

Repeat for FR, ES, DE and IT `<loc>` URLs (one `<url>` block per language).

#### 5. Validation
```bash
# Validate JSON
python3 -m json.tool data/dream-symbols.json > /dev/null
python3 -m json.tool data/dream-symbols-extended.json > /dev/null

# Count symbols
jq '.meta.totalSymbols' data/dream-symbols.json
jq '.symbols | keys | length' data/dream-symbols-extended.json

# Count sitemap URLs
python3 -c "import xml.etree.ElementTree as ET; tree = ET.parse('sitemap.xml'); print(len(list(tree.getroot().findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}url'))))"

# Verify pages exist
ls -la en/symbols/{slug}.html
ls -la fr/symboles/{fr-slug}.html
ls -la es/simbolos/{es-slug}.html
ls -la de/traumsymbole/{de-slug}.html
ls -la it/simboli/{it-slug}.html

# Full site validation (recommended)
node scripts/check-site.js
```

### Batch Addition Script Template

For adding multiple symbols, use this Python template:

```python
#!/usr/bin/env python3
import json

# Read existing data
with open('data/dream-symbols-extended.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# Define new symbols
new_symbols = {
    "symbol-id": {
        "en": {
            "fullInterpretation": "...",
            "variations": [...]
        },
        "fr": {...},
        "es": {...}
    }
}

# Merge
data['symbols'].update(new_symbols)
data['meta']['lastUpdated'] = '2026-01-29'

# Write back
with open('data/dream-symbols-extended.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Added {len(new_symbols)} symbols. Total: {len(data['symbols'])}")
```

### Common Pitfalls

❌ **Don't:**
- Forget to update meta.totalSymbols
- Mix up slug naming (use hyphens, lowercase)
- Use prescriptive language ("you must", "you should")
- Copy-paste without adapting translations
- Skip sitemap updates
- Use emojis in content

✅ **Do:**
- Test on 1 symbol first
- Keep tone empathetic and open-ended
- Maintain tri-lingual parity
- Follow existing content patterns
- Validate JSON after changes
- Regenerate all pages after updates

### File Checklist

For each symbol addition:
- [ ] Added to `dream-symbols.json`
- [ ] Updated `meta.totalSymbols` in base file
- [ ] Added extended content to `dream-symbols-extended.json`
- [ ] Ran `generate-symbol-pages.js`
- [ ] Verified 5 HTML pages created
- [ ] Updated `sitemap.xml` (5 URLs per symbol)
- [ ] Validated JSON structure
- [ ] Checked hreflang tags
- [ ] Verified content quality

### Estimated Time per Symbol

- Base entry: 10 minutes
- Extended content (EN): 45 minutes
- Translations (FR + ES): 30 minutes
- Page generation: 2 minutes
- Sitemap update: 5 minutes
- Validation: 5 minutes

**Total: ~90 minutes per symbol** (with practice: 60-75 minutes)

### Resources

- Existing enriched symbols for reference: water, teeth, falling, flying, snake, death, chase
- Psychology resources: Jungian archetypes, dream symbolism books
- Translation tools: DeepL (higher quality than Google Translate)
- SEO research: Google Trends, Keyword Planner for search volume
