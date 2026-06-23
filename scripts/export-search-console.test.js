const assert = require('assert/strict');

const { csvEscape, neutralizeCsvFormula } = require('./export-search-console');

assert.equal(
  neutralizeCsvFormula('=IMPORTXML("https://attacker.test")'),
  '\'=IMPORTXML("https://attacker.test")'
);
assert.equal(neutralizeCsvFormula('+SUM(A1:A2)'), "'+SUM(A1:A2)");
assert.equal(neutralizeCsvFormula('-10'), "'-10");
assert.equal(
  neutralizeCsvFormula('@HYPERLINK("https://attacker.test")'),
  '\'@HYPERLINK("https://attacker.test")'
);
assert.equal(neutralizeCsvFormula('\t=1+1'), "'\t=1+1");
assert.equal(neutralizeCsvFormula('\r=1+1'), "'\r=1+1");

assert.equal(csvEscape('ordinary search query'), 'ordinary search query');
assert.equal(csvEscape('query, with comma'), '"query, with comma"');
assert.equal(csvEscape('"quoted query"'), '"""quoted query"""');
assert.equal(
  csvEscape('=IMPORTXML("https://attacker.test")'),
  '"\'=IMPORTXML(""https://attacker.test"")"'
);

console.log('Search Console CSV escaping checks passed.');
