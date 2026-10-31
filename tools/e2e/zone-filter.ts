import type { TestFilter } from 'e2e';
import { relative, resolve } from 'node:path';
import { UNTOUCHED, decisionEnabled, filterIsActive, parcoursExclude, widenWithDecision } from './zones.mjs';
import { decisionVerdict } from './decision-verdict.mjs';

/** Past this the model's answer is dropped and the zones decide, well inside e2e's 5-minute filter budget. */
const DECISION_DEADLINE_MS = 120_000;

function repoPath(gitRoot: string, projectRoot: string, file: string): string {
  return relative(gitRoot, resolve(projectRoot, file)).replaceAll('\\', '/');
}

/**
 * Inactive unless the run passed `--changed-since` (e2e only then fills
 * `context.changes`). A full campaign or `verify:release` therefore keeps
 * every test. The zones need no model and no network. With an OpenAI key,
 * the decision model then judges the parcours the zones leave out; if it
 * cannot answer, the zones alone decide, and the note says so.
 */
export const parcoursTouches: TestFilter = {
  name: 'parcours-touches',
  async filter(tests, context) {
    if (!filterIsActive(context)) return { exclude: {} };
    const zones = parcoursExclude(tests.map(test => ({
      id: test.id,
      tags: test.tags,
      file: repoPath(context.changes.root, context.projectRoot, test.file),
    })), context.changes.files, process.env.E2E_WEB_LOCALE);
    if (!decisionEnabled(process.env)) return zones;
    const asked = tests.filter(test => zones.exclude[test.id] === UNTOUCHED);
    if (asked.length === 0) return zones;
    // A ref'd timer, as e2e's own: an unref'd AbortSignal.timeout may never fire.
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(new DOMException('no answer within 2 minutes', 'TimeoutError')), DECISION_DEADLINE_MS);
    try {
      const signal = AbortSignal.any([context.signal, deadline.signal]);
      return widenWithDecision(zones, await decisionVerdict(asked, { ...context, signal }));
    } catch (error) {
      context.signal.throwIfAborted();
      const reason = (error instanceof Error ? error.message : String(error)).split('\n')[0];
      return { ...zones, note: `${zones.note}; modele indisponible (${reason}), zones seules` };
    } finally {
      clearTimeout(timer);
    }
  },
};
