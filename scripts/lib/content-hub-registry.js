const path = require('path');
const { readJson, readSourceDocument } = require('./docs-source-utils');

const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..', '..');
const EXPECTED_LANGUAGES = Object.freeze(['en', 'fr', 'es', 'de', 'it']);
const FORBIDDEN_IDENTITY_KEYS = new Set(['url', 'path', 'slug', 'canonical', 'hreflang']);
const HUB_KINDS = new Set(['hubAndSpoke', 'contentDatabase']);

class ContentHubRegistryError extends Error {
  constructor(errors) {
    const details = errors.map((error) => `- ${error}`).join('\n');
    super(`Invalid content hub registry:\n${details}`);
    this.name = 'ContentHubRegistryError';
    this.errors = [...errors];
  }
}

function isPlainObject(value) {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function deepFreeze(value, seen = new WeakSet()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function describeUnexpectedKeys(value, allowedKeys, label, errors) {
  if (!isPlainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowedKeys.has(key)) errors.push(`${label} contains unsupported field "${key}"`);
  }
}

function findForbiddenIdentityKeys(value, errors, location = 'config', seen = new WeakSet()) {
  if (value == null || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      findForbiddenIdentityKeys(child, errors, `${location}[${index}]`, seen)
    );
    return;
  }

  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key.toLowerCase())) {
      errors.push(`${location}.${key} is forbidden; public identities must come from site-manifest.json`);
    }
    findForbiddenIdentityKeys(child, errors, `${location}.${key}`, seen);
  }
}

function hasExactlyExpectedLanguages(languages) {
  if (!Array.isArray(languages) || languages.length !== EXPECTED_LANGUAGES.length) return false;
  const actual = new Set(languages);
  return (
    actual.size === EXPECTED_LANGUAGES.length &&
    EXPECTED_LANGUAGES.every((lang) => actual.has(lang))
  );
}

function buildManifestIndex(manifest, errors) {
  const entries = new Map();
  const collections = new Map();

  if (!isPlainObject(manifest)) {
    errors.push('site manifest must be an object');
    return { entries, collections };
  }

  if (!hasExactlyExpectedLanguages(manifest.languages)) {
    errors.push(
      `site manifest languages must be exactly ${EXPECTED_LANGUAGES.join(', ')} (received ${
        Array.isArray(manifest.languages) ? manifest.languages.join(', ') : typeof manifest.languages
      })`
    );
  }

  if (!isPlainObject(manifest.collections)) {
    errors.push('site manifest collections must be an object');
    return { entries, collections };
  }

  for (const [collectionId, collection] of Object.entries(manifest.collections)) {
    if (!isPlainObject(collection) || !isPlainObject(collection.entries)) {
      errors.push(`site manifest collection "${collectionId}" must expose an entries object`);
      continue;
    }

    collections.set(collectionId, collection);
    for (const [pageId, entry] of Object.entries(collection.entries)) {
      if (!isPlainObject(entry)) {
        errors.push(`site manifest entry "${pageId}" must be an object`);
        continue;
      }
      if (entry.id !== pageId) {
        errors.push(`site manifest entry key "${pageId}" does not match entry.id "${entry.id}"`);
      }
      if (entries.has(pageId)) {
        errors.push(`pageId "${pageId}" is duplicated across site manifest collections`);
        continue;
      }
      entries.set(pageId, { collectionId, entry });
    }
  }

  return { entries, collections };
}

function ensureLocalizedEntry(pageId, label, manifestIndex, checkedPageIds, errors) {
  if (typeof pageId !== 'string' || pageId.trim() === '') {
    errors.push(`${label} must be a non-empty pageId`);
    return null;
  }

  const record = manifestIndex.entries.get(pageId);
  if (!record) {
    errors.push(`${label} references unknown pageId "${pageId}"`);
    return null;
  }
  if (checkedPageIds.has(pageId)) return record;
  checkedPageIds.add(pageId);

  const locales = record.entry.locales;
  if (!isPlainObject(locales)) {
    errors.push(`pageId "${pageId}" must expose localized manifest entries`);
    return record;
  }

  const localeKeys = Object.keys(locales);
  if (!hasExactlyExpectedLanguages(localeKeys)) {
    errors.push(`pageId "${pageId}" must exist in exactly ${EXPECTED_LANGUAGES.join(', ')}`);
  }

  for (const lang of EXPECTED_LANGUAGES) {
    const locale = locales[lang];
    if (!isPlainObject(locale)) {
      errors.push(`pageId "${pageId}" is missing locale "${lang}"`);
      continue;
    }
    if (typeof locale.path !== 'string' || !locale.path.startsWith('/')) {
      errors.push(`pageId "${pageId}" locale "${lang}" must expose an absolute manifest path`);
    }
  }

  return record;
}

