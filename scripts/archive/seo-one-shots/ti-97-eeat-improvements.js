#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * TI-97 E-E-A-T Improvements
 *
 * Adds to each blog article page:
 * 1. rel="nofollow" to all external links
 * 2. Health disclaimers for sensitive topic articles
 * 3. Inline study citations converted to clickable links
 * 4. Link verification report
 *
 * Usage:
 *   node scripts/ti-97-eeat-improvements.js [--dry-run] [--verify-links]
 *
 * This script is intentionally dependency-free (string-based HTML edits).
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DOCS_DIR = path.join(__dirname, '../docs');
const REPORT_DIR = path.join(__dirname, '../doc_web_interne/docs');
const INTERNAL_DOMAINS = ['noctalia.app'];

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERIFY_LINKS = args.includes('--verify-links');

// ============================================================================
// Configuration
// ============================================================================

const SENSITIVE_KEYWORDS = {
  en: /\b(PTSD|trauma|depression|anxiety|disorder|mental health|sleep paralysis|nightmare|panic|psychosis|insomnia|medication|therapy|treatment|suicid|distress)\b/i,
  fr: /\b(TSPT|trauma|dépression|anxiété|trouble|santé mentale|paralysie du sommeil|cauchemar|panique|psychose|insomnie|médicament|thérapie|traitement|suicid|détresse)\b/i,
  es: /\b(TEPT|trauma|depresión|ansiedad|trastorno|salud mental|parálisis del sueño|pesadilla|pánico|psicosis|insomnio|medicamento|terapia|tratamiento|suicid|angustia)\b/i,
};

const DISCLAIMERS = {
  en: `
            <!-- Health Disclaimer (TI-97 E-E-A-T) -->
            <aside class="glass-panel rounded-xl p-4 my-8 border border-purple-500/20" role="note" aria-label="Disclaimer">
                <p class="text-sm text-purple-200/70">
                    <strong class="text-dream-cream">Important:</strong> This article is for informational purposes only and does not constitute medical or psychological advice. If you experience persistent sleep disturbances or mental health concerns, please consult a qualified healthcare professional.
                </p>
            </aside>
`,
  fr: `
            <!-- Health Disclaimer (TI-97 E-E-A-T) -->
            <aside class="glass-panel rounded-xl p-4 my-8 border border-purple-500/20" role="note" aria-label="Avertissement">
                <p class="text-sm text-purple-200/70">
                    <strong class="text-dream-cream">Important :</strong> Cet article est fourni à titre informatif uniquement et ne constitue pas un avis médical ou psychologique. Si vous souffrez de troubles du sommeil persistants ou de problèmes de santé mentale, veuillez consulter un professionnel de santé qualifié.
                </p>
            </aside>
`,
  es: `
            <!-- Health Disclaimer (TI-97 E-E-A-T) -->
            <aside class="glass-panel rounded-xl p-4 my-8 border border-purple-500/20" role="note" aria-label="Aviso">
                <p class="text-sm text-purple-200/70">
                    <strong class="text-dream-cream">Importante:</strong> Este artículo tiene fines informativos únicamente y no constituye asesoramiento médico o psicológico. Si experimenta trastornos del sueño persistentes o problemas de salud mental, consulte a un profesional sanitario cualificado.
                </p>
            </aside>
`,
};

