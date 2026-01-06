import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';
import { mergeSettings, readSettings, suggestionsForWord } from 'cspell-lib';

const require = createRequire(import.meta.url);
const DOCS_DIR = path.join(process.cwd(), 'docs');
const DICT_CONFIG_PATH = require.resolve('@cspell/dict-fr-fr/cspell-ext.json');

const ARGS = new Set(process.argv.slice(2));
const SHOULD_WRITE = ARGS.has('--write');

const WORD_REGEX = /\p{L}+/gu;
const ASCII_WORD_REGEX = /^[A-Za-z]+$/;
const SCRIPT_TYPE_REGEX = /type\s*=\s*["']([^"']+)["']/i;
const ATTR_REGEX_TEMPLATE = (attr) => new RegExp(`${attr}\\s*=\\s*(["'])(.*?)\\1`, 'i');

const ACCENT_STRIP_REGEX = /[\u0300-\u036f]/g;
const LOWER_LOCALE = 'fr';
const SUGGEST_OPTIONS = {
  locale: 'fr',
  languageId: 'plaintext',
  includeDefaultConfig: false,
};

function stripAccents(value) {
  return value.normalize('NFD').replace(ACCENT_STRIP_REGEX, '');
}

const SUBJECT_PRONOUNS = new Set([
  'il',
  'elle',
  'on',
  'ce',
  'c',
  'ça',
  'ca',
  'cela',
  'ceci',
  'qui',
]);

const DETERMINERS = new Set([
  'le',
  'la',
  'les',
  'l',
  'un',
  'une',
  'des',
  'du',
  'de',
  'd',
  'au',
  'aux',
  'ce',
  'cet',
  'cette',
  'ces',
  'mon',
  'ma',
  'mes',
  'ton',
  'ta',
  'tes',
  'son',
  'sa',
  'ses',
  'notre',
  'nos',
  'votre',
  'vos',
  'leur',
  'leurs',
  'quel',
  'quelle',
  'quels',
  'quelles',
  'chaque',
  'plusieurs',
  'certain',
  'certaine',
  'certains',
  'certaines',
]);

const A_PREP_NEXT = new Set([
  ...DETERMINERS,
  'travers',
  'propos',
  'partir',
  'cause',
]);

const LA_TO_LA_GRAVE_NEXT = new Set(['que', 'ou', 'où', 'bas', 'haut', 'meme', 'même', 'dessus', 'dessous']);
const LA_TO_LA_GRAVE_PREV = new Set(['jusque', 'jusqu', 'par', 'de', 'depuis', 'des', 'dès', 'voila', 'voilà', 'est']);

function looksLikeInfinitive(wordLower) {
  return /(?:er|ir|re|oir)$/.test(wordLower);
}

function shouldConvertAToAgrave(prevWordLower, nextWordLower, nextNextWordLower) {
  if (!nextWordLower) return false;

  // Clear cases for the verb "a": subject pronoun + (article/determiner) + noun-ish word.
  if (SUBJECT_PRONOUNS.has(prevWordLower) && (nextWordLower === 'la' || nextWordLower === 'le' || nextWordLower === 'les' || nextWordLower === 'l')) {
    if (nextNextWordLower) return false;
  }

  // Common prepositional patterns: "à + <determiner>" or "à + infinitive".
  if (A_PREP_NEXT.has(nextWordLower)) return true;
  if (looksLikeInfinitive(nextWordLower)) return true;

  // "jusqu'à"
  if (prevWordLower === 'jusqu' || prevWordLower === 'jusque') return true;

  // Default: keep as-is (avoid risky changes).
  return false;
}

function shouldConvertLaToLaGrave(prevWordLower, nextWordLower, isEndOrPunctuation) {
  if (LA_TO_LA_GRAVE_NEXT.has(nextWordLower)) return true;
  if (LA_TO_LA_GRAVE_PREV.has(prevWordLower) && (LA_TO_LA_GRAVE_NEXT.has(nextWordLower) || isEndOrPunctuation)) return true;
  return false;
}

function hasMixedCase(value) {
  return /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value);
}

function isTitleCase(value) {
  return /^\p{Lu}[\P{L}\p{Ll}]+$/u.test(value);
}

function isAllUpper(value) {
  return /^[\P{L}\p{Lu}]+$/u.test(value);
}

function applyCase(source, target) {
  if (isAllUpper(source)) {
    return target.toLocaleUpperCase(LOWER_LOCALE);
  }
  if (isTitleCase(source)) {
    return target.replace(/^\p{L}/u, (char) => char.toLocaleUpperCase(LOWER_LOCALE));
  }
  return target;
}

function getTagName(tag) {
  const match = tag.match(/^<\s*\/?\s*([a-zA-Z0-9-]+)/);
  return match ? match[1].toLowerCase() : null;
}

function getScriptType(tag) {
  const match = tag.match(SCRIPT_TYPE_REGEX);
  return match ? match[1].toLowerCase() : null;
}

