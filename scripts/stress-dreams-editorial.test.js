const fs = require('fs');
const path = require('path');

describe('work-dream editorial safeguards', () => {
  for (const lang of ['fr', 'de', 'es', 'it']) {
    it(`${lang}: preserves publication history and aligns the three FAQ answers`, () => {
      const source = fs.readFileSync(path.join(__dirname, '../docs-src/content/blog/blog.stress-dreams-work', `${lang}.md`), 'utf8');
      const [, header, body] = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const meta = JSON.parse(header);
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
  }
});
