'use strict';

const { spawnSync } = require('node:child_process');
const { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');

const SCRIPT = path.join(__dirname, 'verify-cache.mjs');

describe('verify-cache', () => {
  let base;
  let common;
  let copy;
  beforeEach(() => {
    base = mkdtempSync(path.join(tmpdir(), 'noctalia-verify-cache-'));
    common = path.join(base, 'git');
    copy = path.join(base, 'copy');
    mkdirSync(copy);
  });
  afterEach(() => rmSync(base, { recursive: true, force: true }));

  // The command appends what it found to the file, then exits with <status>.
  const run = (kind, status = 0) => spawnSync(process.execPath, [
    SCRIPT, '.cache/info', '--',
    `node -e "const fs=require('fs');fs.mkdirSync('.cache',{recursive:true});const f='.cache/info';fs.writeFileSync(f,(fs.existsSync(f)?fs.readFileSync(f,'utf8'):'')+'run;');process.exit(${status})"`,
  ], { cwd: copy, encoding: 'utf8', env: { ...process.env, VERIFY_LOCAL_KIND: kind, VERIFY_LOCAL_COMMON_DIR: common } });
  const kept = () => path.join(common, 'verify-cache', '.cache', 'info');

  it('passes a file from one passing PR run to the next', () => {
    expect(run('pr').status).toBe(0);
    expect(readFileSync(kept(), 'utf8')).toBe('run;');
    rmSync(path.join(copy, '.cache'), { recursive: true });
    const second = run('pr');
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('restored from an earlier verify:pr run');
    expect(readFileSync(kept(), 'utf8')).toBe('run;run;');
  });

  it('keeps nothing from a failed run and gives a release nothing', () => {
    expect(run('pr', 3).status).toBe(3);
    expect(existsSync(kept())).toBe(false);
    rmSync(path.join(copy, '.cache'), { recursive: true });
    expect(run('pr').status).toBe(0);
    rmSync(path.join(copy, '.cache'), { recursive: true });
    expect(run('release').status).toBe(0);
    expect(readFileSync(path.join(copy, '.cache', 'info'), 'utf8')).toBe('run;');
    expect(readFileSync(kept(), 'utf8')).toBe('run;');
  });

  it('refuses a file outside the copy', () => {
    const result = spawnSync(process.execPath, [SCRIPT, '../info', '--', 'true'], { cwd: copy, encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('expected a path inside the copy');
  });
});
