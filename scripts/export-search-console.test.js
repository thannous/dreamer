const path = require('path');

const {
  csvEscape,
  neutralizeCsvFormula,
  parseArgs,
  querySearchAnalytics,
  resolveOutputDir,
} = require('./export-search-console');

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

describe('Search Console search type', () => {
  it('defaults to web and accepts image or discover', () => {
    expect(parseArgs(['--start', '2026-04-15', '--end', '2026-07-12']).type).toBe('web');
    expect(
      parseArgs(['--type', 'image', '--start', '2026-04-15', '--end', '2026-07-12']).type
    ).toBe('image');
    expect(
      parseArgs(['--type', 'DISCOVER', '--start', '2026-04-15', '--end', '2026-07-12']).type
    ).toBe('discover');
  });

  it('rejects unsupported search types', () => {
    expect(() =>
      parseArgs(['--type', 'video', '--start', '2026-04-15', '--end', '2026-07-12'])
    ).toThrow('--type must be one of: web, image, discover; got: video');
  });

  it('sends the selected type to every Search Analytics request', async () => {
    const previousFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ rows: [] }),
    });

    try {
      await querySearchAnalytics({
        token: 'test-token',
        quotaProjectId: '',
        site: 'sc-domain:noctalia.app',
        startDate: '2026-04-15',
        endDate: '2026-07-12',
        dimensions: ['page'],
        rowLimit: 100,
        searchType: 'image',
      });

      const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(requestBody.type).toBe('image');
    } finally {
      global.fetch = previousFetch;
    }
  });
});

describe('Search Console output directory', () => {
  const args = {
    out: path.join('/tmp', 'gsc-export'),
    type: 'image',
    start: '2026-04-15',
    end: '2026-07-12',
  };

  it('separates exports by search type and date range', () => {
    expect(resolveOutputDir(args, () => false)).toBe(
      path.join('/tmp', 'gsc-export', 'image', '2026-04-15_to_2026-07-12')
    );
  });

  it('uses a numeric suffix instead of overwriting an existing export', () => {
    const occupied = new Set([
      path.join('/tmp', 'gsc-export', 'image', '2026-04-15_to_2026-07-12'),
      path.join('/tmp', 'gsc-export', 'image', '2026-04-15_to_2026-07-12-2'),
    ]);

    expect(resolveOutputDir(args, (candidate) => occupied.has(candidate))).toBe(
      path.join('/tmp', 'gsc-export', 'image', '2026-04-15_to_2026-07-12-3')
    );
  });
});
