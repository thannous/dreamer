const { csvEscape, neutralizeCsvFormula } = require('./export-search-console');

describe('Search Console CSV export escaping', () => {
  it('neutralizes formula-like values before writing CSV', () => {
    expect(neutralizeCsvFormula('=IMPORTXML("https://attacker.test")')).toBe(
      '\'=IMPORTXML("https://attacker.test")'
    );
    expect(neutralizeCsvFormula('+SUM(A1:A2)')).toBe("'+SUM(A1:A2)");
    expect(neutralizeCsvFormula('-10')).toBe("'-10");
    expect(neutralizeCsvFormula('@HYPERLINK("https://attacker.test")')).toBe(
      '\'@HYPERLINK("https://attacker.test")'
    );
    expect(neutralizeCsvFormula('\t=1+1')).toBe("'\t=1+1");
    expect(neutralizeCsvFormula('\r=1+1')).toBe("'\r=1+1");
  });

  it('escapes CSV cells after formula neutralization', () => {
    expect(csvEscape('ordinary search query')).toBe('ordinary search query');
    expect(csvEscape('query, with comma')).toBe('"query, with comma"');
    expect(csvEscape('"quoted query"')).toBe('"""quoted query"""');
    expect(csvEscape('=IMPORTXML("https://attacker.test")')).toBe(
      '"\'=IMPORTXML(""https://attacker.test"")"'
    );
  });
});
