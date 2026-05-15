#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * TI-97 — "assertive phrases" audit
 *
 * Goal: list sentences that are assertive/medical-like and currently not linked to a source,
 * so they can be reviewed and (ideally) cited inline.
 *
 * Notes:
 * - Heuristic only (no HTML parser dependency).
 * - Focuses on <p> paragraphs inside the "Article Content" block.
 */

const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.join(__dirname, '../docs');
const OUT_PATH = path.join(__dirname, '../doc_web_interne/docs/TI-97-assertive-phrases.md');

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>');
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '');
}

function splitSentences(text) {
  const s = normalizeWhitespace(text);
  if (!s) return [];
  const matches = s.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g);
  return (matches ?? []).map((m) => normalizeWhitespace(m));
}

function getLanguageFromRelPath(relPath) {
  const first = relPath.split(path.sep)[0];
  if (first === 'fr' || first === 'en' || first === 'es') return first;
  return 'en';
}

function getSlugFromRelPath(relPath) {
  return path.basename(relPath).replace(/\.html$/i, '');
}

function extractCanonical(html) {
  const m = html.match(/<link\s+rel=(["'])canonical\1\s+href=(["'])([^"']+)\2/i);
  return m ? m[3] : null;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return m ? normalizeWhitespace(m[1]) : null;
}

function extractArticleContentBlock(html) {
  const startMarker = '<!-- Article Content -->';
  const start = html.indexOf(startMarker);
  if (start === -1) return null;

  const endMarkers = ['<!-- FAQ Section -->', '<!-- Sources / Trust (TI-97) -->', '<!-- Related Articles -->', '</article>'];
  let end = -1;
  for (const marker of endMarkers) {
    const idx = html.indexOf(marker, start + startMarker.length);
    if (idx === -1) continue;
    end = end === -1 ? idx : Math.min(end, idx);
  }
  if (end === -1) return null;
  return html.slice(start, end);
}

function extractParagraphs(articleBlockHtml) {
  const paragraphs = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(articleBlockHtml)) !== null) {
    const raw = m[0];
    const inner = m[1];
    paragraphs.push({ raw, inner });
  }
  return paragraphs;
}

function getAssertiveRules(lang) {
  const base = {
    absolute: /\b(always|never|proves?|proof|guarantee|100%|scientifically)\b/i,
    numbers: /\d/,
    medical: /\b(PTSD|depression|anxiety|panic|psychosis|insomnia|parasomnia|sleep paralysis|nightmare disorder)\b/i,
  };

  if (lang === 'fr') {
    return {
      ...base,
      absolute: /\b(toujours|jamais|prouve|preuve|garanti|100%|scientifique)\b/i,
      medical:
        /\b(dépression|depression|anxiété|anxiete|panique|psychose|insomnie|parasomnie|paralysie du sommeil|cauchemars?)\b/i,
      assertiveVerbs: /\b(est|sont|signifie|représente|cause|entraîne|augmente|diminue|permet|nécessite|doit)\b/i,
    };
  }

  if (lang === 'es') {
    return {
      ...base,
      absolute: /\b(siempre|nunca|prueba|garantiza|100%|cient[ií]fic[oa])\b/i,
      medical:
        /\b(depresi[oó]n|ansiedad|p[aá]nico|psicosis|insomnio|parasomnia|par[aá]lisis del sue[nñ]o|pesadillas?)\b/i,
      assertiveVerbs: /\b(es|son|significa|representa|causa|provoca|aumenta|reduce|permite|requiere|debe)\b/i,
    };
  }

  return {
    ...base,
    assertiveVerbs: /\b(is|are|means|represents|causes|leads to|increases|decreases|allows|requires|should)\b/i,
  };
}

function classifySentence(sentence, rules) {
  const reasons = [];
  if (rules.numbers.test(sentence)) reasons.push('chiffres');
  if (rules.medical.test(sentence)) reasons.push('terme santé');
  if (rules.absolute.test(sentence)) reasons.push('formulation absolue');
  if (rules.assertiveVerbs?.test(sentence)) reasons.push('affirmation');
  return reasons;
}

function recommendedSourcesHint(slug) {
  if (/rem|sommeil-paradoxal|sueno-rem/.test(slug)) return 'AASM Sleep Education / Aserinsky & Kleitman (1953)';
  if (/paralysis|paralysie|paralisis/.test(slug)) return 'Mayo Clinic / Sharpless & Barber (2011)';
  if (/nightmares|cauchemars|pesadillas/.test(slug)) return 'AASM Sleep Education / Mayo Clinic';
  if (/mental-health|sante-mentale|salud-mental/.test(slug)) return 'WHO / NIMH / VA PTSD Center';
  if (/lucid|lucide|lucidos/.test(slug)) return 'Voss et al. (2009) / Sleep Foundation';
  if (/remember|souvenir|recordar/.test(slug)) return 'Sleep Foundation (dream recall) / AASM sleep stages';
  if (/precognitive|premonitoires|premonitorios/.test(slug)) return 'APA Dictionary (confirmation bias, apophenia)';
  return 'Dream research reviews (Nielsen, Schredl, Domhoff) + clearly stated limits';
}

function findBlogArticleFiles() {
  const langs = ['fr', 'en', 'es'];
  const out = [];
  for (const lang of langs) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;
      if (entry === 'index.html') continue;
      out.push(path.join(lang, 'blog', entry));
    }
  }
  return out.sort();
}

function main() {
  const files = findBlogArticleFiles();
  const lines = [];
  lines.push('# TI-97 — Phrases assertives à sourcer (audit)\n');
  lines.push(
    'Heuristique : phrases avec chiffres / termes santé / formulations très affirmatives, dans des paragraphes sans lien sortant.\n',
  );
  lines.push('Objectif : ajouter des sources cliquables là où les affirmations sont faites (ou reformuler avec des limites).\n');

  for (const relPath of files) {
    const absPath = path.join(DOCS_DIR, relPath);
    const html = fs.readFileSync(absPath, 'utf8');
    const lang = getLanguageFromRelPath(relPath);
    const slug = getSlugFromRelPath(relPath);
    const title = extractTitle(html) ?? slug;
    const canonical = extractCanonical(html) ?? relPath.replace(/\\/g, '/');

    const block = extractArticleContentBlock(html);
    if (!block) continue;

    const paragraphs = extractParagraphs(block);
    const rules = getAssertiveRules(lang);
    const candidates = [];

    for (const p of paragraphs) {
      if (/<a\b[^>]*href=/i.test(p.raw)) continue;
      const text = decodeEntities(stripTags(p.inner));
      const sentences = splitSentences(text);
      for (const sentence of sentences) {
        const reasons = classifySentence(sentence, rules);
        if (!reasons.length) continue;
        candidates.push({ sentence, reasons });
      }
    }

    const top = candidates.slice(0, 12);
    lines.push(`## ${title}\n`);
    lines.push(`- Page: ${canonical}`);
    lines.push(`- Suggestion sources: ${recommendedSourcesHint(slug)}\n`);

    if (!top.length) {
      lines.push('- (Aucune phrase détectée par l’heuristique)\n');
      continue;
    }

    for (const c of top) {
      lines.push(`- (${c.reasons.join(', ')}) ${c.sentence}`);
    }
    lines.push('');
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, lines.join('\n'), 'utf8');
  console.log(`Wrote report: ${path.relative(process.cwd(), OUT_PATH)}`);
}

main();

