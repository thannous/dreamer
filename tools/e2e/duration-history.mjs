// e2e starts the slowest files first from the previous report in the output
// directory, and each run gets a new one. run.mjs keeps the last report of a
// run with no selection in the clone's git directory and seeds it into the
// next output directory. These helpers only move that file: the history
// orders files, it never decides whether a run passes.
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Without a history, or with an unreadable one, files start in collection
// order and nothing else changes.
export function seedDurations(history, output) {
  if (!history || !existsSync(history)) return null;
  try {
    const seed = readFileSync(history);
    writeFileSync(join(output, 'report.json'), seed, { flag: 'wx' });
    return seed;
  } catch { return null; }
}

// Only a run that reached the app measured its files: a blocked one (the app
// never answered) fails every test in milliseconds and would start the slowest last.
export function measuredDurations(report) {
  try {
    const { run } = JSON.parse(report);
    return run.status !== 'blocked' && run.summary.passed > 0;
  } catch { return false; }
}

// A seed the run did not replace is removed: its provenance predates this run,
// so it could never qualify, and no later reader mistakes it for this run's report.
export function keepDurations(history, seed, selected, output, suffix = process.pid) {
  const report = join(output, 'report.json');
  if (!existsSync(report)) return;
  const written = readFileSync(report);
  if (seed && written.equals(seed)) { unlinkSync(report); return; }
  if (!history || selected || !measuredDurations(written)) return;
  try {
    mkdirSync(dirname(history), { recursive: true });
    writeFileSync(`${history}.${suffix}`, written);
    renameSync(`${history}.${suffix}`, history);
  } catch {}
}
