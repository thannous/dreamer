const SYMBOL_ATLAS_COLUMNS = 8;

function normalizePageTitle(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function getSymbolAtlasPosition(
  index,
  totalSymbols = SYMBOL_ATLAS_COLUMNS * SYMBOL_ATLAS_COLUMNS,
  columns = SYMBOL_ATLAS_COLUMNS
) {
  const safeColumns = Math.max(2, Number(columns) || SYMBOL_ATLAS_COLUMNS);
  const safeIndex = Math.max(0, Number(index) || 0);
  const col = safeIndex % safeColumns;
  const row = Math.floor(safeIndex / safeColumns);
  const totalRows = Math.max(1, Math.ceil(totalSymbols / safeColumns));
  const maxColumnStep = safeColumns - 1;
  const maxRowStep = Math.max(1, totalRows - 1);
  return {
    x: `${((col / maxColumnStep) * 100).toFixed(3)}%`,
    y: `${((row / maxRowStep) * 100).toFixed(3)}%`,
  };
}

function prepareDictionarySymbols(symbols, lang, columns = SYMBOL_ATLAS_COLUMNS) {
  const allSymbols = Array.isArray(symbols) ? symbols : [];
  const safeColumns = Math.max(2, Number(columns) || SYMBOL_ATLAS_COLUMNS);
  const categoryCounts = {};
  const groups = {};

  allSymbols.forEach((symbol) => {
    categoryCounts[symbol.category] = (categoryCounts[symbol.category] || 0) + 1;
  });

  [...allSymbols]
    .sort((a, b) => a[lang].name.localeCompare(b[lang].name, lang))
    .forEach((symbol) => {
      const firstChar = symbol[lang].name[0].toUpperCase();
      if (!groups[firstChar]) groups[firstChar] = [];
      groups[firstChar].push(symbol);
    });

  return {
    categoryCounts,
    groups,
    letters: Object.keys(groups).sort((a, b) => a.localeCompare(b, lang)),
    symbolAtlasRows: Math.max(1, Math.ceil(allSymbols.length / safeColumns)),
    symbolAtlasPositions: new Map(
      allSymbols.map((symbol, index) => [
        symbol.id,
        getSymbolAtlasPosition(index, allSymbols.length, safeColumns),
      ])
    ),
  };
}

module.exports = {
  SYMBOL_ATLAS_COLUMNS,
  getSymbolAtlasPosition,
  normalizePageTitle,
  prepareDictionarySymbols,
};
