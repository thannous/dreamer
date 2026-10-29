import type { TestFilter } from 'e2e';
import { relative, resolve } from 'node:path';
import { parcoursExclude } from './zones.mjs';

function repoPath(gitRoot: string, projectRoot: string, file: string): string {
  return relative(gitRoot, resolve(projectRoot, file)).replaceAll('\\', '/');
}

/** Runs only with `--changed-since`. No model, no network. */
export const parcoursTouches: TestFilter = {
  name: 'parcours-touches',
  filter(tests, context) {
    return parcoursExclude(tests.map(test => ({
      id: test.id,
      tags: test.tags,
      file: repoPath(context.changes.root, context.projectRoot, test.file),
    })), context.changes.files);
  },
};
