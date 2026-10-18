import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { join, resolve } from 'node:path';

// Keep real files/hashes, but simulate link metadata on every OS. Creating a
// Windows file symlink requires privileges unrelated to these guard assertions.
export function virtualLinks(t) {
  const links = new Map();
  const real = { lstatSync: fs.lstatSync, realpathSync: fs.realpathSync, readdirSync: fs.readdirSync };
  const mocks = [
    t.mock.method(fs, 'lstatSync', (path, ...args) => links.has(resolve(path))
      ? { isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false }
      : real.lstatSync(path, ...args)),
    t.mock.method(fs, 'realpathSync', Object.assign((path, ...args) => real.realpathSync(links.get(resolve(path)) ?? path, ...args), real.realpathSync)),
    t.mock.method(fs, 'readdirSync', (path, ...args) => real.readdirSync(path, ...args).map(entry =>
      typeof entry === 'string' || !links.has(resolve(path, entry.name)) ? entry : {
        name: entry.name, parentPath: entry.parentPath,
        isSymbolicLink: () => true, isDirectory: () => false, isFile: () => false,
      })),
  ];
  syncBuiltinESMExports();
  t.after(() => { for (const mock of mocks) mock.mock.restore(); syncBuiltinESMExports(); });
  return {
    link(target, file) { fs.writeFileSync(file, 'virtual link'); links.set(resolve(file), resolve(join(file, '..'), target)); },
    unlink(file) { links.delete(resolve(file)); fs.rmSync(file); },
  };
}
