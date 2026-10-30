import type { TestFilter } from 'e2e';
import { relative, resolve } from 'node:path';
import { UNTOUCHED, decisionEnabled, filterIsActive, parcoursExclude, widenWithDecision } from './zones.mjs';
import { decisionVerdict } from './decision-verdict.mjs';

function repoPath(gitRoot: string, projectRoot: string, file: string): string {
  return relative(gitRoot, resolve(projectRoot, file)).replaceAll('\\', '/');
}

/**
 * Inactive unless the run passed `--changed-since` (e2e only then fills
 * `context.changes`). A full campaign or `verify:release` therefore keeps
 * every test. The zones need no model and no network. With a Vercel AI
 * Gateway key, the decision model then judges the parcours the zones leave
 * out; if it cannot answer, the zones alone decide, and the note says so.
 */
export const parcoursTouches: TestFilter = {
  name: 'parcours-touches',
  async filter(tests, context) {
    if (!filterIsActive(context)) return { exclude: {} };
    const zones = parcoursExclude(tests.map(test => ({
      id: test.id,
      tags: test.tags,
      file: repoPath(context.changes.root, context.projectRoot, test.file),
    })), context.changes.files);
    if (!decisionEnabled(process.env)) return zones;
    const asked = tests.filter(test => zones.exclude[test.id] === UNTOUCHED);
    if (asked.length === 0) return zones;
    try {
      return widenWithDecision(zones, await decisionVerdict(asked, context));
    } catch (error) {
      context.signal.throwIfAborted();
      const reason = (error instanceof Error ? error.message : String(error)).split('\n')[0];
      return { ...zones, note: `${zones.note}; modele indisponible (${reason}), zones seules` };
    }
  },
};
