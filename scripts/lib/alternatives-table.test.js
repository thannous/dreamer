const fs = require('fs');
const path = require('path');

const {
  COMPARISON_DATA_PATH,
  enhanceAlternativesTable,
  loadComparisonData,
  parseComparisonData,
} = require('./alternatives-table');

const ROOT_DIR = path.resolve(__dirname, '../..');
const LANGUAGES = ['en', 'fr', 'es', 'de', 'it', 'pt-br'];
const ALTERNATIVES_SOURCE_DIR = path.join(
  ROOT_DIR,
  'docs-src',
  'content',
  'pages',
  'page.alternatives'
);
const SOURCE_LANGUAGES = LANGUAGES.filter((lang) =>
  fs.existsSync(path.join(ALTERNATIVES_SOURCE_DIR, `${lang}.md`))
);

function sourceBody(lang) {
  const sourcePath = path.join(ALTERNATIVES_SOURCE_DIR, `${lang}.md`);
  const raw = fs.readFileSync(sourcePath, 'utf8');
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`Missing source body in ${sourcePath}`);
  return match[1];
}

function decodeAttribute(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

describe('alternatives comparison table build contract', () => {
  it('loads exactly 11 unique source URLs and review dates from the canonical CSV', () => {
    const records = loadComparisonData();

    expect(records.size).toBe(11);
    for (const [app, record] of records) {
      expect(record.app).toBe(app);
      expect(record.source_url).toMatch(/^https?:\/\//);
      expect(record.last_reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('rejects a comparison CSV that does not preserve the 11-app contract', () => {
    const source = fs.readFileSync(COMPARISON_DATA_PATH, 'utf8');
    const withoutLastRow = source.trimEnd().split('\n').slice(0, -1).join('\n');

    expect(() => parseComparisonData(withoutLastRow)).toThrow(
      'Comparison CSV must contain exactly 11 apps'
    );
  });

  it('provides the table-specific visible copy in every supported locale', () => {
    for (const lang of LANGUAGES) {
      const locale = JSON.parse(
        fs.readFileSync(path.join(ROOT_DIR, 'docs-src', 'locales', `${lang}.json`), 'utf8')
      );
      expect(locale.alternativesTableCaption).toBeTruthy();
      expect(locale.alternativesTableHint).toBeTruthy();
      expect(locale.alternativesTableSource).toBeTruthy();
      expect(locale.alternativesTableReviewed).toBeTruthy();
    }
  });

  it.each(SOURCE_LANGUAGES)(
    'renders accessible %s table semantics plus all 11 centralized sources and dates',
    (lang) => {
      const locale = JSON.parse(
        fs.readFileSync(path.join(ROOT_DIR, 'docs-src', 'locales', `${lang}.json`), 'utf8')
      );
      const records = loadComparisonData();
      const html = enhanceAlternativesTable(sourceBody(lang), {
        lang,
        languageTag: lang,
        locale,
      });
      const table = html.match(/<table\b[\s\S]*?<\/table>/i)?.[0] || '';
      const rows = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].slice(1);

      expect(html).toContain(
        `class="alternatives-table-region" role="region" aria-label="${locale.alternativesTableCaption}"`
      );
      expect(table).toContain(
        `<caption class="alternatives-table-caption">${locale.alternativesTableCaption}</caption>`
      );
      expect(html).toContain(locale.alternativesTableHint);
      expect(table.match(/<th\b[^>]*scope="col"/g)).toHaveLength(11);
      expect(rows).toHaveLength(11);
      expect(table.match(/<th\b[^>]*scope="row"/g)).toHaveLength(11);
      expect(table.match(/data-label=/g)).toHaveLength(121);

      for (const row of rows) {
        const cells = [...row[1].matchAll(/<(th|td)\b([^>]*)>([\s\S]*?)<\/\1>/gi)];
        const rowHeader = cells[0][0];
        const app = rowHeader.match(
          /<span class="alternatives-table-app-name">([\s\S]*?)<\/span>/i
        )?.[1].trim();
        const record = records.get(app);
        const sourceUrl = rowHeader.match(
          /<a href="([^"]+)" class="alternatives-table-source-link"/i
        )?.[1];
        const reviewed = rowHeader.match(/<time datetime="([^"]+)">/i)?.[1];

        expect(cells).toHaveLength(11);
        expect(rowHeader).toMatch(/^<th\b[^>]*scope="row"/i);
        expect(record).toBeDefined();
        expect(decodeAttribute(sourceUrl)).toBe(record.source_url);
        expect(reviewed).toBe(record.last_reviewed);
        for (const cell of cells) expect(cell[2]).toMatch(/\bdata-label="[^"]+"/i);
      }
    }
  );

  it('ships a dedicated card layout below 1024px without horizontal scrolling', () => {
    const css = fs.readFileSync(
      path.join(ROOT_DIR, 'docs-src', 'static', 'css', 'alternatives-table.css'),
      'utf8'
    );
    const mobileStart = css.indexOf('@media (max-width: 1023px)');
    const mobileEnd = css.indexOf('@media (max-width: 520px)');
    const mobile = css.slice(mobileStart, mobileEnd);

    expect(mobileStart).toBeGreaterThanOrEqual(0);
    expect(mobileEnd).toBeGreaterThan(mobileStart);
    expect(css).toContain('.alternatives-table tbody th[scope="row"]');
    expect(css).toContain('content: attr(data-label)');
    expect(css).toContain('position: sticky');
    expect(mobile).toContain('overflow: visible');
    expect(mobile).toContain('min-width: 0 !important');
    expect(mobile).toContain('display: grid');
    expect(mobile).not.toContain('overflow-x: auto');
  });
});
