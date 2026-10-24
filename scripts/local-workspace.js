#!/usr/bin/env node
'use strict';

const { parseArgs } = require('node:util');
const { prepare, release, status } = require('./lib/local-workspace');

function main(args = process.argv.slice(2)) {
  if (!args.length || args.includes('--help')) {
    console.log('Usage: npm run workspace -- <prepare|scratch|status|release|retain> --task <name> [--repo <primary-project>] [--ref <commit>] [--owner-pid <pid>] [--regenerable <relative-path>]');
    console.log('Workspaces live under ~/Projects/.workspaces/<repo>/<task>. Pass --projects for an explicit Projects root. Release refuses changed commits, WIP and undeclared ignored files. Existing npm/pnpm caches are inherited.');
    return;
  }
  const [command, ...flags] = args;
  const { values } = parseArgs({ args: flags, options: {
    task: { type: 'string' }, repo: { type: 'string' }, ref: { type: 'string' }, projects: { type: 'string' },
    'owner-pid': { type: 'string' }, regenerable: { type: 'string', multiple: true },
  } });
  const options = { ...values, ownerPid: values['owner-pid'] };
  const result = command === 'prepare' ? prepare(options)
    : command === 'scratch' ? prepare(options, 'scratch')
      : command === 'release' ? release(options)
        : command === 'retain' ? release(options, true)
          : command === 'status' ? status(options) : null;
  if (!result) throw new Error('UNKNOWN_WORKSPACE_COMMAND');
  console.log(JSON.stringify(result));
}
if (require.main === module) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { main };
