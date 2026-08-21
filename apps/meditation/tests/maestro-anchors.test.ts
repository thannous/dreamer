/// <reference types="node" />

import fs from 'fs';
import path from 'path';

import { TID } from '@/lib/testIDs';

/**
 * The Maestro flows cannot run here — no emulator, no Maestro CLI. What can be
 * checked is that they are not fiction: every `id:` a flow targets must exist
 * in the source, and every anchor declared must be used.
 *
 * This is what stops a renamed testID from silently turning a green suite into
 * a suite that tests nothing.
 */
const ROOT = path.resolve(__dirname, '..');
const FLOW_DIR = path.join(ROOT, 'maestro');

const readSource = (): string => {
  // `context` counts too: a provider can render chrome of its own — the touch
  // catcher behind progressive silence lives in one.
  const dirs = ['app', 'components', 'context', 'lib'];
  const files: string[] = [];

  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) files.push(full);
    }
  };

  dirs.forEach((dir) => walk(path.join(ROOT, dir)));
  return files.map((file) => fs.readFileSync(file, 'utf8')).join('\n');
};

const flowFiles = fs
  .readdirSync(FLOW_DIR)
  .filter((file) => file.endsWith('.yml'))
  .map((file) => ({ name: file, body: fs.readFileSync(path.join(FLOW_DIR, file), 'utf8') }));

/** Every `id: 'x'` a flow targets. */
const targetedIds = (body: string): string[] =>
  [...body.matchAll(/id:\s*'([^']+)'/g)].map((match) => match[1]);

const declaredIds = (): string[] => {
  const collect = (node: object): string[] =>
    Object.values(node).flatMap((value) =>
      typeof value === 'string' ? [value] : collect(value as object)
    );
  return collect(TID);
};

/** `TID.Tab.Home` — how the constants are actually referenced in components. */
const declaredPaths = (): { path: string; id: string }[] =>
  Object.entries(TID).flatMap(([group, entries]) =>
    Object.entries(entries as Record<string, string>).map(([key, id]) => ({
      path: `TID.${group}.${key}`,
      id,
    }))
  );

describe('Maestro flows', () => {
  it('ships at least the flows the spec lists', () => {
    const names = flowFiles.map((flow) => flow.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'onboarding.yml',
        'session-playback.yml',
        'breathing.yml',
        'paywall.yml',
        'settings.yml',
        'smoke.yml',
      ])
    );
  });

  it.each(flowFiles.map((flow) => flow.name))('%s declares the app id', (name) => {
    const flow = flowFiles.find((item) => item.name === name)!;
    expect(flow.body).toContain('appId: com.noctalia.meditation');
  });

  it('targets only ids the app actually renders', () => {
    const source = readSource();
    const known = new Set(declaredIds());

    const unknown = flowFiles.flatMap((flow) =>
      targetedIds(flow.body)
        .filter((id) => !known.has(id))
        // `lang.<code>` is built from the language list at render time.
        .filter((id) => !/^lang\.[a-z]{2}$/.test(id))
        .filter((id) => !source.includes(id))
        .map((id) => `${flow.name}: ${id}`)
    );

    expect(unknown).toEqual([]);
  });

  it('wires every anchor it declares into a screen', () => {
    // An unused anchor is either a forgotten flow or a stale constant; both are
    // worth failing on rather than accumulating. Components reference the
    // constant (`TID.Tab.Home`), never the raw string, so that is what to look
    // for — counting string literals only ever finds the declaration itself.
    const source = readSource();
    const unused = declaredPaths()
      .filter(({ path: constantPath }) => !source.includes(constantPath))
      .map(({ path: constantPath, id }) => `${constantPath} (${id})`);

    expect(unused).toEqual([]);
  });
});
