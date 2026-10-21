'use strict';
const { spawn } = require('node:child_process');
const path = require('node:path');

// Keep the owner alive until its runner has closed and its finally has cleaned
// the exact owned stack. A signal to a spawnSync wrapper would skip that finally.
exports.withOwnedProcess = async function withOwnedProcess(action) {
  let active;
  let requested;
  const interrupt = () => stop('SIGINT');
  const terminate = () => stop('SIGTERM');
  const interruption = () => Object.assign(new Error(`Backend E2E interrupted by ${requested}`), {
    exitCode: requested === 'SIGTERM' ? 143 : 130,
  });
  function stop(signal) {
    requested ||= signal;
    if (active) active.kill(signal);
  }
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  try {
    const result = await action(async (binary, argv, options) => {
      if (requested) throw interruption();
      const child = spawn(binary, argv, { stdio: 'inherit', ...options });
      active = child;
      let result;
      try {
        result = await new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('close', (code, signal) => resolve({ code, signal }));
        });
      } finally { active = undefined; }
      if (requested) throw interruption();
      if (result.code !== 0) throw new Error(`${path.basename(binary)} failed (${result.code ?? result.signal})`);
    });
    if (requested) throw interruption();
    return result;
  } finally {
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
  }
};