function requireEntryType(record, expectedType, label, errors) {
  if (record && record.entry.type !== expectedType) {
    errors.push(
      `${label} must have manifest type "${expectedType}" (received "${record.entry.type}")`
    );
  }
}

function validateRenderConfig(render, label, errors) {
  if (!isPlainObject(render)) {
    errors.push(`${label}.render must be an object`);
    return;
  }
  describeUnexpectedKeys(
    render,
    new Set(['hubMissingSpokes', 'spokeMissingLinks']),
    `${label}.render`,
    errors
  );
  for (const field of ['hubMissingSpokes', 'spokeMissingLinks']) {
    if (typeof render[field] !== 'boolean') errors.push(`${label}.render.${field} must be boolean`);
  }
}

function collectSelectorMembers(
  selectors,
  label,
  manifestIndex,
  checkedPageIds,
  errors
) {
  if (!Array.isArray(selectors) || selectors.length === 0) {
    errors.push(`${label}.memberSelectors must be a non-empty array`);
    return [];
  }

  const selected = new Set();
  selectors.forEach((selector, selectorIndex) => {
    const selectorLabel = `${label}.memberSelectors[${selectorIndex}]`;
    if (!isPlainObject(selector)) {
      errors.push(`${selectorLabel} must be an object`);
      return;
    }
    describeUnexpectedKeys(
      selector,
      new Set(['collection', 'types']),
      selectorLabel,
      errors
    );

    if (typeof selector.collection !== 'string' || selector.collection.trim() === '') {
      errors.push(`${selectorLabel}.collection must be a non-empty manifest collection id`);
      return;
    }
    const collection = manifestIndex.collections.get(selector.collection);
    if (!collection) {
      errors.push(`${selectorLabel} references unknown collection "${selector.collection}"`);
      return;
    }

    if (!Array.isArray(selector.types) || selector.types.length === 0) {
      errors.push(`${selectorLabel}.types must be a non-empty array`);
      return;
    }
    const types = new Set();
    for (const type of selector.types) {
      if (typeof type !== 'string' || type.trim() === '') {
        errors.push(`${selectorLabel}.types must contain only non-empty strings`);
        continue;
      }
      if (types.has(type)) errors.push(`${selectorLabel}.types duplicates "${type}"`);
      types.add(type);
    }

    for (const type of types) {
      const matchingIds = Object.entries(collection.entries)
        .filter(([, entry]) => entry.type === type)
        .map(([pageId]) => pageId);
      if (matchingIds.length === 0) {
        errors.push(
          `${selectorLabel} does not match any "${type}" entry in collection "${selector.collection}"`
        );
      }
      for (const pageId of matchingIds) {
        if (selected.has(pageId)) {
          errors.push(`${selectorLabel} selects pageId "${pageId}" more than once`);
          continue;
        }
        selected.add(pageId);
        ensureLocalizedEntry(pageId, selectorLabel, manifestIndex, checkedPageIds, errors);
      }
    }
  });

  return [...selected].sort((a, b) => a.localeCompare(b));
}

