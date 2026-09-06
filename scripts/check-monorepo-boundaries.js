#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
// Meditation CI installs only its own lockfile. Never require root dependencies there.
const ts = require(require.resolve('typescript', { paths: [process.argv.includes('--meditation') ? path.join(root, 'apps/meditation') : root] }));

const journal = /^(context\/Dreams[^/]*|hooks\/use(?:Dream|OfflineSyncQueue)|services\/(?:dream|supabaseDreamService|storageService|analysis)|lib\/(?:dreamStorageRead|analysisRequest|analysisJobPolling))(?:.*)$/;
const pure = new Set(['lib/dateUtils.ts', 'lib/circuitBreaker.ts', 'lib/authValidation.ts']);

function targetOf(source, specifier) {
  const base = source.startsWith('apps/meditation/') ? 'apps/meditation/' : '';
  if (specifier.startsWith('@/')) return path.posix.normalize(base + specifier.slice(2));
  if (specifier.startsWith('.')) return path.posix.normalize(path.posix.join(path.posix.dirname(source), specifier));
  return null;
}

function inspect(source, text) {
  const file = ts.createSourceFile(source, text, ts.ScriptTarget.Latest, true);
  const errors = [];
  function check(node) {
    if (!node || !ts.isStringLiteralLike(node)) return;
    const target = targetOf(source, node.text);
    if (!target) return;
    let rule;
    if (source.startsWith('apps/meditation/') && !target.startsWith('apps/meditation/')) rule = 'meditation-owned-runtime';
    if ((source.startsWith('lib/lucid/') || source.startsWith('app/lucid/') || source.startsWith('components/lucid/') || source.startsWith('hooks/useLucid') || source === 'context/LucidTrainerContext.tsx') && journal.test(target)) rule = 'lucid-no-journal-runtime';
    if ((pure.has(source) || source.startsWith('lib/lucid/')) && /^(app|context|hooks|components)\//.test(target)) rule = 'domain-no-application';
    if (rule) errors.push(`${source}:${file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1} -> ${target} [${rule}]`);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) check(node.moduleSpecifier);
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) check(node.moduleReference.expression);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) check(node.arguments[0]);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return errors;
}

function files(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '__tests__', '.expo', 'android', 'ios', 'coverage', 'dist'].includes(entry.name)) return [];
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? files(full) : /\.[cm]?[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [full] : [];
  });
}

function run() {
  const surfaces = process.argv.includes('--meditation') ? ['apps/meditation/app', 'apps/meditation/components', 'apps/meditation/context', 'apps/meditation/hooks', 'apps/meditation/lib', 'apps/meditation/services'] : ['lib/lucid', 'app/lucid', 'components/lucid', 'context/LucidTrainerContext.tsx', 'hooks', ...pure, 'apps/meditation/app', 'apps/meditation/components', 'apps/meditation/context', 'apps/meditation/hooks', 'apps/meditation/lib', 'apps/meditation/services'];
  const sources = surfaces.flatMap(item => { const full = path.join(root, item); return fs.existsSync(full) && fs.statSync(full).isFile() ? [full] : files(full); });
  const errors = sources.flatMap(full => inspect(path.relative(root, full).split(path.sep).join('/'), fs.readFileSync(full, 'utf8')));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`Import boundaries passed (${sources.length} source files).`);
}
if (require.main === module) run();
module.exports = { inspect, targetOf };