function getAttribute(tag, attr) {
  const match = tag.match(ATTR_REGEX_TEMPLATE(attr));
  return match ? match[2] : null;
}

function shouldFixMetaContent(metaKey) {
  if (!metaKey) return false;
  const key = metaKey.toLowerCase();
  if (key === 'description' || key === 'keywords') return true;
  if (key.includes('title') || key.includes('description')) return true;
  return false;
}

function collectWordsFromText(text, wordSet) {
  for (const match of text.matchAll(WORD_REGEX)) {
    const word = match[0];
    if (!ASCII_WORD_REGEX.test(word)) continue;
    wordSet.add(word.toLowerCase());
  }
}

function isFrenchHtml(html) {
  return /<html\b[^>]*\blang=["']fr([_-][a-z0-9]+)?["']/i.test(html);
}

function listHtmlFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listHtmlFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(fullPath);
    }
  }
  return files;
}

function collectWordsFromHtml(html, wordSet) {
  const parts = html.split(/(<[^>]+>)/g);
  let inScript = false;
  let scriptType = null;
  let inStyle = false;
  let inCode = false;

  for (const part of parts) {
    if (part.startsWith('<')) {
      const tagName = getTagName(part);
      if (!tagName) continue;
      const isClosing = part.startsWith('</');
      if (!isClosing) {
        if (tagName === 'meta') {
          const metaKey = getAttribute(part, 'name') || getAttribute(part, 'property');
          if (shouldFixMetaContent(metaKey)) {
            const contentValue = getAttribute(part, 'content');
            if (contentValue) collectWordsFromText(contentValue, wordSet);
          }
        } else if (tagName === 'img') {
          const altValue = getAttribute(part, 'alt');
          if (altValue) collectWordsFromText(altValue, wordSet);
        }
        const ariaLabel = getAttribute(part, 'aria-label');
        if (ariaLabel) collectWordsFromText(ariaLabel, wordSet);
        const titleValue = getAttribute(part, 'title');
        if (titleValue) collectWordsFromText(titleValue, wordSet);
      }
      if (tagName === 'script') {
        if (isClosing) {
          inScript = false;
          scriptType = null;
        } else {
          inScript = true;
          scriptType = getScriptType(part);
        }
      } else if (tagName === 'style') {
        inStyle = !isClosing;
      } else if (tagName === 'code' || tagName === 'pre') {
        inCode = !isClosing;
      }
      continue;
    }

    const shouldProcess = !inStyle && !inCode && (!inScript || scriptType === 'application/ld+json');
    if (!shouldProcess) continue;

    collectWordsFromText(part, wordSet);
  }
}

async function buildReplacementMap(words, settings) {
  const replacements = new Map();
  let processed = 0;

  for (const word of words) {
    processed += 1;
    if (processed % 250 === 0) {
      process.stdout.write(`...checked ${processed} words\r`);
    }
    // Do not attempt dictionary-based replacement for already-valid words.
    // (We handle special disambiguations like a/à and la/là separately.)
    const result = await suggestionsForWord(word, SUGGEST_OPTIONS, settings);
    const hasExactMatch = result.suggestions.some((suggestion) => suggestion.cost === 0 && suggestion.word.toLowerCase() === word);
    if (hasExactMatch) continue;

    const candidates = result.suggestions.filter((suggestion) => {
      if (hasMixedCase(suggestion.word)) return false;
      if (stripAccents(suggestion.word).toLowerCase() !== word) return false;
      return stripAccents(suggestion.word) !== suggestion.word;
    });

    if (!candidates.length) continue;
    const minCost = Math.min(...candidates.map((suggestion) => suggestion.cost));
    const best = candidates.filter((suggestion) => suggestion.cost === minCost);
    if (best.length !== 1) continue;

    replacements.set(word, best[0].word);
  }

  if (processed >= 250) {
    process.stdout.write(' '.repeat(40) + '\r');
  }

  return replacements;
}

function replaceText(text, replacements) {
  const matches = [...text.matchAll(WORD_REGEX)];
  if (!matches.length) return { text, count: 0 };

  const words = matches.map((match) => ({
    value: match[0],
    lower: match[0].toLowerCase(),
    index: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));

  const findPrevWord = (i) => (i > 0 ? words[i - 1].lower : '');
  const findNextWord = (i) => (i + 1 < words.length ? words[i + 1].lower : '');
  const findNextNextWord = (i) => (i + 2 < words.length ? words[i + 2].lower : '');

  let out = '';
  let lastIndex = 0;
  let count = 0;

  const isEndOrPunctuationAfter = (endIndex) => {
    const rest = text.slice(endIndex);
    return /^\s*(?:[.,;:!?)]|$)/.test(rest);
  };

  for (let i = 0; i < words.length; i += 1) {
    const token = words[i];
    out += text.slice(lastIndex, token.index);
    lastIndex = token.end;

    const raw = token.value;
    const lower = token.lower;

    if (lower === 'a') {
      const prev = findPrevWord(i);
      const next = findNextWord(i);
      const nextNext = findNextNextWord(i);
      if (shouldConvertAToAgrave(prev, next, nextNext)) {
        count += 1;
        out += applyCase(raw, 'à');
        continue;
      }
      out += raw;
      continue;
    }

    if (lower === 'la') {
      const prev = findPrevWord(i);
      const next = findNextWord(i);
      const isEndOrPunctuation = isEndOrPunctuationAfter(token.end);
      if (shouldConvertLaToLaGrave(prev, next, isEndOrPunctuation)) {
        count += 1;
        out += applyCase(raw, 'là');
        continue;
      }
      out += raw;
      continue;
    }

    if (ASCII_WORD_REGEX.test(raw)) {
      const replacement = replacements.get(lower);
      if (replacement) {
        count += 1;
        out += applyCase(raw, replacement);
        continue;
      }
    }

    out += raw;
  }

  out += text.slice(lastIndex);
  return { text: out, count };
}

