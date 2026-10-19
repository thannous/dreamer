const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const { TARGETS, BASELINE } = require('./check-lint-warnings');

const script = path.join(__dirname, 'check-lint-warnings.js');
let root;
beforeEach(() => { root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-warning-guard-')); });
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

async function fixture(source) {
  fs.writeFileSync(path.join(root, 'eslint.config.cjs'), "module.exports = [{ rules: { 'no-unused-vars': 'warn', 'no-undef': 'error' } }];\n");
  for (const target of TARGETS) {
    fs.mkdirSync(path.join(root, target), { recursive: true });
    fs.writeFileSync(path.join(root, target, 'empty.js'), 'export {};\n');
  }
  fs.writeFileSync(path.join(root, 'app', 'example.js'), source);
  const seeded = spawnSync(process.execPath, ['-e', `
    const fs = require('node:fs');
    const { ESLint } = require(process.argv[1]);
    const { TARGETS, BASELINE, collectWarnings } = require(process.argv[2]);
    (async () => {
      const results = await new ESLint({ cwd: process.cwd() }).lintFiles(TARGETS);
      fs.writeFileSync(BASELINE, JSON.stringify({ schemaVersion: 1, targets: TARGETS, warnings: collectWarnings(results, process.cwd()) }, null, 2));
    })().catch(error => { console.error(error); process.exitCode = 1; });
  `, require.resolve('eslint'), script], { cwd: root, encoding: 'utf8' });
  expect(seeded.error).toBeUndefined(); expect(seeded.status).toBe(0);
}
function run(...args) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd: root, encoding: 'utf8' });
  expect(result.error).toBeUndefined();
  return { status: result.status, output: result.stdout + result.stderr };
}

// A UI journey cannot detect CLI fingerprint identity, scope or allowance reuse.
test('real ESLint accepts known warnings after line-only moves, rejects a new warning even when the total falls', async () => {
  await fixture('const known = 1;\nconst retired = 2;\nconst former = 3;\n');
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), '// An unrelated comment shifts diagnostic locations.\n\nconst known = 1;\nconst retired = 2;\nconst former = 3;\n');
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'const known = 1;\n');
  fs.writeFileSync(path.join(root, 'components', 'new.js'), 'const surprise = 4;\n');
  const prior = fs.readFileSync(path.join(root, BASELINE), 'utf8');
  const result = run('--prune');
  expect(result.status).toBe(1); expect(result.output).toContain('New ESLint warnings');
  expect(fs.readFileSync(path.join(root, BASELINE), 'utf8')).toBe(prior);
});

test('resolving warnings requires pruning and the removed allowance cannot accept a reintroduced warning', async () => {
  await fixture('const known = 1;\nconst retired = 2;\n');
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'const known = 1;\n');
  expect(run().status).toBe(1);
  expect(run('--prune').status).toBe(0);
  expect(JSON.parse(fs.readFileSync(path.join(root, BASELINE), 'utf8')).warnings).toHaveLength(1);
  expect(run().status).toBe(0);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'const known = 1;\nconst retired = 2;\n');
  expect(run().status).toBe(1);
});

test('warning multiplicity and ESLint errors cannot use an existing warning fingerprint', async () => {
  await fixture('export function first() { const unused = 1; }\n');
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'export function first() { const unused = 1; }\nexport function second() { const unused = 1; }\n');
  expect(run().status).toBe(1);
  fs.writeFileSync(path.join(root, 'app', 'example.js'), 'export function first() { const unused = 1; missingGlobal(); }\n');
  const prior = fs.readFileSync(path.join(root, BASELINE), 'utf8');
  const result = run('--prune');
  expect(result.status).toBe(1); expect(result.output).toContain('ESLint errors remain fatal');
  expect(fs.readFileSync(path.join(root, BASELINE), 'utf8')).toBe(prior);
});