function validateBlogTitles(
  pageIds,
  manifestIndex,
  rootDir,
  sourceDocumentReader,
  errors
) {
  const titles = new Map();
  for (const pageId of [...pageIds].sort((a, b) => a.localeCompare(b))) {
    const record = manifestIndex.entries.get(pageId);
    if (!record || record.collectionId !== 'blog') continue;

    for (const lang of EXPECTED_LANGUAGES) {
      const filePath = path.join(rootDir, 'docs-src', 'content', 'blog', pageId, `${lang}.md`);
      let source;
      try {
        source = sourceDocumentReader(filePath);
      } catch (error) {
        errors.push(`cannot read front matter for "${pageId}" locale "${lang}": ${error.message}`);
        continue;
      }

      const meta = source && source.meta;
      if (!isPlainObject(meta)) {
        errors.push(`front matter for "${pageId}" locale "${lang}" must be an object`);
        continue;
      }
      if (meta.pageId !== pageId) {
        errors.push(
          `front matter pageId mismatch for "${pageId}" locale "${lang}" (received "${meta.pageId}")`
        );
      }
      if (meta.lang !== lang) {
        errors.push(
          `front matter lang mismatch for "${pageId}" locale "${lang}" (received "${meta.lang}")`
        );
      }
      if (typeof meta.title !== 'string' || meta.title.trim() === '') {
        errors.push(`front matter title is missing for "${pageId}" locale "${lang}"`);
        continue;
      }
      titles.set(`${pageId}\0${lang}`, meta.title.trim());
    }
  }
  return titles;
}

