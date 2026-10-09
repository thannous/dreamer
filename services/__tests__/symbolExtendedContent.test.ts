// The symbol screen has no E2E journey that can cut the network between two
// launches, so this covers the offline cases: a first visit offline, a later
// launch offline after one download, and a damaged copy on disk.
const mockFiles = new Map<string, string>();
const mockFetchJSON = jest.fn();

jest.mock('expo-file-system', () => {
  class MockDirectory {
    uri: string;
    constructor(parent: { uri: string } | string, name: string) {
      this.uri = `${typeof parent === 'string' ? parent : parent.uri}/${name}`;
    }
    create() {}
  }
  class MockFile {
    uri: string;
    constructor(parent: { uri: string }, name: string) {
      this.uri = `${parent.uri}/${name}`;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    async text() {
      return mockFiles.get(this.uri) ?? '';
    }
    write(value: string) {
      mockFiles.set(this.uri, value);
    }
  }
  return { Directory: MockDirectory, File: MockFile, Paths: { document: { uri: 'doc' } } };
});

jest.mock('@/lib/http', () => ({ fetchJSON: (...args: unknown[]) => mockFetchJSON(...args) }));

const WATER = { water: { fullInterpretation: '<p>Deep water.</p>', variations: [] } };
const CACHE_URI = 'doc/symbol-content/en.json';

function loadFreshModule(): typeof import('@/services/symbolExtendedContent') {
  let mod: typeof import('@/services/symbolExtendedContent') | undefined;
  jest.isolateModules(() => {
    mod = require('@/services/symbolExtendedContent');
  });
  return mod!;
}

describe('symbolExtendedContent', () => {
  beforeEach(() => {
    mockFiles.clear();
    mockFetchJSON.mockReset();
  });

  it('rejects on a first visit offline, then downloads once and keeps the copy on disk', async () => {
    const service = loadFreshModule();
    mockFetchJSON.mockRejectedValueOnce(new Error('Network request failed'));
    await expect(service.loadExtendedSymbolContent('en')).rejects.toThrow('Network request failed');

    mockFetchJSON.mockResolvedValueOnce(WATER);
    await expect(service.loadExtendedSymbolContent('en')).resolves.toEqual(WATER);
    expect(mockFetchJSON).toHaveBeenLastCalledWith('https://noctalia.app/content/symbols/en.json', expect.anything());
    expect(JSON.parse(mockFiles.get(CACHE_URI)!)).toEqual(WATER);
  });

  it('serves the copy on disk on a later launch even when the refresh fails', async () => {
    mockFiles.set(CACHE_URI, JSON.stringify(WATER));
    mockFetchJSON.mockRejectedValue(new Error('Network request failed'));

    const service = loadFreshModule();
    await expect(service.loadExtendedSymbolContent('en')).resolves.toEqual(WATER);
    expect(service.peekExtendedSymbolContent('en')).toEqual(WATER);
  });

  it('downloads again when the copy on disk is damaged', async () => {
    mockFiles.set(CACHE_URI, '{"water": {"fullInterp');
    mockFetchJSON.mockResolvedValueOnce(WATER);

    const service = loadFreshModule();
    await expect(service.loadExtendedSymbolContent('en')).resolves.toEqual(WATER);
    expect(mockFetchJSON).toHaveBeenCalledTimes(1);
  });
});
