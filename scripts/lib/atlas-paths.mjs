// Where the atlas tools may write. A destination is safe when it lies inside its root (itself a
// real path) and every part of it that already exists, from the root down, is a real directory or
// file of that name: no symbolic link, Windows junction (lstat reports junctions as links) or alias
// that could carry a write elsewhere.
import fs from 'node:fs';
import path from 'node:path';

// `child` lies within `root` (both resolved), without leaving it through `..`.
export function inside(root, child) {
  const relative = path.relative(root, child);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function unsafeDestination(root, target) {
  if (!inside(root, target)) return `${target} is outside ${root}`;
  let current = root;
  for (const part of path.relative(root, target).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    if (stat.isSymbolicLink() || fs.realpathSync(current) !== current) return `${current} is a link or an alias`;
    if (current !== target && !stat.isDirectory()) return `${current} is not a directory`;
  }
  return null;
}

// The real path a future file would have: its deepest existing ancestor resolved, the rest appended.
// A broken link on the way has no real path: null.
export function realTarget(target) {
  let existing = path.resolve(target);
  const rest = [];
  for (;;) {
    try {
      fs.lstatSync(existing);
      break;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    rest.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  try {
    return path.join(fs.realpathSync(existing), ...rest);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
