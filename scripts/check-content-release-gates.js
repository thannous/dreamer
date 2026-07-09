#!/usr/bin/env node
/* eslint-disable no-console */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  DOCS_SRC_DIR,
  ROOT_DIR,
  getStaticPagePath,
  siteConfig,
} = require('./lib/docs-site-config');
const {
  readSourceDocument,
  walkFiles,
} = require('./lib/docs-source-utils');
const {
  findFirstSchemaByType,
  parseContentDate,
  parseJsonLdBlock,
  todayDateOnly,
  validateArticleDates,
  validateJsonLdDates,
} = require('./lib/article-date-contract');

const BLOG_SOURCE_DIR = path.join(DOCS_SRC_DIR, 'content', 'blog');
const PAGE_SOURCE_DIR = path.join(DOCS_SRC_DIR, 'content', 'pages');
const CONTENT_DIR = path.join(DOCS_SRC_DIR, 'content');
const COMMERCIAL_PAGE_FAMILIES = [
  'page.ai-dream-interpretation-app',
  'page.alternatives',
  'page.android-dream-analysis-app',
  'page.dream-dictionary-app',
  'page.dreamapp-alternative',
  'page.oniri-alternative',
  'page.voice-dream-journal',
];
const MIN_COMMERCIAL_WORDS = 300;
const MIN_NEW_SYMBOL_DESCRIPTION_CHARS = 120;
const MIN_NEW_SYMBOL_PROMPT_CHARS = 12;
const MIN_NEW_SYMBOL_FAQ_ANSWER_CHARS = 50;
const REQUIRED_COMMERCIAL_SCHEMA_TYPES = ['WebPage', 'BreadcrumbList', 'FAQPage'];
const COMMERCIAL_PAGES_WITHOUT_FAQ = new Set(['page.alternatives']);
const COMMERCIAL_FAQ_MINIMUMS = new Map([
  ['page.ai-dream-interpretation-app', 2],
  ['page.dreamapp-alternative', 2],
  ['page.oniri-alternative', 2],
]);
const HOME_PRODUCT_FACTS = {
  de: {
    analysis: '3 Traumanalysen pro Monat',
    exploration: '2 geführte Erkundungen pro Monat',
    audio: 'Sprachaudio wird nur für die Transkription verwendet und von Noctalia nicht dauerhaft gespeichert',
  },
  en: {
    analysis: '3 dream analyses per month',
    exploration: '2 guided explorations per month',
    audio: 'Voice audio is used only for transcription and is not persistently stored by Noctalia',
  },
  es: {
    analysis: '3 análisis de sueños al mes',
    exploration: '2 exploraciones guiadas al mes',
    audio: 'El audio de voz se utiliza solo para la transcripción y Noctalia no lo conserva de forma permanente',
  },
  fr: {
    analysis: '3 analyses de rêves par mois',
    exploration: '2 explorations guidées par mois',
    audio: 'L’audio vocal sert uniquement à la transcription et n’est pas conservé durablement par Noctalia',
  },
  it: {
    analysis: '3 analisi dei sogni al mese',
    exploration: '2 esplorazioni guidate al mese',
    audio: 'L’audio vocale viene usato solo per la trascrizione e non viene conservato in modo permanente da Noctalia',
  },
};
const PUBLIC_METADATA_FIELDS = [
  'title',
  'description',
  'ogTitle',
  'ogDescription',
  'ogImageAlt',
  'twitterTitle',
  'twitterDescription',
  'twitterImageAlt',
];
const DANGLING_END_WORDS = new Set([
  'a', 'an', 'and', 'avec', 'con', 'das', 'de', 'del', 'der', 'des', 'di', 'die', 'du',
  'e', 'ein', 'eine', 'einer', 'eines', 'el', 'et', 'for', 'für', 'il', 'la', 'las', 'le',
  'les', 'lo', 'los', 'mit', 'o', 'of', 'or', 'oder', 'ou', 'para', 'per', 'por', 'pour',
  'the', 'to', 'un', 'una', 'und', 'une', 'von', 'why', 'y',
]);
const TRUNCATED_CONNECTOR_CLAUSE = /(?:^|[:–—-]\s)(?:comment|come|como|cómo|wie)\s+(?:la|le|les|votre|vos|il|lo|i|gli|tua|tuo|tue|tuoi|el|los|las|tu|tus|der|die|das|dein|deine|ihr|ihre)\s+[\p{L}\p{M}-]+$/iu;
const SPANISH_ORTHOGRAPHY_RULES = [
  ['suenos', /\bsuenos\b/iu],
  ['rios', /\brios\b/iu],
  ['recordare', /\brecordare\b/iu],
  ['visualizate', /\bvisualizate\b/iu],
  ['fisico', /\bfisico\b/iu],
  ['telefono', /\btelefono\b/iu],
  ['manten', /(?<![\p{L}\p{M}])manten(?![\p{L}\p{M}])/iu],
  ['boligrafos', /\bboligrafos\b/iu],
  ['utiles', /\butiles\b/iu],
  ['ambar', /\bambar\b/iu],
  ['esta disenada', /\besta\s+disenada\b/iu],
  ['dispositivo medico', /\bdispositivo\s+medico\b/iu],
];

