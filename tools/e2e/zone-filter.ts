import type { TestFilter } from 'e2e';
import { relative, resolve } from 'node:path';
import { filterIsActive, parcoursExclude } from './zones.mjs';

function repoPath(gitRoot: string, projectRoot: string, file: string): string {
  return relative(gitRoot, resolve(projectRoot, file)).replaceAll('\\', '/');
}

/**
 * Inactive unless the run passed `--changed-since` (e2e only then fills
 * `context.changes`). A full campaign or `verify:release` therefore keeps
 * every test. No model, no network.
 */
export const parcoursTouches: TestFilter = {
  name: 'parcours-touches',
  filter(tests, context) {
    if (!filterIsActive(context)) return { exclude: {} };
    return parcoursExclude(tests.map(test => ({
      id: test.id,
      tags: test.tags,
      file: repoPath(context.changes.root, context.projectRoot, test.file),
    })), context.changes.files);
  },
};
