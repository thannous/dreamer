import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const config = parse(readFileSync(new URL('../continue.yml', import.meta.url), 'utf8'));
const defaults = definitions => Object.fromEntries(Object.entries(definitions ?? {}).map(([name, value]) => [name, value.default]));
function value(input, pipeline, parameters) {
  if (typeof input !== 'string') return input;
  const match = input.match(/^<< (pipeline\.)?parameters\.(\w+) >>$/);
  return match ? (match[1] ? pipeline : parameters)[match[2]] : input;
}
function condition(input, pipeline, parameters) {
  if (!input || typeof input !== 'object') return Boolean(value(input, pipeline, parameters));
  if (input.and) return input.and.every(item => condition(item, pipeline, parameters));
  if (input.or) return input.or.some(item => condition(item, pipeline, parameters));
  if (Object.hasOwn(input, 'not')) return !condition(input.not, pipeline, parameters);
  if (input.equal) return value(input.equal[0], pipeline, parameters) === value(input.equal[1], pipeline, parameters);
  throw new Error(`Unknown condition: ${JSON.stringify(input)}`);
}
function expand(steps, pipeline, parameters) {
  return steps.flatMap(step => {
    if (step.when || step.unless) {
      const branch = step.when ?? step.unless;
      return condition(branch.condition, pipeline, parameters) === Boolean(step.when) ? expand(branch.steps, pipeline, parameters) : [];
    }
    const name = typeof step === 'string' ? step : Object.keys(step)[0];
    const command = config.commands[name];
    if (!command) return [step];
    const supplied = typeof step === 'string' ? {} : step[name];
    const args = Object.fromEntries(Object.entries(supplied).map(([key, input]) => [key, value(input, pipeline, parameters)]));
    return expand(command.steps, pipeline, { ...defaults(command.parameters), ...args });
  });
}
function campaigns(flags) {
  const pipeline = { ...defaults(config.parameters), ...flags };
  return Object.values(config.workflows).filter(workflow => condition(workflow.when, pipeline, {})).flatMap(workflow =>
    workflow.jobs.flatMap(entry => {
      const [name, supplied] = Object.entries(entry)[0];
      const job = config.jobs[name];
      const parameters = { ...defaults(job.parameters), ...supplied };
      const count = value(job.parallelism, pipeline, parameters) ?? 1;
      return Array.from({ length: count }, () => ({
        name: supplied.name ?? name, parameters, steps: expand(job.steps, pipeline, parameters),
      }));
    }));
}

test('all routing combinations retain the E2E dependency installs and every campaign shard', () => {
  for (const run_noctalia of [false, true]) for (const run_meditation of [false, true]) for (const run_site of [false, true]) {
    const jobs = campaigns({ run_noctalia, run_meditation, run_site });
    const installers = jobs.filter(job => job.steps.some(step => step.run?.command === 'npm run test:testerarmy:setup'));
    assert.equal(installers.length, (run_noctalia ? 13 : 0) + Number(run_meditation) + Number(run_site));
    // Dreamer: 8 primary shards + 3 context shards + Lucid + the exact-union collector.
    if (run_noctalia) {
      assert.equal(jobs.filter(job => job.name === 'testerarmy-dreamer-journeys').length, 8);
      assert.equal(jobs.filter(job => job.name === 'testerarmy-dreamer-contexts').length, 3);
    }
    for (const job of installers) {
      const collector = job.name === 'testerarmy-dreamer';
      assert.equal(job.steps.filter(step => step.run?.command.includes('browsers:install')).length, collector ? 0 : 1);
    }
  }
});

test('headless preparation keeps Linux dependencies, journey typechecks and qualification guards', () => {
  const steps = expand(config.commands['install-testerarmy'].steps, {}, {});
  const commands = steps.filter(step => step.run).map(step => step.run.command);
  assert.ok(commands.includes('npm run browsers:install --prefix tools/e2e -- --with-deps --only-shell'));
  assert.ok(commands.some(command => command.includes('npm run test:testerarmy:typecheck')));
  assert.ok(commands.some(command => command.includes('npm run test:testerarmy:guards')));
  const collector = expand(config.jobs['testerarmy-collect'].steps, {}, { product: 'dreamer' });
  assert.ok(collector.some(step => step.run?.command.includes('web collect')));
  assert.ok(!collector.some(step => step.run?.command.includes('browsers:install')), 'collector needs no browser');
});
