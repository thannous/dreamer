const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { evaluateDiff, evaluatePaths, matches } = require('./check-pages-build-impact');

describe('Pages build watch paths', () => {
  it.each([
    'docs-src/content/blog/example/fr.md', 'docs-src/static/data/curation-pages.json',
    'data/dream-symbols.json', 'data/practicalDreamGuides.ts',
    'scripts/lib/docs-renderer.js', 'scripts/new-generator.js',
    'package.json', 'package-lock.json', '.nvmrc', '.npmrc',
    '.circleci/continue.yml', 'assets/new-shared-font.ttf', 'new-unclassified/input.json',
    'apps/new-product/package.json',
  ])('keeps site, shared and unknown input %s', file => {
    expect(evaluatePaths([file]).build).toBe(true);
  });

  it.each(['app/lucid/morning.tsx', 'components/journal/Entry.tsx',
    'apps/meditation/services/player.ts', 'doc_web_interne/docs/plan.md',
    'specs/noctalia-lucid-trainer.md', 'marketing/seo/report.md'])('skips isolated input %s', file => {
    expect(evaluatePaths([file]).build).toBe(false);
  });

  it('keeps shared input in a mixed push, including manifest-only changes', () => {
    expect(evaluatePaths(['app/index.tsx', 'package.json']).relevantPaths).toEqual(['package.json']);
  });

  it('implements Pages wildcard semantics without interpreting regex metacharacters', () => {
    expect(matches('app/*', 'app/lucid/(tabs)/morning.tsx')).toBe(true);
    expect(matches('app/*', 'application/index.tsx')).toBe(false);
    expect(matches('file.json', 'fileXjson')).toBe(false);
  });

  it('keeps provider fallbacks for empty, large or unknown pushes', () => {
    expect(evaluatePaths([]).build).toBe(true);
    expect(evaluatePaths(['app/a.ts'], { commitCount: 20 }).build).toBe(true);
    expect(evaluatePaths(Array(3000).fill('app/a.ts')).build).toBe(true);
    expect(evaluatePaths(['app/a.ts'], { commitCount: NaN }).build).toBe(true);
  });

  it('checks both sides of renames and deletions with a real Git diff', () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-impact-'));
    const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    try {
      git(['init', '-q']);
      git(['config', 'user.name', 'Fixture']);
      git(['config', 'user.email', 'fixture@example.invalid']);
      fs.mkdirSync(path.join(cwd, 'docs-src'));
      fs.mkdirSync(path.join(cwd, 'app'));
      fs.writeFileSync(path.join(cwd, 'docs-src/page.md'), 'content');
      git(['add', '.']); git(['commit', '-qm', 'base']);
      const base = git(['rev-parse', 'HEAD']);
      git(['mv', 'docs-src/page.md', 'app/page.md']);
      git(['commit', '-qm', 'move']);
      expect(evaluateDiff(base, 'HEAD', { cwd }).relevantPaths).toEqual(['docs-src/page.md']);
      expect(evaluateDiff('missing-base', 'HEAD', { cwd }).build).toBe(true);
      expect(evaluateDiff('HEAD', base, { cwd }).build).toBe(true);
    } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
  });
});
