const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');

// Keyword Mapping
const KEYWORDS = {
  fr: [
    { terms: ['paralysie du sommeil'], slug: 'guide-paralysie-sommeil' },
    { terms: ['rêve lucide', 'rêves lucides'], slug: 'guide-reve-lucide-debutant' },
    { terms: ['journal de rêves', 'journal de rêve'], slug: 'guide-journal-reves' },
    { terms: ['incubation de rêve', 'incuber un rêve'], slug: 'guide-incubation-reves' },
    { terms: ['sommeil paradoxal'], slug: 'sommeil-paradoxal-reves' },
    { terms: ['cauchemars', 'cauchemar'], slug: 'guide-cauchemars' },
  ],
  en: [
    { terms: ['sleep paralysis'], slug: 'sleep-paralysis-guide' },
    { terms: ['lucid dream', 'lucid dreaming'], slug: 'lucid-dreaming-beginners-guide' },
    { terms: ['dream journal'], slug: 'dream-journal-guide' },
    { terms: ['dream incubation'], slug: 'dream-incubation-guide' },
    { terms: ['REM sleep'], slug: 'rem-sleep-dreams' },
    { terms: ['nightmares'], slug: 'stop-nightmares-guide' },
  ],
  es: [
    { terms: ['parálisis del sueño'], slug: 'guia-paralisis-sueno' },
    { terms: ['sueños lúcidos', 'sueño lúcido'], slug: 'guia-suenos-lucidos-principiantes' },
    { terms: ['diario de sueños'], slug: 'guia-diario-suenos' },
    { terms: ['incubación de sueños'], slug: 'guia-incubacion-suenos' },
    { terms: ['sueño REM'], slug: 'sueno-rem-suenos' },
    { terms: ['pesadillas'], slug: 'guia-pesadillas' },
  ],
};

function findBlogArticleFiles() {
  const langs = ['fr', 'en', 'es'];
  const out = [];
  for (const lang of langs) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(dir)) continue;
    
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;
      if (entry === 'index.html') continue;
      out.push({
        lang,
        slug: path.basename(entry, '.html'),
        path: path.join(lang, 'blog', entry),
        absPath: path.join(dir, entry),
      });
    }
  }
  return out;
}

function processContent(content, lang, currentSlug) {
  let newContent = content;
  let modified = false;

  const mapping = KEYWORDS[lang];
  if (!mapping) return { content, modified };

  // Helper to escape regex special characters
  const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  for (const item of mapping) {
    // Don't link to self
    if (item.slug === currentSlug) continue;

    const linkTag = `<a href="${item.slug}" class="text-dream-salmon hover:underline">`;
    const closeTag = '</a>';

    for (const term of item.terms) {
      // Logic:
      // 1. Find the FIRST occurrence of the term in a <p> tag.
      // 2. Ensure that <p> tag does NOT already contain an <a> tag (to avoid nesting or over-linking).
      // 3. Replace only that first occurrence.
      
      // Regex explanation:
      // <p\b[^>]*> : Match opening p tag
      // (?:(?!<\/p>).)*? : Match content lazily, ensuring we don't cross closing p
      // \b(TERM)\b : Match whole word term
      
      // Since JS regex lookbehind/complex logic is tricky, we might process paragraph by paragraph.
      
      // Check if the term is simply present to avoid expensive operations
      if (!newContent.toLowerCase().includes(term.toLowerCase())) continue;

      // We want to link only ONCE per mapped ITEM (not per term).
      // So if we find a match for this item, we break inner loop and continue to next item.
      let itemLinked = false;

      // Split by <p
      const parts = newContent.split('<p');
      for (let i = 1; i < parts.length; i++) { // Skip first part (before first <p)
        const part = parts[i];
        const closingIndex = part.indexOf('</p>');
        if (closingIndex === -1) continue; // Malformed or nested?

        const pContent = part.substring(0, closingIndex); // Content inside <p ... > ... </p> (excluding tags mostly, but includes attributes)
        
        // Skip if </a> exists in this paragraph (simplistic check for existing links)
        if (pContent.includes('<a ') || pContent.includes('</a>')) continue;
        
        // Extract the actual text body after the opening > of <p>
        const endOfOpeningTag = pContent.indexOf('>');
        if (endOfOpeningTag === -1) continue;

        const tagAttrs = pContent.substring(0, endOfOpeningTag + 1); // e.g. class="..." >
        let textBody = pContent.substring(endOfOpeningTag + 1); // The text

        // Case insensitive search for the term
        // We use a regex with word boundaries
        const termRegex = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'i');
        const match = textBody.match(termRegex);

        if (match) {
          // Found it!
          const actualTerm = match[0]; // Preserve case
          
          textBody = textBody.replace(termRegex, `${linkTag}${actualTerm}${closeTag}`);
          
          // Reconstruct
          parts[i] = tagAttrs + textBody + part.substring(closingIndex);
          
          modified = true;
          itemLinked = true;
          break; // Stop looking in other paragraphs
        }
      }
      
      if (itemLinked) {
        newContent = parts.join('<p');
        break; // Stop checking other terms for this same slug
      }
    }
  }

  return { content: newContent, modified };
}

function main() {
  const files = findBlogArticleFiles();
  let count = 0;

  for (const file of files) {
    const raw = fs.readFileSync(file.absPath, 'utf8');
    const result = processContent(raw, file.lang, file.slug);
    
    if (result.modified) {
      console.log(`Updated ${file.path}`);
      fs.writeFileSync(file.absPath, result.content, 'utf8');
      count++;
    }
  }
  
  console.log(`\nInternal links added to ${count} files.`);
}

main();
