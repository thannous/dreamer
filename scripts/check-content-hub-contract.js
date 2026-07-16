#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const {
  DOCS_DIR,
  ROOT_DIR,
  siteConfig,
} = require('./lib/docs-site-config');
const { assertDocsBuildReady } = require('./lib/docs-check-helpers');
const { readJson, toPosix, walkFiles } = require('./lib/docs-source-utils');
const { loadContentHubRegistry } = require('./lib/content-hub-registry');

const MODULE_ATTRIBUTE = 'data-content-hub-module';

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

function extractAnchorHrefs(html) {
  const hrefs = [];
  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = anchorPattern.exec(String(html || '')))) {
    hrefs.push(decodeHtmlAttribute(match[1] ?? match[2] ?? match[3]));
  }
  return hrefs;
}

function extractModuleBlocks(html) {
  const blocks = [];
  const modulePattern = new RegExp(
    `<([a-z][\\w:-]*)\\b[^>]*\\b${MODULE_ATTRIBUTE}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?[^>]*>[\\s\\S]*?<\\/\\1\\s*>`,
    'gi'
  );
  let match;
  while ((match = modulePattern.exec(String(html || '')))) blocks.push(match[0]);
  return blocks;
}

function countModuleOpenings(html) {
  const openingPattern = new RegExp(
    `<[a-z][^>]*\\b${MODULE_ATTRIBUTE}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?[^>]*>`,
    'gi'
  );
  return (String(html || '').match(openingPattern) || []).length;
}

function extractMainHtml(html) {
  const match = String(html || '').match(/<main\b[^>]*>([\s\S]*?)<\/main\s*>/i);
  return match ? match[1] : String(html || '');
}

function outputFileForPath(docsDir, pagePath) {
  if (pagePath === '/') return path.join(docsDir, 'index.html');
  const relative = String(pagePath || '').replace(/^\/+/, '');
  return pagePath.endsWith('/')
    ? path.join(docsDir, relative, 'index.html')
    : path.join(docsDir, `${relative}.html`);
}

function resolveInternalPath(href, currentPath, domain = siteConfig.domain) {
  if (!href || /^(?:mailto:|tel:|sms:|javascript:|data:|#)/i.test(href)) return null;
  try {
    const resolved = new URL(href, `${domain}${currentPath}`);
    if (resolved.origin !== domain) return null;
    return resolved.pathname || '/';
  } catch {
    return null;
  }
}

function inspectRenderedPage(filePath, currentPath, domain = siteConfig.domain) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      allTargets: new Set(),
      moduleCount: 0,
      moduleBlockCount: 0,
      moduleTargets: [],
      outsideTargets: new Set(),
    };
  }

  const html = fs.readFileSync(filePath, 'utf8');
  const mainHtml = extractMainHtml(html);
  const moduleBlocks = extractModuleBlocks(mainHtml);
  const allTargets = new Set();
  const moduleTargets = [];
  const outsideTargets = new Set();

  for (const href of extractAnchorHrefs(mainHtml)) {
    const target = resolveInternalPath(href, currentPath, domain);
    if (!target) continue;
    allTargets.add(target);
  }

  for (const block of moduleBlocks) {
    for (const href of extractAnchorHrefs(block)) {
      const target = resolveInternalPath(href, currentPath, domain);
      if (target) moduleTargets.push(target);
    }
  }

  const outsideHtml = moduleBlocks.reduce((source, block) => source.replace(block, ''), mainHtml);
  for (const href of extractAnchorHrefs(outsideHtml)) {
    const target = resolveInternalPath(href, currentPath, domain);
    if (target) outsideTargets.add(target);
  }

  return {
    exists: true,
    allTargets,
    moduleCount: countModuleOpenings(html),
    moduleBlockCount: moduleBlocks.length,
    moduleTargets,
    outsideTargets,
  };
}

function buildEntryIndex(manifest) {
  const byId = new Map();
  const byPath = new Map();
  for (const [collectionName, collection] of Object.entries(manifest.collections || {})) {
    for (const entry of Object.values(collection.entries || {})) {
      byId.set(entry.id, { ...entry, collectionName });
      for (const [lang, locale] of Object.entries(entry.locales || {})) {
        byPath.set(locale.path, { entryId: entry.id, lang });
      }
    }
  }
  return { byId, byPath };
}

function memberPageIdsForHub(hub, manifest) {
  const pageIds = [];
  for (const selector of hub.memberSelectors || []) {
    const entries = manifest.collections?.[selector.collection]?.entries || {};
    const allowedTypes = new Set(selector.types || []);
    for (const entry of Object.values(entries)) {
      if (allowedTypes.has(entry.type)) pageIds.push(entry.id);
    }
  }
  return [...new Set(pageIds)].sort();
}