function validateContentHubConfig(config, options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT_DIR);
  const manifest =
    options.manifest || readJson(options.manifestPath || path.join(rootDir, 'data', 'site-manifest.json'));
  const sourceDocumentReader = options.sourceDocumentReader || readSourceDocument;
  const errors = [];

  findForbiddenIdentityKeys(config, errors);
  if (!isPlainObject(config)) {
    errors.push('content hub config must be an object');
    throw new ContentHubRegistryError(errors);
  }
  describeUnexpectedKeys(config, new Set(['schemaVersion', 'hubs']), 'config', errors);
  if (config.schemaVersion !== 1) errors.push('config.schemaVersion must equal 1');
  if (!Array.isArray(config.hubs) || config.hubs.length === 0) {
    errors.push('config.hubs must be a non-empty array');
  }

  const manifestIndex = buildManifestIndex(manifest, errors);
  const checkedPageIds = new Set();
  const referencedBlogPageIds = new Set();
  const hubIds = new Set();
  const hubPageOwners = new Map();
  const spokeOwners = new Map();
  const membersByHubId = new Map();
  const normalizedHubs = [];

  for (const [hubIndex, rawHub] of (Array.isArray(config.hubs) ? config.hubs : []).entries()) {
    const label = `config.hubs[${hubIndex}]`;
    if (!isPlainObject(rawHub)) {
      errors.push(`${label} must be an object`);
      continue;
    }

    const kind = rawHub.kind;
    const allowedFields =
      kind === 'contentDatabase'
        ? new Set([
            'id',
            'kind',
            'directoryPageId',
            'hubPageId',
            'memberSelectors',
            'renderMode',
          ])
        : new Set([
            'id',
            'kind',
            'directoryPageId',
            'hubPageId',
            'spokePageIds',
            'relatedByPageId',
            'render',
          ]);
    describeUnexpectedKeys(rawHub, allowedFields, label, errors);

    if (typeof rawHub.id !== 'string' || rawHub.id.trim() === '') {
      errors.push(`${label}.id must be a non-empty string`);
    } else if (hubIds.has(rawHub.id)) {
      errors.push(`hub id "${rawHub.id}" is duplicated`);
    } else {
      hubIds.add(rawHub.id);
    }
    if (!HUB_KINDS.has(kind)) errors.push(`${label}.kind must be hubAndSpoke or contentDatabase`);

    const directoryRecord = ensureLocalizedEntry(
      rawHub.directoryPageId,
      `${label}.directoryPageId`,
      manifestIndex,
      checkedPageIds,
      errors
    );
    const hubRecord = ensureLocalizedEntry(
      rawHub.hubPageId,
      `${label}.hubPageId`,
      manifestIndex,
      checkedPageIds,
      errors
    );
    if (rawHub.directoryPageId === rawHub.hubPageId) {
      errors.push(`${label} cannot use the same pageId for its directory and hub`);
    }
    if (typeof rawHub.hubPageId === 'string') {
      const existingOwner = hubPageOwners.get(rawHub.hubPageId);
      if (existingOwner) {
        errors.push(`hub pageId "${rawHub.hubPageId}" is owned by both "${existingOwner}" and "${rawHub.id}"`);
      } else {
        hubPageOwners.set(rawHub.hubPageId, rawHub.id);
      }
    }

    if (directoryRecord?.collectionId === 'blog') referencedBlogPageIds.add(rawHub.directoryPageId);
    if (hubRecord?.collectionId === 'blog') referencedBlogPageIds.add(rawHub.hubPageId);

    if (kind === 'hubAndSpoke') {
      requireEntryType(directoryRecord, 'blogIndex', `${label}.directoryPageId`, errors);
      requireEntryType(hubRecord, 'blogArticle', `${label}.hubPageId`, errors);
      validateRenderConfig(rawHub.render, label, errors);

      if (!Array.isArray(rawHub.spokePageIds) || rawHub.spokePageIds.length === 0) {
        errors.push(`${label}.spokePageIds must be a non-empty array`);
      }
      const localSpokes = new Set();
      for (const [spokeIndex, pageId] of (
        Array.isArray(rawHub.spokePageIds) ? rawHub.spokePageIds : []
      ).entries()) {
        const spokeLabel = `${label}.spokePageIds[${spokeIndex}]`;
        const spokeRecord = ensureLocalizedEntry(
          pageId,
          spokeLabel,
          manifestIndex,
          checkedPageIds,
          errors
        );
        requireEntryType(spokeRecord, 'blogArticle', spokeLabel, errors);
        if (spokeRecord?.collectionId === 'blog') referencedBlogPageIds.add(pageId);
        if (localSpokes.has(pageId)) {
          errors.push(`${label}.spokePageIds duplicates "${pageId}"`);
          continue;
        }
        localSpokes.add(pageId);
        const existingOwner = spokeOwners.get(pageId);
        if (existingOwner) {
          errors.push(`spoke pageId "${pageId}" belongs to both "${existingOwner}" and "${rawHub.id}"`);
        } else {
          spokeOwners.set(pageId, rawHub.id);
        }
      }
      membersByHubId.set(rawHub.id, [...localSpokes]);
    } else if (kind === 'contentDatabase') {
      requireEntryType(directoryRecord, 'guideIndex', `${label}.directoryPageId`, errors);
      requireEntryType(hubRecord, 'guideDictionary', `${label}.hubPageId`, errors);
      if (rawHub.renderMode !== 'validateOnly') {
        errors.push(`${label}.renderMode must equal "validateOnly"`);
      }
      membersByHubId.set(
        rawHub.id,
        collectSelectorMembers(
          rawHub.memberSelectors,
          label,
          manifestIndex,
          checkedPageIds,
          errors
        )
      );
    }

    normalizedHubs.push(cloneJson(rawHub));
  }

  for (const [hubIndex, rawHub] of (Array.isArray(config.hubs) ? config.hubs : []).entries()) {
    if (!isPlainObject(rawHub) || rawHub.kind !== 'hubAndSpoke') continue;
    const label = `config.hubs[${hubIndex}].relatedByPageId`;
    if (rawHub.relatedByPageId == null) continue;
    if (!isPlainObject(rawHub.relatedByPageId)) {
      errors.push(`${label} must be an object when present`);
      continue;
    }

    const localSpokes = new Set(Array.isArray(rawHub.spokePageIds) ? rawHub.spokePageIds : []);
    for (const [sourcePageId, relatedPageIds] of Object.entries(rawHub.relatedByPageId)) {
      if (!localSpokes.has(sourcePageId)) {
        errors.push(`${label} source "${sourcePageId}" is not a spoke of hub "${rawHub.id}"`);
      }
      if (!Array.isArray(relatedPageIds)) {
        errors.push(`${label}.${sourcePageId} must be an array`);
        continue;
      }
      if (relatedPageIds.length > 3) {
        errors.push(`${label}.${sourcePageId} cannot contain more than three related spokes`);
      }
      const uniqueRelated = new Set();
      for (const relatedPageId of relatedPageIds) {
        ensureLocalizedEntry(
          relatedPageId,
          `${label}.${sourcePageId}`,
          manifestIndex,
          checkedPageIds,
          errors
        );
        if (uniqueRelated.has(relatedPageId)) {
          errors.push(`${label}.${sourcePageId} duplicates "${relatedPageId}"`);
          continue;
        }
        uniqueRelated.add(relatedPageId);
        if (relatedPageId === sourcePageId) {
          errors.push(`${label}.${sourcePageId} cannot relate a spoke to itself`);
        }
        if (!localSpokes.has(relatedPageId) || spokeOwners.get(relatedPageId) !== rawHub.id) {
          errors.push(
            `${label}.${sourcePageId} target "${relatedPageId}" must belong to the same primary hub`
          );
        }
      }
    }
  }

  for (const [hubPageId, hubId] of hubPageOwners) {
    const spokeOwner = spokeOwners.get(hubPageId);
    if (spokeOwner) {
      errors.push(`pageId "${hubPageId}" cannot be hub "${hubId}" and spoke of "${spokeOwner}"`);
    }
  }

  const titleByPageLang = validateBlogTitles(
    referencedBlogPageIds,
    manifestIndex,
    rootDir,
    sourceDocumentReader,
    errors
  );

  if (errors.length > 0) throw new ContentHubRegistryError(errors);

  return {
    config: deepFreeze(cloneJson(config)),
    hubs: deepFreeze(normalizedHubs),
    manifest,
    manifestIndex,
    membersByHubId,
    titleByPageLang,
  };
}

