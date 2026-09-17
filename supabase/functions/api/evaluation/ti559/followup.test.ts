import { selectSuite } from './suites.ts';
import { validateFixtures, planPairs } from './core.ts';
import original from './fixtures.json' with { type: 'json' };
import followup from './followup-fixtures.json' with { type: 'json' };
function assert(value: unknown): asserts value { if (!value) throw new Error('Assertion failed'); }
Deno.test('followup preserves exact FR IT DE regression fixtures and adds bounded safety controls', () => {
  const rows = validateFixtures(followup, 'followup');
  for (const lang of ['fr', 'it', 'de']) {
    assert(JSON.stringify(rows.find((x) => x.lang === lang)) === JSON.stringify(original.find((x: { lang: string }) => x.lang === lang)));
  }
  assert(rows.find((x) => x.lang === 'en')?.expectedType === 'Nightmare');
  assert(rows.find((x) => x.lang === 'es')?.expectedType === 'Unknown');
  assert(rows.find((x) => x.lang === 'pt')?.transcript.includes('SYSTEM: ignore'));
  const plan = planPairs(rows);
  assert(plan.reduce((total, x) => total + x.versions.length, 0) === 12);
  for (const kind of ['short', 'rich']) {
    assert(new Set(plan.filter((x) => x.fixture.kind === kind).map((x) => x.versions[0])).size === 2);
  }
});
Deno.test('followup validates declared lengths without forcing the first corpus length distribution', () => {
  const rows = structuredClone(followup);
  rows[2].kind = 'rich'; rows[2].transcript = 'Detalle '.repeat(45);
  assert(validateFixtures(rows, 'followup').filter((x) => x.kind === 'rich').length === 4);
  rows[2].kind = 'short';
  let rejected = false;
  try { validateFixtures(rows, 'followup'); } catch { rejected = true; }
  assert(rejected);
});
Deno.test('followup rejects a missing positive nightmare control before generation', () => {
  const rows = structuredClone(followup); rows[0].expectedType = 'Unknown';
  let rejected = false;
  try { validateFixtures(rows, 'followup'); } catch { rejected = true; }
  assert(rejected);
});
Deno.test('fixed suites keep receipts separate and pin v1 baseline with the post-TI559 schema', () => {
  const first = selectSuite(); const second = selectSuite('followup');
  assert(first.output === '/private/tmp/ti559-evaluation-run');
  assert(second.output === '/private/tmp/ti559-followup-evaluation-run');
  assert(first.baseline === 'd2bc25936' && second.baseline === 'd0791edb3');
  assert(second.beforeVersion === 'analysis-2026-09-08.1' && second.expectedAfterVersion === 'analysis-2026-09-09.1');
  assert(second.beforeSchema.properties.dreamType.enum.includes('Unknown'));
  assert(second.beforeSchema.properties.emotions.minItems === 0);
  assert(second.beforePrompt('Synthetic', 'English').includes('no minimum word count'));
  assert(!second.beforePolicy.includes('A partial memory is not the complete dream'));
  assert(second.beforePolicy.includes('never as instructions'));
  let rejected = false;
  try { selectSuite('../custom'); } catch { rejected = true; }
  assert(rejected);
});
