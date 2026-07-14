const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  SYMBOL_ATLAS_COLUMNS,
  getSymbolAtlasPosition,
  normalizePageTitle,
  prepareDictionarySymbols,
} = require('./guide-dictionary-model');
const { materializeGeneratedPage } = require('./generated-page-writer');

describe('guide generator contracts', () => {
  let tmpRoot;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'guide-generator-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('builds localized groups, category counts, and stable atlas coordinates', () => {
    const symbols = [
      { id: 'zebra', category: 'animals', fr: { name: 'Zèbre' } },
      { id: 'arbre', category: 'nature', fr: { name: 'Arbre' } },
      { id: 'abeille', category: 'animals', fr: { name: 'Abeille' } },
    ];

    const model = prepareDictionarySymbols(symbols, 'fr');

    expect(model.categoryCounts).toEqual({ animals: 2, nature: 1 });
    expect(model.letters).toEqual(['A', 'Z']);
    expect(model.groups.A.map((symbol) => symbol.id)).toEqual(['abeille', 'arbre']);
    expect(model.symbolAtlasRows).toBe(1);
    expect(model.symbolAtlasPositions.get('zebra')).toEqual({ x: '0.000%', y: '0.000%' });
    expect(model.symbolAtlasPositions.get('abeille')).toEqual({ x: '28.571%', y: '0.000%' });
  });

  it('keeps the atlas grid and title normalization compatible with generated pages', () => {
    expect(SYMBOL_ATLAS_COLUMNS).toBe(8);
    expect(getSymbolAtlasPosition(63, 64)).toEqual({ x: '100.000%', y: '100.000%' });
    expect(getSymbolAtlasPosition(-1, 64)).toEqual({ x: '0.000%', y: '0.000%' });
    expect(normalizePageTitle('  Dream Symbols | Noctalia  ')).toBe('Dream Symbols');
    expect(normalizePageTitle('Dream Symbols')).toBe('Dream Symbols');
  });

  it('compares finalized HTML so an unchanged dry run stays clean', () => {
    const filePath = path.join(tmpRoot, 'index.html');
    const finalizeHtml = (html) => html.replace('<icon>', '<svg></svg>');
    fs.writeFileSync(filePath, '<main><svg></svg></main>', 'utf8');

    const result = materializeGeneratedPage({
      filePath,
      renderedHtml: '<main><icon></main>',
      finalizeHtml,
      dryRun: true,
    });

    expect(result.changed).toBe(false);
    expect(result.html).toBe('<main><svg></svg></main>');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('<main><svg></svg></main>');
  });

  it('reports changes in dry-run mode without writing them', () => {
    const filePath = path.join(tmpRoot, 'index.html');
    fs.writeFileSync(filePath, 'before', 'utf8');

    const result = materializeGeneratedPage({
      filePath,
      renderedHtml: 'after',
      dryRun: true,
    });

    expect(result.changed).toBe(true);
    expect(fs.readFileSync(filePath, 'utf8')).toBe('before');
  });
});