function decodeHtml(value) {
  return String(value || '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&auml;/gi, 'ä')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&uuml;/gi, 'ü');
}

function htmlToVisibleText(html) {
  return decodeHtml(
    String(html || '')
      .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
      .replace(/<!--([\s\S]*?)-->/g, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function countVisibleWords(html) {
  return htmlToVisibleText(html).match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length || 0;
}

function normalizeText(value) {
  return htmlToVisibleText(value).toLocaleLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

function validateExpandedSymbolLocale(locale, prefix, errors) {
  if (typeof locale?.seoTitle !== 'string' || locale.seoTitle.trim() === '') {
    errors.push(`${prefix}: new symbols require a localized seoTitle`);
  }

  const description = htmlToVisibleText(locale?.shortDescription);
  if (description.length < MIN_NEW_SYMBOL_DESCRIPTION_CHARS) {
    errors.push(
      `${prefix}: new-symbol shortDescription needs at least ${MIN_NEW_SYMBOL_DESCRIPTION_CHARS} characters`
    );
  }

  const prompts = Array.isArray(locale?.askYourself) ? locale.askYourself : [];
  if (prompts.length < 3) {
    errors.push(`${prefix}: new symbols require at least 3 localized askYourself prompts`);
  }
  const normalizedPrompts = prompts.map((prompt) => normalizeText(prompt)).filter(Boolean);
  if (
    normalizedPrompts.length !== prompts.length ||
    normalizedPrompts.some((prompt) => prompt.length < MIN_NEW_SYMBOL_PROMPT_CHARS)
  ) {
    errors.push(
      `${prefix}: every new-symbol prompt needs at least ${MIN_NEW_SYMBOL_PROMPT_CHARS} visible characters`
    );
  }
  if (new Set(normalizedPrompts).size !== normalizedPrompts.length) {
    errors.push(`${prefix}: new-symbol prompts must be distinct`);
  }

  const faq = Array.isArray(locale?.faq) ? locale.faq : [];
  if (faq.length < 3) {
    errors.push(`${prefix}: new symbols require at least 3 localized FAQ entries`);
  }
  const questions = [];
  for (const item of faq) {
    const question = normalizeText(item?.question);
    const answer = htmlToVisibleText(item?.answer);
    questions.push(question);
    if (!question || question.length < MIN_NEW_SYMBOL_PROMPT_CHARS) {
      errors.push(`${prefix}: every new-symbol FAQ needs a substantive localized question`);
    }
    if (answer.length < MIN_NEW_SYMBOL_FAQ_ANSWER_CHARS) {
      errors.push(
        `${prefix}: every new-symbol FAQ answer needs at least ${MIN_NEW_SYMBOL_FAQ_ANSWER_CHARS} characters`
      );
    }
  }
  if (new Set(questions.filter(Boolean)).size !== questions.filter(Boolean).length) {
    errors.push(`${prefix}: new-symbol FAQ questions must be distinct`);
  }
}

function hasTruncatedConnectorClause(value) {
  const withoutBrand = String(value || '')
    .replace(/\s*\|\s*Noctalia\s*$/iu, '')
    .replace(/[.!?;,]+\s*$/u, '')
    .trim();
  return TRUNCATED_CONNECTOR_CLAUSE.test(withoutBrand);
}

function findSpanishOrthographyIssues(value) {
  const visibleText = htmlToVisibleText(value);
  return SPANISH_ORTHOGRAPHY_RULES
    .filter(([, pattern]) => pattern.test(visibleText))
    .map(([label]) => label);
}

function collectSchemaNodes(blocks) {
  const nodes = [];

  function visit(node) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (node['@type']) nodes.push(node);
    for (const value of Object.values(node)) visit(value);
  }

  for (const block of Array.isArray(blocks) ? blocks : []) {
    visit(parseJsonLdBlock(block));
  }
  return nodes;
}

function nodeHasType(node, type) {
  const values = Array.isArray(node?.['@type']) ? node['@type'] : [node?.['@type']];
  return values.includes(type);
}

function findMalformedSpanishInvertedQuestions(bodyHtml) {
  const text = htmlToVisibleText(bodyHtml);
  const findings = [];

  for (let index = text.indexOf('¿'); index >= 0; index = text.indexOf('¿', index + 1)) {
    const rest = text.slice(index + 1);
    const nextQuestionClose = rest.indexOf('?');
    const nextPeriod = rest.indexOf('.');
    const nextExclamation = rest.indexOf('!');
    const declarativeTerminator = [nextPeriod, nextExclamation]
      .filter((candidate) => candidate >= 0)
      .sort((a, b) => a - b)[0];

    if (
      declarativeTerminator != null &&
      (nextQuestionClose < 0 || declarativeTerminator < nextQuestionClose)
    ) {
      const excerptEnd = Math.min(rest.length, declarativeTerminator + 1, 180);
      findings.push(`¿${rest.slice(0, excerptEnd)}`);
    }
  }

  return findings;
}

function checkArticleDateSources(errors) {
  const files = walkFiles(BLOG_SOURCE_DIR, (filePath) => filePath.endsWith('.md'));
  let articleCount = 0;

  for (const filePath of files) {
    const { meta } = readSourceDocument(filePath);
    if (meta.layout !== 'blogArticle') continue;
    if (findFirstSchemaByType(meta.jsonLd, 'CollectionPage')) continue;
    articleCount += 1;
    if (meta.ogType !== 'article') {
      errors.push(
        `[article date] ${path.relative(ROOT_DIR, filePath)}: ogType must be article so date meta is rendered`
      );
    }
    const result = validateArticleDates(meta);
    for (const error of result.errors) {
      errors.push(`[article date] ${path.relative(ROOT_DIR, filePath)}: ${error}`);
    }
  }

  return articleCount;
}

function checkStructuredDataDateSources(errors) {
  const files = walkFiles(CONTENT_DIR, (filePath) => filePath.endsWith('.md'));
  let articleSchemaCount = 0;
  let datedPageSchemaCount = 0;

  for (const filePath of files) {
    const { meta } = readSourceDocument(filePath);
    try {
      const result = validateJsonLdDates(meta.jsonLd, meta);
      articleSchemaCount += result.articleCount;
      datedPageSchemaCount += result.datedPageCount;
      for (const error of result.errors) {
        errors.push(`[structured data date] ${path.relative(ROOT_DIR, filePath)}: ${error}`);
      }
    } catch (error) {
      errors.push(
        `[structured data date] ${path.relative(ROOT_DIR, filePath)}: invalid JSON-LD (${error.message})`
      );
    }
  }

  return { articleSchemaCount, datedPageSchemaCount };
}

function checkSpanishEditorialPunctuation(errors) {
  const files = walkFiles(BLOG_SOURCE_DIR, (filePath) => filePath.endsWith(`${path.sep}es.md`));
  let findingCount = 0;

  for (const filePath of files) {
    const { meta, body } = readSourceDocument(filePath);
    if (meta.layout !== 'blogArticle') continue;
    const findings = findMalformedSpanishInvertedQuestions(body);
    findingCount += findings.length;
    for (const excerpt of findings) {
      errors.push(
        `[Spanish inverted question] ${path.relative(ROOT_DIR, filePath)}: opening ¿ reaches a declarative terminator before ? near "${excerpt}"`
      );
    }
  }

  return { fileCount: files.length, findingCount };
}

function checkSpanishOrthography(errors) {
  const files = walkFiles(CONTENT_DIR, (filePath) => filePath.endsWith(`${path.sep}es.md`));
  let findingCount = 0;

  for (const filePath of files) {
    const { meta, body } = readSourceDocument(filePath);
    const publicMetadata = PUBLIC_METADATA_FIELDS
      .map((field) => meta[field])
      .filter((value) => typeof value === 'string')
      .join(' ');
    const issues = new Set([
      ...findSpanishOrthographyIssues(publicMetadata),
      ...findSpanishOrthographyIssues(body),
    ]);
    findingCount += issues.size;
    for (const issue of issues) {
      errors.push(
        `[Spanish orthography] ${path.relative(ROOT_DIR, filePath)}: unaccented form "${issue}" remains in public text`
      );
    }
  }

  return { fileCount: files.length, findingCount };
}

function checkCommercialPage(meta, body, pageId, lang, filePath, errors) {
  const wordCount = countVisibleWords(body);
  if (wordCount < MIN_COMMERCIAL_WORDS) {
    errors.push(
      `[thin commercial page] ${path.relative(ROOT_DIR, filePath)}: ${wordCount} visible words, minimum ${MIN_COMMERCIAL_WORDS}`
    );
  }

  let nodes;
  try {
    nodes = collectSchemaNodes(meta.jsonLd);
  } catch (error) {
    errors.push(`[commercial JSON-LD] ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
    return;
  }

  const requiredSchemaTypes = REQUIRED_COMMERCIAL_SCHEMA_TYPES.filter(
    (type) => type !== 'FAQPage' || !COMMERCIAL_PAGES_WITHOUT_FAQ.has(pageId)
  );
  for (const type of requiredSchemaTypes) {
    if (!nodes.some((node) => nodeHasType(node, type))) {
      errors.push(`[commercial schema] ${path.relative(ROOT_DIR, filePath)}: missing ${type}`);
    }
  }

  const pagePath = getStaticPagePath(pageId, lang);
  const canonicalUrl = pagePath ? `${siteConfig.domain}${pagePath}` : null;
  const webPage = nodes.find((node) => nodeHasType(node, 'WebPage'));
  if (canonicalUrl && webPage && webPage.url !== canonicalUrl && webPage['@id'] !== canonicalUrl) {
    errors.push(
      `[commercial schema] ${path.relative(ROOT_DIR, filePath)}: WebPage URL must match ${canonicalUrl}`
    );
  }

  const breadcrumb = nodes.find((node) => nodeHasType(node, 'BreadcrumbList'));
  const crumbItems = Array.isArray(breadcrumb?.itemListElement) ? breadcrumb.itemListElement : [];
  const lastCrumb = [...crumbItems].sort((a, b) => Number(a.position || 0) - Number(b.position || 0)).at(-1);
  if (canonicalUrl && breadcrumb && lastCrumb?.item !== canonicalUrl) {
    errors.push(
      `[commercial schema] ${path.relative(ROOT_DIR, filePath)}: final breadcrumb must match ${canonicalUrl}`
    );
  }

  const faq = nodes.find((node) => nodeHasType(node, 'FAQPage'));
  const questions = Array.isArray(faq?.mainEntity) ? faq.mainEntity : [];
  const visibleText = normalizeText(body);
  const minimumFaqQuestions = COMMERCIAL_FAQ_MINIMUMS.get(pageId) || 3;
  if (faq && questions.length < minimumFaqQuestions) {
    errors.push(
      `[commercial schema] ${path.relative(ROOT_DIR, filePath)}: FAQPage needs at least ${minimumFaqQuestions} questions`
    );
  }
  for (const question of questions) {
    const name = normalizeText(question?.name);
    const answer = normalizeText(question?.acceptedAnswer?.text);
    if (!name || !answer || !visibleText.includes(name) || !visibleText.includes(answer)) {
      errors.push(
        `[commercial schema] ${path.relative(ROOT_DIR, filePath)}: FAQ schema must reproduce a visible question and answer (${question?.name || 'unnamed'})`
      );
    }
  }
}

function checkCommercialContent(errors) {
  let pageCount = 0;
  for (const pageId of COMMERCIAL_PAGE_FAMILIES) {
    for (const lang of siteConfig.languages) {
      const filePath = path.join(PAGE_SOURCE_DIR, pageId, `${lang}.md`);
      if (!fs.existsSync(filePath)) {
        errors.push(`[commercial page] missing ${path.relative(ROOT_DIR, filePath)}`);
        continue;
      }
      pageCount += 1;
      const { meta, body } = readSourceDocument(filePath);
      checkCommercialPage(meta, body, pageId, lang, filePath, errors);
    }
  }
  return pageCount;
}

function checkHomeProductFacts(errors) {
  const storeUrl = siteConfig.storeLinks.androidBase;
  let pageCount = 0;

  for (const lang of siteConfig.languages) {
    const filePath = path.join(PAGE_SOURCE_DIR, 'page.home', `${lang}.md`);
    const { meta, body } = readSourceDocument(filePath);
    const facts = HOME_PRODUCT_FACTS[lang];
    const visibleText = normalizeText(body);
    pageCount += 1;

    for (const fact of [facts.analysis, facts.exploration]) {
      if (!visibleText.includes(normalizeText(fact))) {
        errors.push(`[home product facts] ${path.relative(ROOT_DIR, filePath)}: missing "${fact}"`);
      }
    }

    let nodes;
    try {
      nodes = collectSchemaNodes(meta.jsonLd);
    } catch (error) {
      errors.push(`[home product facts] ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
      continue;
    }

    const app = nodes.find((node) => nodeHasType(node, 'MobileApplication'));
    if (
      app?.['@id'] !== `${siteConfig.domain}/#mobile-application` ||
      app?.url !== `${siteConfig.domain}/` ||
      app?.downloadUrl !== storeUrl ||
      app?.offers?.url !== storeUrl ||
      app?.offers?.price !== '0'
    ) {
      errors.push(
        `[home product facts] ${path.relative(ROOT_DIR, filePath)}: MobileApplication identity, free-install Offer and Google Play URL must stay aligned`
      );
    }

    const faq = nodes.find((node) => nodeHasType(node, 'FAQPage'));
    const questions = Array.isArray(faq?.mainEntity) ? faq.mainEntity : [];
    const privacyAnswer = questions
      .map((question) => question?.acceptedAnswer?.text)
      .find((answer) => normalizeText(answer).includes(normalizeText(facts.audio)));
    if (!privacyAnswer || !visibleText.includes(normalizeText(privacyAnswer))) {
      errors.push(
        `[home product facts] ${path.relative(ROOT_DIR, filePath)}: audio-retention FAQ must match visible copy`
      );
    }
  }

  return pageCount;
}

function terminalMetadataWord(value) {
  const withoutBrand = String(value || '').replace(/\s*\|\s*Noctalia\s*$/i, '');
  return withoutBrand
    .replace(/[.!?:;,–—-]+\s*$/u, '')
    .trim()
    .split(/\s+/)
    .at(-1)
    ?.toLocaleLowerCase()
    .replace(/[^\p{L}]+/gu, '');
}

function checkMetadataIntegrity(errors) {
  const roots = [
    path.join(DOCS_SRC_DIR, 'content', 'blog'),
    path.join(DOCS_SRC_DIR, 'content', 'pages'),
  ];
  let fileCount = 0;

  for (const root of roots) {
    for (const filePath of walkFiles(root, (candidate) => candidate.endsWith('.md'))) {
      fileCount += 1;
      const { meta } = readSourceDocument(filePath);
      for (const field of PUBLIC_METADATA_FIELDS) {
        const value = meta[field];
        if (typeof value !== 'string' || value === '') continue;
        if (/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/i.test(value)) {
          errors.push(
            `[metadata entity] ${path.relative(ROOT_DIR, filePath)}.${field}: use Unicode text, not a pre-escaped HTML entity`
          );
        }
        const terminalWord = terminalMetadataWord(value);
        if (
          terminalWord &&
          DANGLING_END_WORDS.has(terminalWord) &&
          (field.toLowerCase().includes('title') || /[.!?]\s*$/.test(value))
        ) {
          errors.push(
            `[truncated metadata] ${path.relative(ROOT_DIR, filePath)}.${field}: ends with dangling word "${terminalWord}"`
          );
        }
        if (field.toLowerCase().includes('title') && hasTruncatedConnectorClause(value)) {
          errors.push(
            `[truncated metadata] ${path.relative(ROOT_DIR, filePath)}.${field}: ends inside an unfinished connector clause`
          );
        }
      }
    }
  }
  return fileCount;
}

function checkReviewerIntegrity(errors) {
  let propertyCount = 0;
  let personCount = 0;

  function visit(node, filePath) {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, filePath);
      return;
    }
    if (!node || typeof node !== 'object') return;

    if (Object.hasOwn(node, 'reviewedBy')) {
      propertyCount += 1;
      const reviewers = Array.isArray(node.reviewedBy) ? node.reviewedBy : [node.reviewedBy];
      for (const reviewer of reviewers) {
        const types = Array.isArray(reviewer?.['@type'])
          ? reviewer['@type']
          : [reviewer?.['@type']];
        const isNamedPerson =
          types.includes('Person') &&
          typeof reviewer?.name === 'string' &&
          reviewer.name.trim() !== '';
        if (isNamedPerson) {
          personCount += 1;
        } else {
          errors.push(
            `[reviewer integrity] ${path.relative(ROOT_DIR, filePath)}: reviewedBy must be a named Person, never the publisher Organization`
          );
        }
      }
    }

    for (const value of Object.values(node)) visit(value, filePath);
  }

  for (const filePath of walkFiles(CONTENT_DIR, (candidate) => candidate.endsWith('.md'))) {
    const { meta } = readSourceDocument(filePath);
    for (const block of Array.isArray(meta.jsonLd) ? meta.jsonLd : []) {
      try {
        visit(parseJsonLdBlock(block), filePath);
      } catch (error) {
        errors.push(`[reviewer JSON-LD] ${path.relative(ROOT_DIR, filePath)}: ${error.message}`);
      }
    }
  }

  return { personCount, propertyCount };
}

function readGitJson(revision, relativePath) {
  const result = spawnSync('git', ['show', `${revision}:${relativePath}`], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.status !== 0 || !result.stdout) return null;
  try {
    return JSON.parse(result.stdout);
  } catch {
    return null;
  }
}

function baselineSymbolIds(currentPayload) {
  const relativePath = 'data/dream-symbols.json';
  const headPayload = readGitJson('HEAD', relativePath);
  const currentIds = new Set((currentPayload.symbols || []).map((symbol) => symbol.id));
  const headIds = new Set((headPayload?.symbols || []).map((symbol) => symbol.id));
  const workingTreeExpandsHead = [...currentIds].some((id) => !headIds.has(id));
  const baselinePayload = workingTreeExpandsHead ? headPayload : readGitJson('HEAD^', relativePath);
  return new Set((baselinePayload?.symbols || headPayload?.symbols || []).map((symbol) => symbol.id));
}

function previousCatalogPayload(currentPayload) {
  const headPayload = readGitJson('HEAD', 'data/dream-symbols.json');
  if (!headPayload) return null;
  if (JSON.stringify(headPayload) !== JSON.stringify(currentPayload)) return headPayload;
  return readGitJson('HEAD^', 'data/dream-symbols.json') || headPayload;
}

function withoutModifiedAt(value) {
  if (!value || typeof value !== 'object') return value;
  const clone = JSON.parse(JSON.stringify(value));
  delete clone.modifiedAt;
  return clone;
}

function sharedSymbolFields(symbol) {
  const clone = withoutModifiedAt(symbol) || {};
  for (const lang of siteConfig.languages) delete clone[lang];
  return clone;
}

function checkChangedSymbolDates(payload, errors) {
  const catalogDate = parseContentDate(payload?.meta?.lastUpdated);
  if (!catalogDate) {
    errors.push('[symbol dates] meta.lastUpdated must be an explicit valid ISO date');
    return;
  }

  if (catalogDate.dateOnly > todayDateOnly()) {
    errors.push('[symbol dates] meta.lastUpdated cannot be in the future');
  }

  const previousPayload = previousCatalogPayload(payload);
  if (!previousPayload) return;
  const previousById = new Map(
    (previousPayload.symbols || []).map((symbol) => [symbol.id, symbol])
  );

  for (const symbol of payload.symbols || []) {
    const previous = previousById.get(symbol.id);
    const sharedChanged =
      !previous || JSON.stringify(sharedSymbolFields(symbol)) !== JSON.stringify(sharedSymbolFields(previous));
    if (sharedChanged) {
      const modified = parseContentDate(symbol.modifiedAt);
      if (!modified || modified.dateOnly !== catalogDate.dateOnly) {
        errors.push(
          `[symbol dates] ${symbol.id}: shared edits require modifiedAt=${catalogDate.dateOnly}`
        );
      }
    }

    for (const lang of siteConfig.languages) {
      const localeChanged =
        !previous ||
        JSON.stringify(withoutModifiedAt(symbol?.[lang])) !==
          JSON.stringify(withoutModifiedAt(previous?.[lang]));
      if (!localeChanged && !sharedChanged) continue;
      const modified = parseContentDate(symbol?.[lang]?.modifiedAt || symbol?.modifiedAt);
      if (!modified || modified.dateOnly !== catalogDate.dateOnly) {
        errors.push(
          `[symbol dates] ${symbol.id}.${lang}: substantive edits require modifiedAt=${catalogDate.dateOnly}`
        );
      }
    }
  }
}

function checkSymbolLocalization(errors) {
  const symbolPath = path.join(ROOT_DIR, 'data', 'dream-symbols.json');
  const payload = JSON.parse(fs.readFileSync(symbolPath, 'utf8'));
  const symbols = Array.isArray(payload.symbols) ? payload.symbols : [];
  const previousSymbolIds = baselineSymbolIds(payload);
  const symbolIds = new Set(symbols.map((symbol) => symbol?.id).filter(Boolean));
  const seenIds = new Set();
  const seenSlugs = Object.fromEntries(siteConfig.languages.map((lang) => [lang, new Map()]));

  for (const symbol of symbols) {
    const isExpandedInventory = !previousSymbolIds.has(symbol?.id);
    if (!symbol?.id || seenIds.has(symbol.id)) {
      errors.push(`[symbol inventory] missing or duplicate id: ${symbol?.id || '<missing-id>'}`);
    }
    seenIds.add(symbol?.id);
    if (isExpandedInventory) {
      const related = Array.isArray(symbol?.relatedSymbols) ? symbol.relatedSymbols : [];
      if (new Set(related).size < 3) {
        errors.push(`[symbol linking] ${symbol?.id}: new symbols require at least 3 distinct relatedSymbols`);
      }
      for (const relatedId of related) {
        if (relatedId === symbol.id || !symbolIds.has(relatedId)) {
          errors.push(`[symbol linking] ${symbol?.id}: invalid related symbol "${relatedId}"`);
        }
      }
    }
    for (const lang of siteConfig.languages) {
      const locale = symbol?.[lang];
      const prefix = `[symbol localization] ${symbol?.id || '<missing-id>'}.${lang}`;
      if (!locale || typeof locale !== 'object') {
        errors.push(`${prefix}: missing locale`);
        continue;
      }
      for (const field of ['slug', 'name', 'shortDescription']) {
        if (typeof locale[field] !== 'string' || locale[field].trim() === '') {
          errors.push(`${prefix}: missing ${field}`);
        }
      }
      const slug = locale?.slug?.trim();
      if (slug) {
        const collision = seenSlugs[lang].get(slug);
        if (collision) {
          errors.push(`${prefix}: slug duplicates ${collision}.${lang}`);
        } else {
          seenSlugs[lang].set(slug, symbol.id);
        }
      }
      if (isExpandedInventory) {
        validateExpandedSymbolLocale(locale, prefix, errors);
        const description = normalizeText(locale?.shortDescription);
        const duplicate = symbols.find(
          (candidate) =>
            candidate.id !== symbol.id &&
            description &&
            normalizeText(candidate?.[lang]?.shortDescription) === description
        );
        if (duplicate) {
          errors.push(`${prefix}: shortDescription duplicates ${duplicate.id}.${lang}`);
        }
      }
    }
  }

  checkChangedSymbolDates(payload, errors);

  if (payload?.meta?.totalSymbols !== symbols.length || payload?.meta?.symbolCount !== symbols.length) {
    errors.push(
      `[symbol inventory] metadata counts must equal the ${symbols.length} canonical symbol records`
    );
  }

  return symbols.length;
}

function runReleaseGates() {
  const errors = [];
  const articleCount = checkArticleDateSources(errors);
  const structuredDataDates = checkStructuredDataDateSources(errors);
  const spanish = checkSpanishEditorialPunctuation(errors);
  const spanishOrthography = checkSpanishOrthography(errors);
  const commercialPageCount = checkCommercialContent(errors);
  const homePageCount = checkHomeProductFacts(errors);
  const metadataFileCount = checkMetadataIntegrity(errors);
  const reviewers = checkReviewerIntegrity(errors);
  const symbolCount = checkSymbolLocalization(errors);

  return {
    articleCount,
    commercialPageCount,
    errors,
    homePageCount,
    metadataFileCount,
    reviewers,
    spanish,
    spanishOrthography,
    structuredDataDates,
    symbolCount,
  };
}

function main() {
  const result = runReleaseGates();
  if (result.errors.length > 0) {
    console.error(`[content-release-gates] Failed (${result.errors.length} issue(s)):`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `[content-release-gates] Passed: ${result.articleCount} article dates, ` +
      `${result.structuredDataDates.articleSchemaCount} article schemas, ` +
      `${result.structuredDataDates.datedPageSchemaCount} dated page schemas, ` +
      `${result.spanish.fileCount} Spanish articles, ${result.commercialPageCount} commercial pages, ` +
      `${result.homePageCount} home product-fact pages, ${result.metadataFileCount} metadata sources, ` +
      `${result.symbolCount} fully localized symbols.`
  );
  console.log('[content-release-gates] Symbol inventory generation is unlocked by all quality gates.');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`[content-release-gates] Failed: ${error.message || error}`);
    process.exit(1);
  }
}

module.exports = {
  COMMERCIAL_PAGE_FAMILIES,
  MIN_COMMERCIAL_WORDS,
  collectSchemaNodes,
  countVisibleWords,
  checkStructuredDataDateSources,
  findMalformedSpanishInvertedQuestions,
  findSpanishOrthographyIssues,
  hasTruncatedConnectorClause,
  htmlToVisibleText,
  terminalMetadataWord,
  validateExpandedSymbolLocale,
  runReleaseGates,
};
