import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { parse } from 'yaml';

const config = parse(readFileSync(new URL('../config.yml', import.meta.url), 'utf8'));
const PARAMETER = '<< pipeline.parameters.run_e2e_benchmark >>';
const EVENT = '<< pipeline.event.name >>';
const TYPE = '<< pipeline.trigger.type >>';
function evaluate(condition, values) {
  if (typeof condition === 'boolean') return condition;
  if (typeof condition === 'string') {
    assert.ok(Object.hasOwn(values, condition), `unknown pipeline value: ${condition}`);
    return values[condition];
  }
  if (condition.and) return condition.and.every(item => evaluate(item, values));
  if (condition.or) return condition.or.some(item => evaluate(item, values));
  if (condition.equal) return condition.equal.map(item => values[item] ?? item).reduce((a, b) => a === b);
  throw new Error(`unknown condition: ${JSON.stringify(condition)}`);
}

test('only an explicitly opted-in manual/API benchmark runs, for every trigger combination', () => {
  assert.deepEqual(config.parameters, { run_e2e_benchmark: { type: 'boolean', default: false } });
  assert.deepEqual(Object.keys(config.workflows), ['e2e-chromium-benchmark']);
  const gate = config.workflows['e2e-chromium-benchmark'].when;
  // Include obsolete trigger_source to prove that it cannot open the gate.
  for (const event of ['api', 'push', 'pull_request', 'schedule', 'custom_webhook', ''])
    for (const type of ['api', 'github_oauth', 'github_app', 'schedule', 'webhook', ''])
      for (const source of ['api', 'webhook', 'scheduled_pipeline', 'explicit', ''])
        for (const requested of [false, true]) {
          const actual = evaluate(gate, { [PARAMETER]: requested, [EVENT]: event, [TYPE]: type, '<< pipeline.trigger_source >>': source });
          assert.equal(actual, requested && (event === 'api' || type === 'api'), JSON.stringify({ event, type, source, requested }));
        }
});

test('the active pipeline has one setup benchmark and uploads only reports, with no validation or continuation', () => {
  assert.deepEqual(Object.keys(config), ['version', 'parameters', 'jobs', 'workflows']);
  assert.deepEqual(Object.keys(config.jobs), ['e2e-chromium-benchmark']);
  assert.deepEqual(config.workflows['e2e-chromium-benchmark'].jobs, ['e2e-chromium-benchmark']);
  const job = config.jobs['e2e-chromium-benchmark'];
  assert.deepEqual(job.docker, [{ image: 'cimg/node:24.22.1' }]);
  assert.equal(job.parallelism, undefined);
  assert.deepEqual(job.steps.map(step => typeof step === 'string' ? step : Object.keys(step)[0]), ['checkout', 'run', 'store_artifacts']);
  const scripts = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;
  assert.equal(job.steps[1].run.command, 'npm run test:testerarmy:benchmark');
  assert.equal(scripts['test:testerarmy:benchmark'], 'node tools/e2e/benchmark-setup.mjs');
  assert.equal(job.steps[2].store_artifacts.path, '.tmp/e2e-benchmark/results');
  assert.equal(existsSync(new URL('../continue.yml', import.meta.url)), false);
});

test('the former CI coverage fixtures stay unchanged while local commands retain their contracts', () => {
  // These bytes are the merged PR #418 portfolio, not an active pipeline.
  for (const [file, expected] of [
    ['validation-portfolio.yml', 'e738e5889dc4899ea7bdfcd41b5b862606da7ee6bb8d7775815a0cb10a92f8af'],
    ['legacy-setup.yml', '5d266fe42f60c9deac0e0dd2b7d973985558209ca8e88ed96a248673e267febe'],
  ]) {
    const bytes = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), expected, file);
  }
});