function loadExactRedirectSources(rootDir) {
  const sources = new Set();
  const redirectsPath = path.join(rootDir, 'docs-src', 'static', '_redirects');
  if (fs.existsSync(redirectsPath)) {
    for (const rawLine of fs.readFileSync(redirectsPath, 'utf8').split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const [source, , status] = line.split(/\s+/);
      if (!source || !/^30[1278]$/.test(status || '')) continue;
      if (!source.startsWith('/') || /[:*]/.test(source)) continue;
      sources.add(source);
    }
  }

  const vercelPath = path.join(rootDir, 'docs-src', 'static', 'vercel.json');
  if (fs.existsSync(vercelPath)) {
    const vercel = readJson(vercelPath);
    for (const rule of vercel.redirects || []) {
      const source = rule?.source;
      if (typeof source === 'string' && source.startsWith('/') && !/[:*]/.test(source)) {
        sources.add(source);
      }
    }
  }
  return sources;
}

function pushMissingRelation(errors, label, pageId, lang, sourcePath, targetPath) {
  errors.push(
    `[${label}] ${pageId}.${lang}: ${sourcePath} must link to ${targetPath}`
  );
}

function assertNoCrossLanguageRelations({
  errors,
  page,
  pageId,
  lang,
  sourcePath,
  entryByPath,
  declaredPageIds,
}) {
  for (const targetPath of page.allTargets) {
    const target = entryByPath.get(targetPath);
    if (!target || target.lang === lang || !declaredPageIds.has(target.entryId)) continue;
    errors.push(
      `[content hub cross-language] ${pageId}.${lang}: ${sourcePath} links to ` +
        `${target.entryId}.${target.lang} at ${targetPath}`
    );
  }
}

function assertPageRelations({
  errors,
  docsDir,
  redirectSources,
  pageId,
  lang,
  sourcePath,
  requiredTargets,
  allowedModuleTargets,
  maxRelatedInModule = null,
  hubPath = null,
  entryByPath,
  declaredPageIds,
}) {
  const page = inspectRenderedPage(outputFileForPath(docsDir, sourcePath), sourcePath);
  if (!page.exists) {
    errors.push(`[missing output] ${pageId}.${lang}: ${sourcePath}`);
    return;
  }

  assertNoCrossLanguageRelations({
    errors,
    page,
    pageId,
    lang,
    sourcePath,
    entryByPath,
    declaredPageIds,
  });

  for (const targetPath of requiredTargets) {
    if (!page.allTargets.has(targetPath)) {
      pushMissingRelation(errors, 'content hub relation', pageId, lang, sourcePath, targetPath);
    }
    if (redirectSources.has(targetPath)) {
      errors.push(`[content hub redirect] ${pageId}.${lang}: canonical target is a redirect ${targetPath}`);
    }
    if (!fs.existsSync(outputFileForPath(docsDir, targetPath))) {
      errors.push(`[content hub broken target] ${pageId}.${lang}: ${targetPath}`);
    }
  }

  if (page.moduleCount > 1) {
    errors.push(`[content hub duplicate module] ${pageId}.${lang}: count=${page.moduleCount}`);
  }
  if (page.moduleCount !== page.moduleBlockCount) {
    errors.push(
      `[content hub module placement] ${pageId}.${lang}: modules must be complete elements inside <main>`
    );
  }

  const seenModuleTargets = new Set();
  for (const targetPath of page.moduleTargets) {
    if (seenModuleTargets.has(targetPath)) {
      errors.push(`[content hub duplicate module link] ${pageId}.${lang}: ${targetPath}`);
    }
    seenModuleTargets.add(targetPath);
    if (page.outsideTargets.has(targetPath)) {
      errors.push(`[content hub duplicate destination] ${pageId}.${lang}: ${targetPath}`);
    }
    if (!allowedModuleTargets.has(targetPath)) {
      errors.push(`[content hub unexpected module link] ${pageId}.${lang}: ${targetPath}`);
    }
    if (redirectSources.has(targetPath)) {
      errors.push(`[content hub module redirect] ${pageId}.${lang}: ${targetPath}`);
    }
    if (!fs.existsSync(outputFileForPath(docsDir, targetPath))) {
      errors.push(`[content hub module broken target] ${pageId}.${lang}: ${targetPath}`);
    }
  }

  if (maxRelatedInModule != null) {
    const relatedCount = page.moduleTargets.filter((targetPath) => targetPath !== hubPath).length;
    if (relatedCount > maxRelatedInModule) {
      errors.push(
        `[content hub related limit] ${pageId}.${lang}: count=${relatedCount} max=${maxRelatedInModule}`
      );
    }
  }
}

