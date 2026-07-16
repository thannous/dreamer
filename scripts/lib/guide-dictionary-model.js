const SYMBOL_ATLAS_COLUMNS = 8;

function normalizePageTitle(title) {
  return String(title || '').replace(/\s*\|\s*Noctalia\s*$/i, '').trim();
}

function normalizeDictionarySearchText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .trim();
}

function scoreDictionarySearchMatch({ query, title, slug, content }) {
  const normalizedQuery = normalizeDictionarySearchText(query);
  if (!normalizedQuery) return 0;

  const toWords = (value) => normalizeDictionarySearchText(value)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  const queryWords = toWords(normalizedQuery);
  const normalizedTitle = normalizeDictionarySearchText(title);
  const normalizedSlug = normalizeDictionarySearchText(slug);
  const titleWords = toWords(title);
  const slugWords = toWords(slug);
  const contentWords = toWords(content);
  const matchesAllWords = (words) => queryWords.every(
    (queryWord) => words.some((word) => word.startsWith(queryWord))
  );

  if (normalizedTitle === normalizedQuery) return 0;
  if (normalizedSlug === normalizedQuery) return 1;
  if (normalizedTitle.startsWith(normalizedQuery)) return 2;
  if (matchesAllWords(titleWords)) return 3;
  if (matchesAllWords(slugWords)) return 4;
  if (matchesAllWords([...titleWords, ...slugWords, ...contentWords])) return 5;
  return Number.POSITIVE_INFINITY;
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
  normalizeDictionarySearchText,
  normalizePageTitle,
  prepareDictionarySymbols,
  scoreDictionarySearchMatch,
};