function createRegistry(validated) {
  const hubs = validated.hubs;
  const hubById = new Map(hubs.map((hub) => [hub.id, hub]));
  const hubByPageId = new Map(hubs.map((hub) => [hub.hubPageId, hub]));
  const primaryHubBySpoke = new Map();
  const relatedByPageId = new Map();

  for (const hub of hubs) {
    if (hub.kind !== 'hubAndSpoke') continue;
    for (const pageId of hub.spokePageIds) primaryHubBySpoke.set(pageId, hub);
    for (const [pageId, related] of Object.entries(hub.relatedByPageId || {})) {
      relatedByPageId.set(pageId, Object.freeze([...related]));
    }
  }

  function requireManifestEntry(pageId) {
    const record = validated.manifestIndex.entries.get(pageId);
    if (!record) throw new Error(`Unknown content hub pageId "${pageId}"`);
    return record.entry;
  }

  function requireLanguage(lang) {
    if (!EXPECTED_LANGUAGES.includes(lang)) {
      throw new Error(`Unsupported content hub language "${lang}"`);
    }
  }

  return Object.freeze({
    languages: EXPECTED_LANGUAGES,
    hubs,
    getHubById(id) {
      return hubById.get(id) || null;
    },
    getHubByPageId(pageId) {
      return hubByPageId.get(pageId) || null;
    },
    getPrimaryHubForSpoke(pageId) {
      return primaryHubBySpoke.get(pageId) || null;
    },
    getRelatedSpokes(pageId) {
      return relatedByPageId.get(pageId) || Object.freeze([]);
    },
    selectMembers(hubOrId) {
      const hub = typeof hubOrId === 'string' ? hubById.get(hubOrId) : hubOrId;
      if (!hub || !hubById.has(hub.id)) return Object.freeze([]);
      return Object.freeze([...(validated.membersByHubId.get(hub.id) || [])]);
    },
    resolvePath(pageId, lang) {
      requireLanguage(lang);
      const entry = requireManifestEntry(pageId);
      const resolvedPath = entry.locales?.[lang]?.path;
      if (typeof resolvedPath !== 'string') {
        throw new Error(`Missing manifest path for pageId "${pageId}" locale "${lang}"`);
      }
      return resolvedPath;
    },
    resolveTitle(pageId, lang) {
      requireLanguage(lang);
      requireManifestEntry(pageId);
      const title = validated.titleByPageLang.get(`${pageId}\0${lang}`);
      if (!title) {
        throw new Error(`Missing validated front matter title for pageId "${pageId}" locale "${lang}"`);
      }
      return title;
    },
  });
}

function loadContentHubRegistry(options = {}) {
  const rootDir = path.resolve(options.rootDir || DEFAULT_ROOT_DIR);
  const config =
    options.config ||
    readJson(options.configPath || path.join(rootDir, 'docs-src', 'config', 'content-hubs.json'));
  const manifest =
    options.manifest || readJson(options.manifestPath || path.join(rootDir, 'data', 'site-manifest.json'));
  const validated = validateContentHubConfig(config, {
    ...options,
    rootDir,
    manifest,
  });
  return createRegistry(validated);
}

module.exports = {
  ContentHubRegistryError,
  EXPECTED_LANGUAGES,
  loadContentHubRegistry,
  validateContentHubConfig,
};