function replaceAttribute(tag, attr, replacements) {
  const regex = ATTR_REGEX_TEMPLATE(attr);
  let count = 0;
  const updated = tag.replace(regex, (match, quote, value) => {
    const result = replaceText(value, replacements);
    count += result.count;
    return `${attr}=${quote}${result.text}${quote}`;
  });
  return { tag: updated, count };
}

function applyReplacements(html, replacements) {
  const parts = html.split(/(<[^>]+>)/g);
  let inScript = false;
  let scriptType = null;
  let inStyle = false;
  let inCode = false;
  let total = 0;

  const updatedParts = parts.map((part) => {
    if (part.startsWith('<')) {
      const tagName = getTagName(part);
      if (!tagName) return part;
      const isClosing = part.startsWith('</');
      if (!isClosing) {
        let updatedTag = part;
        if (tagName === 'meta') {
          const metaKey = getAttribute(part, 'name') || getAttribute(part, 'property');
          if (shouldFixMetaContent(metaKey)) {
            const result = replaceAttribute(updatedTag, 'content', replacements);
            updatedTag = result.tag;
            total += result.count;
          }
        } else if (tagName === 'img') {
          const result = replaceAttribute(updatedTag, 'alt', replacements);
          updatedTag = result.tag;
          total += result.count;
        }
        const ariaResult = replaceAttribute(updatedTag, 'aria-label', replacements);
        updatedTag = ariaResult.tag;
        total += ariaResult.count;
        const titleResult = replaceAttribute(updatedTag, 'title', replacements);
        updatedTag = titleResult.tag;
        total += titleResult.count;
        part = updatedTag;
      }
      if (tagName === 'script') {
        if (isClosing) {
          inScript = false;
          scriptType = null;
        } else {
          inScript = true;
          scriptType = getScriptType(part);
        }
      } else if (tagName === 'style') {
        inStyle = !isClosing;
      } else if (tagName === 'code' || tagName === 'pre') {
        inCode = !isClosing;
      }
      return part;
    }

    const shouldProcess = !inStyle && !inCode && (!inScript || scriptType === 'application/ld+json');
    if (!shouldProcess) return part;

    const { text, count } = replaceText(part, replacements);
    total += count;
    return text;
  });

  return { html: updatedParts.join(''), count: total };
}

async function main() {
  if (!fs.existsSync(DOCS_DIR)) {
    console.error(`Missing docs directory: ${DOCS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const settings = mergeSettings(await readSettings(DICT_CONFIG_PATH), { language: 'fr' });
  const files = listHtmlFiles(DOCS_DIR);
  const frenchFiles = [];
  const uniqueWords = new Set();

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    if (!isFrenchHtml(content)) continue;
    frenchFiles.push({ file, content });
    collectWordsFromHtml(content, uniqueWords);
  }

  if (!frenchFiles.length) {
    console.log('No French HTML files found in docs/.');
    return;
  }

  console.log(`Found ${frenchFiles.length} French HTML files.`);
  console.log(`Scanning ${uniqueWords.size} unique words for accent fixes...`);
  const replacements = await buildReplacementMap(uniqueWords, settings);
  console.log(`Replacement candidates: ${replacements.size}`);

  let totalChanges = 0;
  const touchedFiles = [];

  for (const { file, content } of frenchFiles) {
    const { html, count } = applyReplacements(content, replacements);
    if (count > 0) {
      totalChanges += count;
      touchedFiles.push({ file, count });
      if (SHOULD_WRITE) {
        fs.writeFileSync(file, html, 'utf8');
      }
    }
  }

  console.log(`Accent replacements: ${totalChanges}`);
  if (!touchedFiles.length) {
    console.log('No changes needed.');
    return;
  }

  for (const entry of touchedFiles) {
    console.log(`${SHOULD_WRITE ? 'Updated' : 'Would update'} ${entry.file} (${entry.count} changes)`);
  }

  if (!SHOULD_WRITE) {
    console.log('Dry run only. Re-run with --write to apply changes.');
  }
}

main();
