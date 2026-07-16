const { siteConfig } = require('../docs-site-config');
const { escapeHtml } = require('../docs-source-utils');

const CONTENT_HUB_MODULE_PATTERN = /\bdata-content-hub-module(?:\s*=|\s|>)/i;

function decodeHtmlAttribute(value) {
  return String(value || '')
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function collectLinkedPathnames(bodyHtml, currentPath, origin = siteConfig.domain) {
  const linkedPaths = new Set();
  const source = String(bodyHtml || '');
  const hrefPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  const baseUrl = new URL(String(currentPath || '/'), `${origin}/`);
  let match;

  while ((match = hrefPattern.exec(source)) !== null) {
    const href = decodeHtmlAttribute(match[1] ?? match[2] ?? match[3]);
    if (!href) continue;

    try {
      const url = new URL(href, baseUrl);
      if (url.origin !== baseUrl.origin) continue;
      linkedPaths.add(url.pathname);
    } catch {
      // Invalid or non-URL href values do not represent a resolvable site destination.
    }
  }

  return linkedPaths;
}

function relationPageId(relation) {
  if (typeof relation === 'string') return relation;
  return relation?.pageId || null;
}

function resolveLink(registry, pageId, lang) {
  const href = registry.resolvePath(pageId, lang);
  const title = registry.resolveTitle(pageId, lang);
  if (!href || !title) {
    throw new Error(`Unable to render content hub link for ${pageId} (${lang})`);
  }
  return { href, pageId, title };
}

function renderLink(link) {
  return `<a class="text-dream-salmon hover:underline" href="${escapeHtml(link.href)}">${escapeHtml(link.title)}</a>`;
}

function renderLinkList(links) {
  return [
    '  <ul class="space-y-3 text-purple-100/80">',
    ...links.map((link) => `    <li>${renderLink(link)}</li>`),
    '  </ul>',
  ].join('\n');
}

function renderHubModule(links, locale) {
  return [
    '<section class="glass-panel rounded-2xl p-6 mt-12 border border-white/10 bg-white/5" data-content-hub-module="hub" aria-labelledby="content-hub-module-title">',
    `  <h2 class="font-serif text-2xl text-dream-cream mb-4" id="content-hub-module-title">${escapeHtml(locale.contentHubHubHeading)}</h2>`,
    renderLinkList(links),
    '</section>',
  ].join('\n');
}

function renderSpokeModule(primaryLink, relatedLinks, locale) {
  const lines = [
    '<section class="glass-panel rounded-2xl p-6 mt-12 border border-white/10 bg-white/5" data-content-hub-module="spoke" aria-labelledby="content-hub-module-title">',
  ];

  if (primaryLink) {
    lines.push(
      `  <h2 class="font-serif text-2xl text-dream-cream mb-4" id="content-hub-module-title">${escapeHtml(locale.contentHubSpokeHeading)}</h2>`,
      `  <p class="text-purple-100/80">${renderLink(primaryLink)}</p>`
    );
  }

  if (relatedLinks.length > 0) {
    const headingLevel = primaryLink ? 'h3' : 'h2';
    const headingId = primaryLink ? '' : ' id="content-hub-module-title"';
    lines.push(
      `  <${headingLevel} class="font-serif text-xl text-dream-cream ${primaryLink ? 'mt-6 ' : ''}mb-4"${headingId}>${escapeHtml(locale.contentHubRelatedHeading)}</${headingLevel}>`,
      renderLinkList(relatedLinks)
    );
  }

  lines.push('</section>');
  return lines.join('\n');
}

function insertAtArticleEnd(bodyHtml, moduleHtml) {
  const source = String(bodyHtml || '');
  const closingTags = [...source.matchAll(/<\/article\s*>/gi)];
  const lastClosingTag = closingTags.at(-1);
  if (!lastClosingTag) return `${source}${source ? '\n' : ''}${moduleHtml}`;

  return `${source.slice(0, lastClosingTag.index)}${moduleHtml}\n${source.slice(lastClosingTag.index)}`;
}

function assertLocaleLabels(locale, lang) {
  for (const key of [
    'contentHubHubHeading',
    'contentHubSpokeHeading',
    'contentHubRelatedHeading',
  ]) {
    if (!locale?.[key]) {
      throw new Error(`Missing locale key ${key} for content hubs (${lang})`);
    }
  }
}

function renderContentHubModule({
  bodyHtml,
  pageId,
  lang,
  locale,
  registry,
  currentPath = null,
}) {
  const source = String(bodyHtml || '');
  if (!registry || CONTENT_HUB_MODULE_PATTERN.test(source)) return source;

  const hub = registry.getHubByPageId(pageId);
  const primaryHub = registry.getPrimaryHubForSpoke(pageId);
  const renderableHub =
    hub?.kind === 'hubAndSpoke' && hub.render?.hubMissingSpokes === true ? hub : null;
  const renderableSpoke =
    primaryHub?.kind === 'hubAndSpoke' && primaryHub.render?.spokeMissingLinks === true
      ? primaryHub
      : null;

  if (!renderableHub && !renderableSpoke) return source;

  assertLocaleLabels(locale, lang);
  const pagePath = currentPath || registry.resolvePath(pageId, lang);
  const linkedPaths = collectLinkedPathnames(source, pagePath);

  if (renderableHub) {
    const missingSpokes = [];
    const renderedPaths = new Set();
    for (const relation of renderableHub.spokePageIds || []) {
      const targetPageId = relationPageId(relation);
      if (!targetPageId) continue;
      const link = resolveLink(registry, targetPageId, lang);
      if (linkedPaths.has(link.href) || renderedPaths.has(link.href)) continue;
      renderedPaths.add(link.href);
      missingSpokes.push(link);
    }

    if (missingSpokes.length === 0) return source;
    return insertAtArticleEnd(source, renderHubModule(missingSpokes, locale));
  }

  const hubPageId = renderableSpoke.hubPageId;
  const hubLink = resolveLink(registry, hubPageId, lang);
  const primaryLink = linkedPaths.has(hubLink.href) ? null : hubLink;
  const relatedLinks = [];
  const renderedPaths = new Set(primaryLink ? [primaryLink.href] : []);
  const relatedSpokes = registry.getRelatedSpokes(pageId) || [];
  if (relatedSpokes.length > 3) {
    throw new Error(`Content hub spoke ${pageId} declares more than three related pages`);
  }

  for (const relation of relatedSpokes) {
    const targetPageId = relationPageId(relation);
    if (!targetPageId || targetPageId === pageId) continue;
    const link = resolveLink(registry, targetPageId, lang);
    if (linkedPaths.has(link.href) || renderedPaths.has(link.href)) continue;
    renderedPaths.add(link.href);
    relatedLinks.push(link);
  }

  if (!primaryLink && relatedLinks.length === 0) return source;
  return insertAtArticleEnd(source, renderSpokeModule(primaryLink, relatedLinks, locale));
}

module.exports = {
  collectLinkedPathnames,
  renderContentHubModule,
};
