const fs = require('node:fs');
const path = require('node:path');
const { inspect } = require('./check-monorepo-boundaries');

const syntaxes = [
  "import { useDreams } from '@/context/DreamsContext'",
  "export * from '../../context/DreamsContext'",
  "const x = require('@/context/DreamsContext')",
  "const x = import('@/context/DreamsContext')",
  "import x = require('@/context/DreamsContext')",
];
test.each(syntaxes)('Lucid blocks Journal access: %s', source => {
  expect(inspect('lib/lucid/example.ts', source)).toEqual([expect.stringMatching(/lib\/lucid\/example.ts:1 -> context\/DreamsContext \[(domain-no-application|lucid-no-journal-runtime)\]/)]);
});
test.each(['app/lucid/example.tsx', 'context/LucidTrainerContext.tsx', 'components/lucid/example.tsx', 'hooks/useLucidExample.ts'])('Lucid consumer %s cannot access Journal', source => {
  expect(inspect(source, "import x from '@/services/storageService'")).toEqual([expect.stringContaining('[lucid-no-journal-runtime]')]);
});
test('Meditation alias belongs to its package, relative escapes are forbidden', () => {
  expect(inspect('apps/meditation/services/example.ts', "import x from '@/context/WorldPurchaseContext'")).toEqual([]);
  expect(inspect('apps/meditation/services/example.ts', "export * from '../../../context/DreamsContext'")).toEqual([expect.stringContaining('[meditation-owned-runtime]')]);
});
test('pure primitives cannot depend on application providers', () => {
  expect(inspect('lib/dateUtils.ts', "import x from '././../context/ThemeContext'")).toEqual([expect.stringContaining('[domain-no-application]')]);
});
test('own observations and neutral contracts remain permitted; comments are not imports', () => {
  expect(inspect('lib/lucid/example.ts', "import type { LucidObservation } from './observations'; import type { Language } from '../types'; // import x from '@/context/DreamsContext'" )).toEqual([]);
});
test('shared map names existing inputs and actual shared execution consumers', () => {
  const root = path.resolve(__dirname, '..');
  const rows = fs.readFileSync(path.join(root, '.circleci/dependency-consumers.tsv'), 'utf8').trim().split('\n').filter(line => !line.startsWith('#')).map(line => line.split('\t'));
  expect(new Set(rows.map(row => row[0])).size).toBe(rows.length);
  for (const [input, graph, consumers] of rows) {
    expect(fs.existsSync(path.join(root, input))).toBe(true);
    expect(['build', 'execution', 'content', 'contract']).toContain(graph);
    for (const consumer of consumers.split(' ')) expect(['noctalia', 'meditation', 'site', 'edge_functions', 'edge_contracts']).toContain(consumer);
  }
  expect(fs.readFileSync(path.join(root, 'apps/meditation/package.json'), 'utf8')).toContain('scripts/android-device-lock.js');
  expect(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).toContain('scripts/expo-safe-runner.js');
  expect(fs.readFileSync(path.join(root, 'scripts/expo-safe-runner.js'), 'utf8')).toContain("require('./android-device-lock')");
});

test.each(["import x from '@/services/supabaseDreamService'", "export * from '../../services/supabaseDreamService'", "const x = import('@/services/supabaseDreamService')", "const x = require('../../services/supabaseDreamService')"] )('Journal remote access is forbidden: %s', text => {
  expect(inspect('app/lucid/example.tsx', text)).toEqual([expect.stringContaining('[lucid-no-journal-runtime]')]);
});

test('package aliases still match the resolver contract', () => {
  const root = path.resolve(__dirname, '..');
  for (const config of ['tsconfig.json', 'apps/meditation/tsconfig.json']) {
    const paths = JSON.parse(fs.readFileSync(path.join(root, config), 'utf8')).compilerOptions.paths;
    expect(paths).toEqual({ '@/*': ['./*'] });
  }
});
