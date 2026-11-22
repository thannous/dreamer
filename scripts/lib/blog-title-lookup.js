const path = require('node:path');
const { DOCS_SRC_DIR } = require('./docs-site-config');
const { readSourceDocument } = require('./docs-source-utils');

function createBlogTitleLookup(manifest) {
  const titlesByLanguage = new Map();
  return (lang, slug) => {
    if (!titlesByLanguage.has(lang)) {
      const titles = new Map();
      for (const [id, entry] of Object.entries(manifest.collections?.blog?.entries || {})) {
        const localizedSlug = entry.locales?.[lang]?.slug;
        if (!localizedSlug) continue;
        try {
          const { meta } = readSourceDocument(path.join(DOCS_SRC_DIR, 'content', 'blog', id, lang + '.md'));
          const title = String(meta.title || '').replace(/\s*[|–—-]\s*Noctalia\s*$/i, '').trim();
          if (title) titles.set(localizedSlug, title);
        } catch {
          // An unavailable article has no title; its link retains the generic label.
        }
      }
      titlesByLanguage.set(lang, titles);
    }
    const articleSlug = String(slug || '').split('#')[0];
    return titlesByLanguage.get(lang).get(articleSlug) || null;
  };
}

module.exports = { createBlogTitleLookup };
