const fs = require('fs');

const { buildAppDictionary, OUTPUTS } = require('./sync-app-symbol-dictionary');

// The app bundles data/app/ while the site keeps editing data/dream-symbols*.json.
// A dictionary edit without a re-sync would ship stale text in the app only.
test('the app copy of the symbol dictionary matches its sources', () => {
  const built = buildAppDictionary();
  for (const key of Object.keys(OUTPUTS)) {
    expect(fs.readFileSync(OUTPUTS[key], 'utf8')).toBe(built[key]);
  }
});
