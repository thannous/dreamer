'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { checkBrandTokens, normalizeColor } = require('./check-brand-tokens');
const ROOT = path.resolve(__dirname, '..');
const files = ['global.css', 'constants/journalTheme.ts', 'constants/noctaliaDesign.ts',
  'apps/meditation/global.css', 'apps/meditation/constants/theme.ts'];

const temporaryRoots = [];
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-contract-'));
  temporaryRoots.push(root);
  for (const file of files) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.copyFileSync(path.join(ROOT, file), path.join(root, file));
  }
  return {
    check: (product = 'all') => checkBrandTokens({ root, product, ts }),
    change: (file, before, after) => {
      const filename = path.join(root, file);
      const source = fs.readFileSync(filename, 'utf8');
      assert.ok(source.includes(before), `Mutation target exists: ${before}`);
      fs.writeFileSync(filename, source.replace(before, after));
    },
    root,
  };
}

test('existing product palettes and semantic differences satisfy the contract', () => {
  const f = fixture();
  const result = f.check();
  assert.deepEqual(result.errors, []);
  assert.equal(result.checked, 233);
  assert.equal(f.check('journal').checked, 188);
  assert.equal(f.check('meditation').checked, 45);
});

test('a colour mismatch identifies the product, mode and both token names', () => {
  const f = fixture();
  f.change('global.css', '--color-ivory: #fff9ef;', '--color-ivory: #ffffff;');
  assert.match(f.check().errors.join('\n'), /Journal\/Lucid dark --color-ivory ↔ textPrimary: CSS #ffffff != TypeScript #FFF9EF/);
});

test('missing CSS and TypeScript tokens fail rather than disappear from coverage', () => {
  const f = fixture();
  f.change('global.css', '--color-ivory: #fff9ef;', '');
  f.change('apps/meditation/constants/theme.ts', "accentText: '#EAD4B4',", '');
  const errors = f.check().errors.join('\n');
  assert.match(errors, /Journal\/Lucid dark --color-ivory.*Missing CSS token/);
  assert.match(errors, /Meditation dark --color-champagne-text.*Missing TypeScript token/);
});

test('each palette mode is read separately, including inherited ambience palettes', () => {
  const f = fixture();
  f.change('global.css', '--color-ink: #fbfaf7;', '--color-ink: #03040d;');
  f.change('global.css', '--color-ink: #f5ebdd;', '--color-ink: #03040d;');
  f.change('global.css', '--color-ink: #160f22;', '--color-ink: #03040d;');
  const errors = f.check().errors.join('\n');
  for (const mode of ['light', 'morning', 'afterglow']) assert.match(errors, new RegExp(`Journal/Lucid ${mode} --color-ink`));
});

test('formatting and case do not create false colour differences', () => {
  const f = fixture();
  f.change('apps/meditation/global.css', 'rgba(20, 18, 40, 0.55)', 'RGBA( 020 , 18 , 40 , .550 )');
  f.change('global.css', '#fff9ef', '#FFF9EF');
  assert.deepEqual(f.check().errors, []);
  assert.equal(normalizeColor('#ABC'), normalizeColor('#aabbcc'));
});

test('CSS defaults in Meditation are checked against its light palette', () => {
  const f = fixture();
  f.change('apps/meditation/global.css', '--color-champagne-on: #4a2f1b;', '--color-champagne-on: #9a6332;');
  assert.match(f.check().errors.join('\n'), /Meditation default --color-champagne-on ↔ textOnAccent/);
});

test('design surfaces are checked separately from the journal overlay', () => {
  const f = fixture();
  f.change('constants/noctaliaDesign.ts', "'rgba(3, 4, 13, 0.72)'", "'rgba(3, 4, 13, 0.88)'");
  assert.match(f.check().errors.join('\n'), /Journal\/Lucid design dark --color-ink-overlay ↔ surface.overlay/);
});

test('unsupported TS expressions are rejected without being executed', () => {
  const f = fixture();
  f.change('constants/journalTheme.ts', "accent: '#D4A574',", "accent: (() => { throw new Error('executed'); })(),");
  assert.throws(() => f.check(), /Unsupported TypeScript expression/);
});

test('unsupported CSS expressions and duplicate declarations fail closed', () => {
  const f = fixture();
  f.change('global.css', '--color-ivory: #fff9ef;', '--color-ivory: var(--unknown);');
  assert.match(f.check().errors.join('\n'), /Unsupported colour expression/);
  f.change('global.css', '--color-ivory: var(--unknown);', '--color-ivory: #fff9ef; --color-ivory: #fff9ef;');
  assert.throws(() => f.check(), /Duplicate CSS token dark.--color-ivory/);
});

test('Journal checking does not require Meditation sources', () => {
  const f = fixture();
  fs.rmSync(path.join(f.root, 'apps'), { recursive: true });
  assert.deepEqual(f.check('journal').errors, []);
});


test.each(['morning', 'afterglow'])('design drift in %s is rejected', mode => {
  const f = fixture();
  const original = fs.readFileSync(path.join(f.root, 'global.css'), 'utf8');
  const block = original.match(new RegExp('@variant ' + mode + '\\s*\\{([^}]+)'))[1];
  f.change('global.css', block, block.replace(/--color-ink-raised: [^;]+;/, '--color-ink-raised: #ffffff;'));
  assert.match(f.check().errors.join('\n'), new RegExp(`Journal/Lucid design ${mode} --color-ink-raised`));
});

test.each(['global.css', 'apps/meditation/global.css'])('unmapped palette colours fail in %s', file => {
  const f = fixture();
  f.change(file, '@variant light {', '@variant light { --color-new-token: #ffffff;');
  assert.match(f.check().errors.join('\n'), /light --color-new-token: Unmapped CSS colour token/);
});

test('new default colours also require an explicit contract', () => {
  const f = fixture();
  f.change('global.css', '@theme {', '@theme { --color-ink: #ffffff;');
  f.change('apps/meditation/global.css', '@theme {', '@theme { --color-new-token: #ffffff;');
  const errors = f.check().errors.join('\n');
  assert.match(errors, /Journal\/Lucid default --color-ink: Unmapped/);
  assert.match(errors, /Meditation default --color-new-token: Unmapped/);
});

test('utility-local variants are not theme palette declarations', () => {
  const f = fixture();
  fs.appendFileSync(path.join(f.root, 'global.css'), `
    @utility example { @variant dark { background: red; .child { color: blue; } } }
    .example { @variant light { color: red; } }
  `);
  assert.deepEqual(f.check().errors, []);
});

test('duplicate palette blocks still fail within the canonical scope', () => {
  const f = fixture();
  fs.appendFileSync(path.join(f.root, 'global.css'), '@layer theme { :root { @variant dark { --color-ink: #000; } } }');
  assert.throws(() => f.check(), /Duplicate CSS block dark/);
});