// Inline citations to convert to links
// Pattern matches the text, replacement adds the link
const INLINE_CITATIONS = [
  {
    name: 'Neuron (2019)',
    pattern: /(<em>Neuron<\/em>\s*\(2019\))/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/31604241/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/31604241/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'University of Lincoln (2015)',
    pattern: /(?<!<a[^>]*>)(University of Lincoln\s*\(2015\))(?![^<]*<\/a>)/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/26256788/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/26256788/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'Université de Lincoln (2015)',
    pattern: /(?<!<a[^>]*>)(Université de Lincoln\s*\(2015\))(?![^<]*<\/a>)/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/26256788/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/26256788/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'Universidad de Lincoln (2015)',
    pattern: /(?<!<a[^>]*>)(Universidad de Lincoln\s*\(2015\))(?![^<]*<\/a>)/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/26256788/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/26256788/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'University of Montreal (2022)',
    pattern: /(?<!<a[^>]*>)(University of Montreal\s*\(2022\))(?![^<]*<\/a>)/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/35366719/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/35366719/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'Université de Montréal (2022)',
    pattern: /(?<!<a[^>]*>)(Université de Montréal\s*\(2022\))(?![^<]*<\/a>)/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/35366719/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/35366719/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'Heidelberg (2021)',
    pattern: /(?<!<a[^>]*>)((?:University of\s+)?Heidelberg\s*\(2021\))(?![^<]*<\/a>)/gi,
    url: 'https://pubmed.ncbi.nlm.nih.gov/34225282/',
    replacement: '<a href="https://pubmed.ncbi.nlm.nih.gov/34225282/" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'Journal of Affective Disorders (2022)',
    pattern: /(?<!<a[^>]*>)(Journal of Affective Disorders\s*\(2022\))(?![^<]*<\/a>)/gi,
    url: 'https://www.sciencedirect.com/journal/journal-of-affective-disorders',
    replacement: '<a href="https://www.sciencedirect.com/journal/journal-of-affective-disorders" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
  {
    name: 'Frontiers in Psychology',
    pattern: /(?<!<a[^>]*>)(Frontiers in Psychology)(?![^<]*<\/a>)/gi,
    url: 'https://www.frontiersin.org/journals/psychology',
    replacement: '<a href="https://www.frontiersin.org/journals/psychology" target="_blank" rel="nofollow noopener noreferrer">$1</a>',
  },
];

// ============================================================================
// Utility functions
// ============================================================================

function getLanguageFromPath(filePath) {
  const parts = filePath.split(path.sep);
  const lang = parts[0];
  if (lang === 'fr' || lang === 'en' || lang === 'es') return lang;
  return 'en';
}

function getSlugFromPath(filePath) {
  const base = path.basename(filePath);
  return base.replace(/\.html$/i, '');
}

function findBlogArticleFiles() {
  const langs = ['fr', 'en', 'es'];
  const out = [];
  for (const lang of langs) {
    const dir = path.join(DOCS_DIR, lang, 'blog');
    if (!fs.existsSync(dir)) continue;
    const entries = fs.readdirSync(dir);
    for (const entry of entries) {
      if (!entry.endsWith('.html')) continue;
      out.push(path.join(lang, 'blog', entry));
    }
  }
  return out.sort();
}

// ============================================================================
// Transformation functions
// ============================================================================

/**
 * Add rel="nofollow" to all external links that don't already have it
 */
function addNofollowToExternalLinks(html) {
  let count = 0;

  const anchorPattern = /<a\b[^>]*>/gi;
  const hrefPattern = /\bhref\s*=\s*(["'])(https?:\/\/[^"']+)\1/i;
  const relPattern = /\brel\s*=\s*(["'])([^"']*)\1/i;

  function isInternalUrl(url) {
    return INTERNAL_DOMAINS.some((domain) => url.includes(domain));
  }

  html = html.replace(anchorPattern, (tag) => {
    const hrefMatch = tag.match(hrefPattern);
    if (!hrefMatch) return tag;

    const href = hrefMatch[2];
    if (isInternalUrl(href)) return tag;

    const required = ['nofollow', 'noopener', 'noreferrer'];
    const relMatch = tag.match(relPattern);

    if (!relMatch) {
      count++;
      return tag.replace(/>$/, ' rel="nofollow noopener noreferrer">');
    }

    const existing = relMatch[2]
      .split(/\s+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const tokens = new Set(existing.map((t) => t.toLowerCase()));

    let changed = false;
    for (const token of required) {
      if (!tokens.has(token)) {
        tokens.add(token);
        changed = true;
      }
    }
    if (!changed) return tag;

    count++;
    const merged = Array.from(tokens).join(' ');
    return tag.replace(relPattern, `rel=\"${merged}\"`);
  });

  return { html, count };
}

/**
 * Check if article content contains sensitive health topics
 */
function hasSensitiveContent(html, lang) {
  const keywords = SENSITIVE_KEYWORDS[lang] ?? SENSITIVE_KEYWORDS.en;
  return keywords.test(html);
}

/**
 * Check if disclaimer already exists
 */
function hasDisclaimer(html) {
  return html.includes('<!-- Health Disclaimer (TI-97 E-E-A-T) -->');
}

/**
 * Add health disclaimer after the article header, before TOC
 */
function addHealthDisclaimer(html, lang) {
  if (hasDisclaimer(html)) {
    return { html, added: false };
  }

  if (!hasSensitiveContent(html, lang)) {
    return { html, added: false };
  }

  const disclaimer = DISCLAIMERS[lang] ?? DISCLAIMERS.en;

  // Find the best injection point: after intro paragraph, before TOC
  // Look for the TOC comment marker, nav element with TOC, or the first h2
  const tocCommentPattern = /(<!-- Table of Contents -->)/i;
  const tocNavPattern = /(\n\s*<nav[^>]*(?:id=["']toc["']|class=[^>]*toc)[^>]*>)/i;
  const firstH2Pattern = /(\n\s*<h2[^>]*>)/i;

  if (tocCommentPattern.test(html)) {
    html = html.replace(tocCommentPattern, `${disclaimer}\n            $1`);
    return { html, added: true };
  }

  if (tocNavPattern.test(html)) {
    html = html.replace(tocNavPattern, `${disclaimer}$1`);
    return { html, added: true };
  }

  if (firstH2Pattern.test(html)) {
    html = html.replace(firstH2Pattern, `${disclaimer}$1`);
    return { html, added: true };
  }

  // Fallback: after article tag opening
  const articlePattern = /(<article[^>]*>\s*\n)/i;
  if (articlePattern.test(html)) {
    html = html.replace(articlePattern, `$1${disclaimer}`);
    return { html, added: true };
  }

  return { html, added: false };
}

/**
 * Convert inline study citations to clickable links
 */
function linkInlineCitations(html) {
  const linked = new Set();

  function linkInSegment(segment) {
    let out = segment;
    for (const citation of INLINE_CITATIONS) {
      const testMatch = out.match(citation.pattern);
      if (!testMatch) continue;

      // Best-effort guard against double-linking in the *segment*.
      const beforeMatch = out.slice(0, out.indexOf(testMatch[0]));
      const lastOpenA = beforeMatch.lastIndexOf('<a ');
      const lastCloseA = beforeMatch.lastIndexOf('</a>');
      if (lastOpenA > lastCloseA) continue;

      out = out.replace(citation.pattern, citation.replacement);
      linked.add(citation.name);
    }
    return out;
  }

  // Do not modify JSON-LD or any script content (would break structured data).
  const scriptPattern = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
  let out = '';
  let lastIndex = 0;
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    out += linkInSegment(html.slice(lastIndex, match.index));
    out += match[0];
    lastIndex = match.index + match[0].length;
  }
  out += linkInSegment(html.slice(lastIndex));

  return { html: out, linked: [...linked] };
}

/**
 * Extract all external URLs from HTML
 */
function extractExternalUrls(html) {
  const urls = new Set();
  const pattern = /<a\b[^>]*href=["'](https?:\/\/[^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const url = match[1];
    if (INTERNAL_DOMAINS.some((domain) => url.includes(domain))) continue;
    urls.add(url);
  }
  return [...urls];
}

/**
 * Verify a single URL (returns promise)
 */
function verifyUrl(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;

    function request(method) {
      return new Promise((resolveRequest) => {
        const req = protocol.request(
          url,
          {
            method,
            family: 4,
            timeout: 10000,
            headers: {
              'User-Agent':
                'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            },
          },
          (res) => resolveRequest({ status: res.statusCode }),
        );
        req.on('error', (err) => resolveRequest({ status: 'error', error: err.message }));
        req.on('timeout', () => {
          req.destroy();
          resolveRequest({ status: 'timeout', error: 'Request timed out' });
        });
        req.end();
      });
    }

    request('HEAD').then((head) => {
      if (typeof head.status === 'number' && head.status >= 200 && head.status < 400) {
        resolve({ url, status: head.status, ok: true });
        return;
      }

      // Some servers block/disable HEAD or return transient/CDN errors; retry with GET.
      if (
        head.status === 403 ||
        head.status === 405 ||
        head.status === 429 ||
        head.status === 'timeout' ||
        (typeof head.status === 'number' && head.status >= 500 && head.status < 600)
      ) {
        request('GET').then((get) => {
          const ok = typeof get.status === 'number' && get.status >= 200 && get.status < 400;
          resolve({ url, status: get.status, error: get.error, ok });
        });
        return;
      }

      resolve({ url, status: head.status, error: head.error, ok: false });
    });
  });
}

// ============================================================================
// Processing
// ============================================================================

function processFile(relPath) {
  const absPath = path.join(DOCS_DIR, relPath);
  const lang = getLanguageFromPath(relPath);
  const slug = getSlugFromPath(relPath);
  const isIndex = slug.toLowerCase() === 'index';
  const original = fs.readFileSync(absPath, 'utf8');

  let html = original;
  const changes = {
    file: relPath,
    slug,
    lang,
    nofollowCount: 0,
    disclaimerAdded: false,
    citationsLinked: [],
    externalUrls: [],
  };

  // 1. Add nofollow to external links
  const nofollowResult = addNofollowToExternalLinks(html);
  html = nofollowResult.html;
  changes.nofollowCount = nofollowResult.count;

  if (!isIndex) {
    // 2. Add health disclaimer if needed
    const disclaimerResult = addHealthDisclaimer(html, lang);
    html = disclaimerResult.html;
    changes.disclaimerAdded = disclaimerResult.added;

    // 3. Link inline citations
    const citationResult = linkInlineCitations(html);
    html = citationResult.html;
    changes.citationsLinked = citationResult.linked;
  }

  // 4. Extract external URLs for verification
  changes.externalUrls = extractExternalUrls(html);

  // Write changes if not dry run
  const modified = html !== original;
  if (modified && !DRY_RUN) {
    fs.writeFileSync(absPath, html, 'utf8');
  }

  return { changes, modified };
}

// ============================================================================
// Report generation
// ============================================================================

function generateReport(results, linkResults) {
  const now = new Date().toISOString().split('T')[0];
  let report = `# TI-97 E-E-A-T Improvements Report

Generated: ${now}
Mode: ${DRY_RUN ? 'DRY RUN (no files modified)' : 'LIVE'}

## Summary

| Metric | Count |
|--------|-------|
| Files processed | ${results.length} |
| Files modified | ${results.filter((r) => r.modified).length} |
| Nofollow links added | ${results.reduce((sum, r) => sum + r.changes.nofollowCount, 0)} |
| Disclaimers added | ${results.filter((r) => r.changes.disclaimerAdded).length} |
| Citations linked | ${results.reduce((sum, r) => sum + r.changes.citationsLinked.length, 0)} |

## Details by File

`;

  for (const result of results) {
    if (!result.modified) continue;
    const c = result.changes;
    report += `### ${c.file}

- **Nofollow added:** ${c.nofollowCount} links
- **Disclaimer:** ${c.disclaimerAdded ? 'Added' : 'Not needed'}
- **Citations linked:** ${c.citationsLinked.length > 0 ? c.citationsLinked.join(', ') : 'None'}

`;
  }

  if (linkResults && linkResults.length > 0) {
    const broken = linkResults.filter((r) => !r.ok);
    report += `## Link Verification

Total URLs checked: ${linkResults.length}
Broken/Invalid: ${broken.length}

`;
    if (broken.length > 0) {
      report += `### Broken Links

| URL | Status | Error |
|-----|--------|-------|
`;
      for (const link of broken) {
        report += `| ${link.url} | ${link.status} | ${link.error || ''} |\n`;
      }
    } else {
      report += `All links are valid.\n`;
    }
  }

  return report;
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log('TI-97 E-E-A-T Improvements');
  console.log('==========================');
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  const files = findBlogArticleFiles();
  console.log(`Found ${files.length} blog articles to process.`);
  console.log('');

  const results = [];

  for (const relPath of files) {
    const result = processFile(relPath);
    results.push(result);

    if (result.modified) {
      const c = result.changes;
      console.log(`✓ ${relPath}`);
      if (c.nofollowCount > 0) console.log(`  - Added nofollow to ${c.nofollowCount} links`);
      if (c.disclaimerAdded) console.log(`  - Added health disclaimer`);
      if (c.citationsLinked.length > 0) console.log(`  - Linked citations: ${c.citationsLinked.join(', ')}`);
    }
  }

  console.log('');
  console.log('Summary:');
  console.log(`- Files processed: ${results.length}`);
  console.log(`- Files modified: ${results.filter((r) => r.modified).length}`);
  console.log(`- Nofollow links added: ${results.reduce((sum, r) => sum + r.changes.nofollowCount, 0)}`);
  console.log(`- Disclaimers added: ${results.filter((r) => r.changes.disclaimerAdded).length}`);
  console.log(`- Citations linked: ${results.reduce((sum, r) => sum + r.changes.citationsLinked.length, 0)}`);

  // Link verification (optional)
  let linkResults = null;
  if (VERIFY_LINKS) {
    console.log('');
    console.log('Verifying external links...');
    const allUrls = [...new Set(results.flatMap((r) => r.changes.externalUrls))];
    console.log(`Checking ${allUrls.length} unique URLs...`);

    linkResults = [];
    for (const url of allUrls) {
      const result = await verifyUrl(url);
      linkResults.push(result);
      if (!result.ok) {
        console.log(`  ✗ ${url} - ${result.status}`);
      }
    }
    const broken = linkResults.filter((r) => !r.ok);
    console.log(`Link verification complete: ${broken.length} broken links found.`);
  }

  // Generate report
  if (!DRY_RUN) {
    const report = generateReport(results, linkResults);
    const reportPath = path.join(REPORT_DIR, 'TI-97-eeat-report.md');

    // Ensure report directory exists
    if (!fs.existsSync(REPORT_DIR)) {
      fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    fs.writeFileSync(reportPath, report, 'utf8');
    console.log('');
    console.log(`Report saved to: ${reportPath}`);
  }

  if (DRY_RUN) {
    console.log('');
    console.log('This was a dry run. No files were modified.');
    console.log('Run without --dry-run to apply changes.');
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
