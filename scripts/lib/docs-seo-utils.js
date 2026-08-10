const { siteConfig, getLanguageTag } = require('./docs-site-config');

// Site languages (internal identifiers, e.g. "pt-br"). Public BCP 47 tags
// (e.g. "pt-BR") come from siteConfig.languageTags via getLanguageTag.
const SUPPORTED_LANGS = siteConfig.languages;
const SUPPORTED_LANGUAGE_TAGS = SUPPORTED_LANGS.map(getLanguageTag);

function normalizeUrl(url) {
  return String(url || '')
    .replace(/\/index\.html$/, '/')
    .replace(/\.html$/, '');
}

function extractTagAttributes(tag) {
  const attrs = {};
  const attrRegex = /([^\s=/>]+)\s*=\s*(["'])(.*?)\2/gis;
  let match;

  while ((match = attrRegex.exec(tag)) !== null) {
    attrs[match[1].toLowerCase()] = match[3];
  }

  return attrs;
}

function extractLinkTags(html) {
  return Array.from(String(html || '').matchAll(/<link\b[^>]*>/gi), (match) => match[0]);
}

function hasRel(tag, relValue) {
  const attrs = extractTagAttributes(tag);
  const rel = String(attrs.rel || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  return rel.includes(String(relValue || '').toLowerCase());
}

function findCanonicalLinkTag(html) {
  return extractLinkTags(html).find((tag) => hasRel(tag, 'canonical')) || null;
}

function extractCanonicalUrl(html) {
  const tag = findCanonicalLinkTag(html);
  if (!tag) return null;
  const attrs = extractTagAttributes(tag);
  return attrs.href ? normalizeUrl(attrs.href) : null;
}

function extractHreflangs(html) {
  const hreflangs = {};

  for (const tag of extractLinkTags(html)) {
    if (!hasRel(tag, 'alternate')) continue;
    const attrs = extractTagAttributes(tag);
    if (!attrs.hreflang || !attrs.href) continue;
    hreflangs[attrs.hreflang] = normalizeUrl(attrs.href);
  }

  return hreflangs;
}

function extractTitleTag(html) {
  const match = String(html || '').match(/<title>([\s\S]*?)<\/title>/i);
  return match ? match[1].replace(/\s+/g, ' ').trim() : null;
}

function matchLineEndings(text, template) {
  const eol = String(template || '').includes('\r\n') ? '\r\n' : '\n';
  return String(text || '').replace(/\r?\n/g, eol);
}

module.exports = {
  SUPPORTED_LANGS,
  SUPPORTED_LANGUAGE_TAGS,
  normalizeUrl,
  extractTagAttributes,
  extractLinkTags,
  hasRel,
  findCanonicalLinkTag,
  extractCanonicalUrl,
  extractHreflangs,
  extractTitleTag,
  matchLineEndings,
};
