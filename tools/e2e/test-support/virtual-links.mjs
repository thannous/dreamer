import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { basename, dirname, join, resolve } from 'node:path';

// Keep real files/hashes, but simulate link metadata on every OS. Creating a
// Windows file symlink requires privileges unrelated to these guard assertions.
export function virtualLinks(t) {
  const links = new Map();
  const real = { lstatSync: fs.lstatSync, realpathSync: fs.realpathSync, readdirSync: fs.readdirSync };
  // A link has one identity even when traversal enters through a filesystem alias.
  // Resolve only its parent: resolving the link itself would follow its target.
  const key = file => {
    const absolute = resolve(file);
    return join(real.realpathSync(dirname(absolute)), basename(absolute));
  };
  const mocks = [
    t.mock.method(fs, 'lstatSync', (path, ...args) => links.has(key(path))
      ? { isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false }
      : real.lstatSync(path, ...args)),
    t.mock.method(fs, 'realpathSync', Object.assign((path, ...args) => real.realpathSync(links.get(key(path)) ?? path, ...args), real.realpathSync)),
    t.mock.method(fs, 'readdirSync', (path, ...args) => real.readdirSync(path, ...args).map(entry =>
      typeof entry === 'string' || !links.has(key(join(path, entry.name))) ? entry : {
        name: entry.name, parentPath: entry.parentPath,
        isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false,
      })),
  ];
  syncBuiltinESMExports();
  t.after(() => { for (const mock of mocks) mock.mock.restore(); syncBuiltinESMExports(); });
  return {
    link(target, file) { fs.writeFileSync(file, 'virtual link'); links.set(key(file), resolve(dirname(file), target)); },
    unlink(file) { links.delete(key(file)); fs.rmSync(file); },
  };
}
