const path = require('path');

jest.mock('./docs-site-config', () => {
  const actual = jest.requireActual('./docs-site-config');
  return {
    ...actual,
    readAssetVersion: () => 'alternatives-table-test',
  };
});

const manifest = require('../../data/site-manifest.json');
const { readSourceDocument } = require('./docs-source-utils');
const { renderManagedPage } = require('./docs-renderer');

const ROOT_DIR = path.resolve(__dirname, '../..');

function renderSource(entryId, lang) {
  const sourcePath = path.join(ROOT_DIR, 'docs-src', 'content', 'pages', entryId, `${lang}.md`);
  const source = readSourceDocument(sourcePath);
  return renderManagedPage({
    manifest,
    entryId,
    meta: source.meta,
    bodyHtml: source.body,
  });
}

describe('docs renderer alternatives table integration', () => {
  it('enhances only page.alternatives and loads its dedicated stylesheet', () => {
    const html = renderSource('page.alternatives', 'en');
    const table = html.match(/<table\b[\s\S]*?<\/table>/i)?.[0] || '';

    expect(html).toContain(
      '<link rel="stylesheet" href="/css/alternatives-table.css?v=alternatives-table-test">'
    );
    expect(html).toContain('alternatives-table-section');
    expect(html).toContain('class="alternatives-table-region" role="region"');
    expect(table.match(/scope="col"/g)).toHaveLength(11);
    expect(table.match(/scope="row"/g)).toHaveLength(11);
    expect(table.match(/alternatives-table-source-link/g)).toHaveLength(11);
    expect(table.match(/<time datetime="\d{4}-\d{2}-\d{2}">/g)).toHaveLength(11);
    expect(table.match(/data-label=/g)).toHaveLength(121);
  });

  it('does not load or apply the alternatives table layer to another managed page', () => {
    const html = renderSource('page.about', 'en');

    expect(html).not.toContain('/css/alternatives-table.css');
    expect(html).not.toContain('alternatives-table-region');
  });
});
