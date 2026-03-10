const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  assertDocsBuildReady,
  docsBuildStatePath,
  markDocsBuildFailed,
  markDocsBuildStarted,
  markDocsBuildSucceeded,
  normalizeForSearch,
  readDocsBuildState,
} = require('./docs-check-helpers');

describe('docs-check-helpers', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-check-helpers-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('normalizes accents, entities, punctuation and spacing for search matching', () => {
    expect(normalizeForSearch('¿Qué&nbsp;significa soñar con agua?')).toBe(
      '¿que significa sonar con agua?'
    );
    expect(normalizeForSearch('Rêves   d’ Eau')).toBe("reves d' eau");
  });

  it('blocks checks while a docs build is in progress', () => {
    markDocsBuildStarted(tmpRoot);

    expect(() => assertDocsBuildReady(tmpRoot)).toThrow(/currently in progress/i);
    expect(readDocsBuildState(tmpRoot)?.status).toBe('building');
  });

  it('allows checks again after a successful docs build', () => {
    markDocsBuildStarted(tmpRoot);
    markDocsBuildSucceeded(tmpRoot, { version: '20260310-130000' });

    expect(() => assertDocsBuildReady(tmpRoot)).not.toThrow();
    expect(readDocsBuildState(tmpRoot)).toMatchObject({
      status: 'ready',
      version: '20260310-130000',
    });
  });

  it('surfaces the last build failure with context', () => {
    markDocsBuildFailed(tmpRoot, new Error('sitemap generation failed'));

    expect(() => assertDocsBuildReady(tmpRoot)).toThrow(/sitemap generation failed/i);
    expect(fs.existsSync(docsBuildStatePath(tmpRoot))).toBe(true);
  });
});
