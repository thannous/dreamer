'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { promoteValidatedDocs } = require('./docs-release-check');

function writeFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

describe('docs release artifact promotion', () => {
  let tempRoot;
  let sourceRoot;
  let destinationRoot;

  beforeEach(() => {
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-release-promotion-test-'));
    sourceRoot = path.join(tempRoot, 'source');
    destinationRoot = path.join(tempRoot, 'destination');
    fs.mkdirSync(sourceRoot, { recursive: true });
    fs.mkdirSync(destinationRoot, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it('replaces local docs with the exact validated artifact and build state', () => {
    writeFile(path.join(sourceRoot, 'docs', 'index.html'), 'validated');
    writeFile(path.join(sourceRoot, 'docs', 'nested', 'page.html'), 'nested');
    writeFile(
      path.join(sourceRoot, '.docs-build-state.json'),
      `${JSON.stringify({ status: 'ready', version: 'release-123' })}\n`
    );
    writeFile(path.join(destinationRoot, 'docs', 'stale.html'), 'stale');
    writeFile(
      path.join(destinationRoot, '.docs-build-state.json'),
      `${JSON.stringify({ status: 'ready', version: 'old' })}\n`
    );

    promoteValidatedDocs(sourceRoot, destinationRoot);

    expect(fs.readFileSync(path.join(destinationRoot, 'docs', 'index.html'), 'utf8')).toBe(
      'validated'
    );
    expect(fs.readFileSync(path.join(destinationRoot, 'docs', 'nested', 'page.html'), 'utf8')).toBe(
      'nested'
    );
    expect(fs.existsSync(path.join(destinationRoot, 'docs', 'stale.html'))).toBe(false);
    expect(
      JSON.parse(fs.readFileSync(path.join(destinationRoot, '.docs-build-state.json'), 'utf8'))
    ).toEqual({ status: 'ready', version: 'release-123' });
  });

  it('keeps the existing local artifact when the source build is not ready', () => {
    writeFile(path.join(sourceRoot, 'docs', 'index.html'), 'partial');
    writeFile(
      path.join(sourceRoot, '.docs-build-state.json'),
      `${JSON.stringify({ status: 'building' })}\n`
    );
    writeFile(path.join(destinationRoot, 'docs', 'index.html'), 'existing');

    expect(() => promoteValidatedDocs(sourceRoot, destinationRoot)).toThrow(
      'Validated docs artifact is not ready: building'
    );
    expect(fs.readFileSync(path.join(destinationRoot, 'docs', 'index.html'), 'utf8')).toBe(
      'existing'
    );
  });
});