function checkContentHubContract(options = {}) {
  const rootDir = options.rootDir || ROOT_DIR;
  const docsDir = options.docsDir || DOCS_DIR;
  const manifest = options.manifest || readJson(path.join(rootDir, 'data', 'site-manifest.json'));
  const registry = options.registry || loadContentHubRegistry({ manifest, rootDir });
  const languages = options.languages || manifest.languages || siteConfig.languages;
  const redirectSources = options.redirectSources || loadExactRedirectSources(rootDir);
  const { byId, byPath } = buildEntryIndex(manifest);
  const errors = [];
  let checkedRelations = 0;
  let checkedPages = 0;
  const declaredPageIds = new Set();

  for (const hub of registry.hubs || []) {
    declaredPageIds.add(hub.directoryPageId);
    declaredPageIds.add(hub.hubPageId);
    const members = hub.kind === 'contentDatabase'
      ? memberPageIdsForHub(hub, manifest)
      : hub.spokePageIds || [];
    for (const pageId of members) declaredPageIds.add(pageId);
  }

  for (const hub of registry.hubs || []) {
    const isDatabase = hub.kind === 'contentDatabase';
    const memberPageIds = isDatabase
      ? memberPageIdsForHub(hub, manifest)
      : [...(hub.spokePageIds || [])];

    for (const lang of languages) {
      const directoryPath = registry.resolvePath(hub.directoryPageId, lang);
      const hubPath = registry.resolvePath(hub.hubPageId, lang);
      const directory = inspectRenderedPage(outputFileForPath(docsDir, directoryPath), directoryPath);
      checkedPages += 1;

      if (!directory.exists) {
        errors.push(`[missing directory output] ${hub.directoryPageId}.${lang}: ${directoryPath}`);
      } else {
        assertNoCrossLanguageRelations({
          errors,
          page: directory,
          pageId: hub.directoryPageId,
          lang,
          sourcePath: directoryPath,
          entryByPath: byPath,
          declaredPageIds,
        });
        if (!directory.allTargets.has(hubPath)) {
          pushMissingRelation(
            errors,
            'content hub directory',
            hub.directoryPageId,
            lang,
            directoryPath,
            hubPath
          );
        }
        if (directory.moduleCount > 0) {
          errors.push(`[content hub gateway module] ${hub.directoryPageId}.${lang}`);
        }
      }
      checkedRelations += 1;

      const memberPaths = memberPageIds.map((pageId) => registry.resolvePath(pageId, lang));
      assertPageRelations({
        errors,
        docsDir,
        redirectSources,
        pageId: hub.hubPageId,
        lang,
        sourcePath: hubPath,
        requiredTargets: memberPaths,
        allowedModuleTargets: new Set(isDatabase ? [] : memberPaths),
        entryByPath: byPath,
        declaredPageIds,
      });
      checkedPages += 1;
      checkedRelations += memberPaths.length;

      for (const memberPageId of memberPageIds) {
        const memberPath = registry.resolvePath(memberPageId, lang);
        const relatedPageIds = isDatabase ? [] : registry.getRelatedSpokes(memberPageId);
        const relatedPaths = relatedPageIds.map((pageId) => registry.resolvePath(pageId, lang));
        const allowedModuleTargets = new Set([hubPath, ...relatedPaths]);

        assertPageRelations({
          errors,
          docsDir,
          redirectSources,
          pageId: memberPageId,
          lang,
          sourcePath: memberPath,
          requiredTargets: [hubPath, ...relatedPaths],
          allowedModuleTargets: isDatabase ? new Set() : allowedModuleTargets,
          maxRelatedInModule: isDatabase ? null : 3,
          hubPath,
          entryByPath: byPath,
          declaredPageIds,
        });
        checkedPages += 1;
        checkedRelations += 1 + relatedPaths.length;
      }
    }
  }

  const allowedModulePageIds = new Set();
  for (const hub of registry.hubs || []) {
    if (hub.kind !== 'hubAndSpoke') continue;
    allowedModulePageIds.add(hub.hubPageId);
    for (const pageId of hub.spokePageIds || []) allowedModulePageIds.add(pageId);
  }

  for (const filePath of walkFiles(docsDir, (candidate) => candidate.endsWith('.html'))) {
    const html = fs.readFileSync(filePath, 'utf8');
    if (!html.includes('data-content-hub-module')) continue;
    const relative = toPosix(path.relative(docsDir, filePath));
    const prettyPath = relative === 'index.html'
      ? '/'
      : `/${relative.replace(/index\.html$/, '').replace(/\.html$/, '')}`;
    const identity = byPath.get(prettyPath);
    if (!identity || !allowedModulePageIds.has(identity.entryId)) {
      errors.push(`[content hub module scope] ${relative}: module is outside declared blog hubs/spokes`);
    }
  }

  for (const hub of registry.hubs || []) {
    if (!byId.has(hub.directoryPageId) || !byId.has(hub.hubPageId)) {
      errors.push(`[content hub missing identity] ${hub.id}`);
    }
  }

  return { errors, checkedPages, checkedRelations };
}

function main() {
  assertDocsBuildReady(ROOT_DIR);
  const result = checkContentHubContract();
  if (result.errors.length > 0) {
    console.error(`[content-hub-contract] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  console.log(
    `[content-hub-contract] Passed: ${result.checkedPages} localized pages, ` +
      `${result.checkedRelations} required relations.`
  );
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[content-hub-contract] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  buildEntryIndex,
  checkContentHubContract,
  inspectRenderedPage,
  loadExactRedirectSources,
  memberPageIdsForHub,
  outputFileForPath,
  resolveInternalPath,
};
