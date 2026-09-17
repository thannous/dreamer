const fs = require('fs');
const path = require('path');

const LOCALES = [
  { lang: 'fr', slug: 'reves-stress-travail', phrase: 'min de lecture' },
  { lang: 'de', slug: 'stresstraeume-von-der-arbeit-warum-ihr-job-sie-in-den-schlaf-begleitet', phrase: 'Min. Lesezeit' },
  { lang: 'es', slug: 'suenos-estres-trabajo', phrase: 'min de lectura' },
  { lang: 'it', slug: 'sogni-stressanti-sul-lavoro-perche-il-tuo-lavoro-ti-segue-nel-sonno', phrase: 'min di lettura' },
];

const STALE_TREATMENT_CLAIM = /stratégies éprouvées|estrategias probadas|strategie comprovate|entlasten k(?:ö|&ouml;)nnen|sommeil paisible|recuperar tus noches|notti serene/i;

function countWords(text) {
  const matches = text.match(/[\p{L}\p{N}]+(?:[\u2019\x27][\p{L}\p{N}]+)*/gu);
  return matches ? matches.length : 0;
}

function readingMinutesFromProse(body) {
  const start = body.indexOf('<div class="prose');
  const end = body.indexOf('<!-- CTA Section -->', start);
  const prose = start >= 0 && end >= 0 ? body.slice(start, end) : body;
  const text = prose.replace(/<[^>]+>/g, ' ');
  return Math.max(1, Math.ceil(countWords(text) / 300));
}

function workDreamIndexCard(indexSource, slug) {
  const cards = indexSource.match(/<article class="article-card[\s\S]*?<\/article>/g) || [];
  return cards.find((card) => card.includes(`href="${slug}"`));
}

describe('work-dream editorial safeguards', () => {
  for (const { lang, slug, phrase } of LOCALES) {
    const source = fs.readFileSync(path.join(__dirname, '../docs-src/content/blog/blog.stress-dreams-work', `${lang}.md`), 'utf8');
    const indexSource = fs.readFileSync(path.join(__dirname, '../docs-src/content/blog/blog.index', `${lang}.md`), 'utf8');
    const [, header, body] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = JSON.parse(header);

    it(`${lang}: preserves publication history and aligns the three FAQ answers`, () => {
      const schemas = meta.jsonLd.map(JSON.parse);
      const article = schemas.find((item) => item['@type'] === 'BlogPosting');
      const faq = schemas.find((item) => item['@type'] === 'FAQPage');
      const answers = [...body.slice(body.indexOf('<!-- FAQ Section -->')).matchAll(/<p class="mt-4 text-sm text-gray-400 leading-relaxed">\s*([\s\S]*?)\s*<\/p>/g)].map((match) => match[1].trim());
      expect(meta.publishedTime).toBe('2026-03-05');
      expect(article.datePublished).toBe(meta.publishedTime);
      expect(article.dateModified).toBe(meta.modifiedTime);
      expect(faq.mainEntity.map((item) => item.acceptedAnswer.text)).toEqual(answers);
      expect(answers).toHaveLength(3);
      expect(source).not.toMatch(/65\s*%|3[,.]2|Psychoneuroendocrinology|4-7-8|<blockquote>/);
      expect(body).toContain('https://www.nimh.nih.gov/health/publications/so-stressed-out-fact-sheet');
      expect(body).toContain('https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases');
      expect(new Set([...body.matchAll(/<h2 id="([^"]+)">/g)].map((match) => match[1])).size).toBe(7);
    });

    it(`${lang}: keeps the blog-index card excerpt aligned with the safe article description`, () => {
      const card = workDreamIndexCard(indexSource, slug);
      expect(card).toBeDefined();
      const excerpt = card.match(/<p class="text-sm text-gray-400 line-clamp-2">\s*([\s\S]*?)\s*<\/p>/)[1];
      expect(excerpt).toBe(meta.description);
      expect(card).not.toMatch(STALE_TREATMENT_CLAIM);
    });

    it(`${lang}: advertises the 300 WPM reading time on the article and index card`, () => {
      const minutes = readingMinutesFromProse(body);
      const card = workDreamIndexCard(indexSource, slug);
      expect(source).toMatch(new RegExp(`>${minutes} ${phrase.replace('.', '\\.')}<`));
      expect(card).toContain(`data-reading-time="${minutes}"`);
      expect(card).toMatch(new RegExp(`>${minutes} ${phrase.replace('.', '\\.')}<`));
    });
  }
});
