// The symbol catalogs in data/ key Brazilian Portuguese as `pt`, the locale the mobile app ships;
// the site publishes it as the web locale `pt-br`. Every site reader of the catalogs (generators,
// release gates, image checks, reports) maps a web locale to its catalog key here, so that `pt-br`
// pages read the `pt` blocks and never look for a `pt-br` block that does not exist.
const CATALOG_KEYS = Object.freeze({ 'pt-br': 'pt' });

function catalogKey(webLocale) {
  return CATALOG_KEYS[webLocale] || webLocale;
}

// The web locale of a catalog key (the reverse of catalogKey).
function webLocale(catalogLocale) {
  return Object.keys(CATALOG_KEYS).find((web) => CATALOG_KEYS[web] === catalogLocale) || catalogLocale;
}

// In memory only: gives a catalog record (a symbol, a category, an extended entry, a curation page)
// a read-only alias of each web locale to its catalog block (record['pt-br'] is record.pt itself).
// The alias is not enumerable, so serialising, comparing or iterating the record is unchanged.
function aliasWebLocales(record) {
  if (!record || typeof record !== 'object') return record;
  for (const [web, key] of Object.entries(CATALOG_KEYS)) {
    if (Object.hasOwn(record, key) && !Object.hasOwn(record, web)) {
      Object.defineProperty(record, web, { get: () => record[key], enumerable: false, configurable: true });
    }
  }
  return record;
}

module.exports = { CATALOG_KEYS, aliasWebLocales, catalogKey, webLocale };
