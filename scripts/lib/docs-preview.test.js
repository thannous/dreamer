const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { contentTypeFor, resolveRequestToFile } = require('./docs-preview');

describe('local site routes', () => {
  let root;
  beforeAll(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-preview-'));
    fs.mkdirSync(path.join(root, 'rêves'));
    for (const file of ['rêves.html', 'rêves/index.html', 'cover.avif', 'download', 'download.html']) {
      fs.writeFileSync(path.join(root, file), file);
    }
  });
  afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

  it.each([
    ['/r%C3%AAves?ref=menu', 'rêves.html'],
    ['/r%C3%AAves/', 'rêves/index.html'],
    ['/download', 'download'],
  ])('resolves %s to %s', (request, expected) => {
    expect(resolveRequestToFile(root, request)).toBe(path.join(root, expected));
  });

  it('serves AVIF artwork with its image type', () => {
    expect(contentTypeFor(resolveRequestToFile(root, '/cover.avif'))).toBe('image/avif');
  });

  it('returns the missing-page result for a malformed URL and a missing page', () => {
    expect(resolveRequestToFile(root, '/%zz')).toBeNull();
    expect(resolveRequestToFile(root, '/absent')).toBeNull();
  });
});
