const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  execFileSync
} = require('child_process');

const {
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  main,
  run,
  stopProcessTree
} = require('./web-deploy');

// The pinned CLI as checkPinnedCli returns it (faked here: no install).
const NODE = '/usr/bin/node';
const ENTRY = '/repo/node_modules/vercel/dist/vc.js';

const SECRET = 'sk_live_pulled_secret_value_123';
const TOKEN = 'vercel_token_value_abcdef';

function git(cwd: string, ...args: string[]) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function listFiles(dir: string, prefix = ''): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry: { name: string; isDirectory: () => boolean }) => {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? listFiles(path.join(dir, entry.name), relative) : [relative];
    })
    .sort();
}

type Call = { args: string[]; cwd: string; env: Record<string, string | undefined>; files: string[]; contents: Record<string, string> };

describe('web-deploy: guarded, clean copy, pinned project, prebuilt upload', () => {
  let repo: string;
  let tempRoot: string;
  let HEAD: string;

  beforeEach(() => {
    repo = fs.mkdtempSync(path.join(os.tmpdir(), 'web-deploy-repo-'));
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'web-deploy-tmp-'));
    git(repo, 'init', '-q');
    git(repo, 'config', 'user.email', 'test@example.com');
    git(repo, 'config', 'user.name', 'test');
    fs.writeFileSync(path.join(repo, '.gitignore'), 'dist/\n.env*\n.vercel/\n.cache/\n');
    fs.writeFileSync(path.join(repo, 'package.json'), '{"name":"web"}\n');
    fs.mkdirSync(path.join(repo, 'app'));
    fs.writeFileSync(path.join(repo, 'app', 'index.ts'), 'export const committed = true;\n');
    git(repo, 'add', '-A');
    git(repo, 'commit', '-q', '-m', 'guarded');
    HEAD = git(repo, 'rev-parse', 'HEAD');
    // Local files the guard does not prove: none of them may ship.
    fs.mkdirSync(path.join(repo, 'dist'));
    fs.writeFileSync(path.join(repo, 'dist', 'x'), 'stale build');
    fs.writeFileSync(path.join(repo, '.env.local'), 'SECRET=1');
    fs.mkdirSync(path.join(repo, '.cache'));
    fs.writeFileSync(path.join(repo, '.cache', 'c'), 'cache');
    fs.writeFileSync(path.join(repo, 'untracked.txt'), 'not committed');
    fs.mkdirSync(path.join(repo, '.vercel'));
    fs.writeFileSync(path.join(repo, '.vercel', 'output.json'), 'local vercel output');
  });

  afterEach(() => {
    fs.rmSync(repo, { recursive: true, force: true });
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const accepted = (head = HEAD) => ({ head, tree: 'b'.repeat(40), message: `[site-publish-proof] OK: HEAD ${head}` });
  const link = (projectId = VERCEL_PROJECT_ID, orgId = VERCEL_ORG_ID) => JSON.stringify({ projectId, orgId, projectName: 'noctalia' });

  // A fake Vercel CLI: link and pull write .vercel/project.json, pull writes
  // the production env file, build writes .vercel/output. Each call records a
  // snapshot of its cwd.
  function fakeCli(calls: Call[], { linkJson = link(), pullJson = link(), failOn = '' } = {}) {
    return (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined> }) => {
      const vercelDir = path.join(options.cwd, '.vercel');
      const sub = args[1];
      if (sub === 'link') {
        fs.mkdirSync(vercelDir, { recursive: true });
        fs.writeFileSync(path.join(vercelDir, 'project.json'), linkJson);
      }
      if (sub === 'pull') {
        fs.writeFileSync(path.join(vercelDir, 'project.json'), pullJson);
        fs.writeFileSync(path.join(vercelDir, '.env.production.local'), `API_SECRET="${SECRET}"\nFLAG="1"\n`);
      }
      if (sub === 'build') {
        fs.mkdirSync(path.join(vercelDir, 'output', 'static'), { recursive: true });
        fs.writeFileSync(path.join(vercelDir, 'output', 'config.json'), '{"version":3}');
        fs.writeFileSync(path.join(vercelDir, 'output', 'static', 'index.html'), '<html></html>');
      }
      const files = listFiles(options.cwd);
      const contents: Record<string, string> = {};
      for (const file of files) contents[file] = fs.readFileSync(path.join(options.cwd, file), 'utf8');
      calls.push({ args: [command, ...args], cwd: options.cwd, env: options.env, files, contents });
      if (sub === failOn) throw new Error(`Command failed (1): ${command} ${args.join(' ')}`);
    };
  }

  function deps(guardProduction: () => Promise<{ head: string; tree: string; message: string }>, overrides: Record<string, unknown> = {}, cli = {}) {
    const calls: Call[] = [];
    const logs: string[] = [];
    return {
      calls,
      logs,
      deps: {
        guardProduction: jest.fn(guardProduction),
        runCommand: fakeCli(calls, cli),
        readHead: () => git(repo, 'rev-parse', 'HEAD'),
        rootDir: repo,
        tempRoot,
        env: { PATH: process.env.PATH, VERCEL_TOKEN: TOKEN },
        log: (line: string) => logs.push(line),
        checkCli: () => ({ command: NODE, args: [ENTRY] }),
        ...overrides,
      },
    };
  }

  it('native temp copy mode is 0700', async () => {
    const calls: Call[] = [];
    const inner = fakeCli(calls);
    const setup = deps(async () => accepted(), {
      runCommand: (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined> }) => {
        expect(fs.statSync(path.dirname(options.cwd)).mode & 0o777).toBe(0o700);
        return inner(command, args, options);
      },
    });
    await main(['prod'], setup.deps);
  });

  const alive = (pid: number) => {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  };
  const waitFor = async (check: () => boolean, ms = 5000) => {
    const end = Date.now() + ms;
    while (Date.now() < end) {
      if (check()) return true;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return check();
  };
  // A fake CLI that starts a sleeping grandchild with its own stdio (so the
  // pipes do not keep the step open), records its pid, then sleeps itself.
  const fakeCliWithGrandchild = (pidFile: string, ignoreTerm = false) => `
    const { spawn } = require('child_process');
    const fs = require('fs');
    ${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''}
    const grandchild = spawn(process.execPath, ['-e', ${JSON.stringify(`${ignoreTerm ? "process.on('SIGTERM', () => {});" : ''} setTimeout(() => {}, 60000)`)}], { stdio: 'ignore' });
    fs.writeFileSync(${JSON.stringify(pidFile)}, String(grandchild.pid));
    setTimeout(() => {}, 60000);
  `;

it.each([
    ['SIGTERM', 143],
    ['SIGHUP', 129],
    ['SIGQUIT', 131],
  ])('a real %s during a step kills the CLI and its grandchild (whole process group), removes the copy, then exits %i', async (signal, code) => {
    const pidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-deploy-pids-'));
    const pidFile = path.join(pidDir, 'grandchild.pid');
    try {
      const script = `
        const wd = require(${JSON.stringify(path.join(__dirname, 'web-deploy.js'))});
        wd.main(['prod'], {
          guardProduction: async () => ({ head: ${JSON.stringify(HEAD)}, tree: 'b', message: 'ok' }),
          rootDir: ${JSON.stringify(repo)},
          tempRoot: ${JSON.stringify(tempRoot)},
          log: () => {},
          checkCli: () => ({ command: 'vercel', args: [] }),
          runCommand: (command, args, options) => {
            console.log('READY ' + options.cwd);
            return wd.run(process.execPath, ['-e', ${JSON.stringify(fakeCliWithGrandchild(pidFile))}], options);
          },
        }).catch((error) => { console.error(error.message); process.exit(1); });
      `;
      const {
  spawn
} = require('child_process');
      const harness = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
      const copy: string = await new Promise((resolve, reject) => {
        let out = '';
        harness.stdout.on('data', (chunk: Buffer) => {
          out += chunk.toString();
          const match = /READY (\S+)/.exec(out);
          if (match) resolve(match[1]);
        });
        harness.on('exit', () => reject(new Error(`exited early: ${out}`)));
      });
      expect(await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').length > 0)).toBe(true);
      const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
      expect(alive(grandchildPid)).toBe(true);
      let stderr = '';
      harness.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
      const exitCode = await new Promise((resolve) => {
        harness.on('exit', (codeValue: number) => resolve(codeValue));
        harness.kill(signal);
      });
      expect(exitCode).toBe(code);
      expect(stderr).toContain(`Stopped by ${signal}`);
      expect(stderr).toContain(`exit ${code}`);
      expect(await waitFor(() => !alive(grandchildPid))).toBe(true);
      expect(fs.existsSync(copy)).toBe(false);
      expect(fs.readdirSync(tempRoot)).toEqual([]);
    } finally {
      fs.rmSync(pidDir, { recursive: true, force: true });
    }
  }, 30000);

it('stopProcessTree escalates to SIGKILL on the group when the CLI and its grandchild ignore SIGTERM', async () => {
    const pidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-deploy-pids-'));
    const pidFile = path.join(pidDir, 'grandchild.pid');
    try {
      let child: { pid: number } | null = null;
      const running = run(process.execPath, ['-e', fakeCliWithGrandchild(pidFile, true)], {
        cwd: pidDir,
        env: { PATH: process.env.PATH },
        write: () => {},
        onChild: (value: { pid: number } | null) => {
          if (value) child = value;
        },
      }).catch((error: Error) => error);
      expect(await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').length > 0)).toBe(true);
      const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
      const started = Date.now();
      await stopProcessTree(child, { timeoutMs: 400 });
      expect(Date.now() - started).toBeGreaterThanOrEqual(350);
      expect(((await running) as Error).message).toMatch(/Command failed \(SIGKILL\)/);
      expect(await waitFor(() => !alive(grandchildPid))).toBe(true);
      expect(alive((child as unknown as { pid: number }).pid)).toBe(false);
    } finally {
      fs.rmSync(pidDir, { recursive: true, force: true });
    }
  }, 20000);

it('stopProcessTree waits for the whole group: a CLI that dies on SIGTERM does not end the stop while a grandchild ignores it', async () => {
    const pidDir = fs.mkdtempSync(path.join(os.tmpdir(), 'web-deploy-pids-'));
    const pidFile = path.join(pidDir, 'grandchild.pid');
    try {
      // The CLI keeps the default SIGTERM action; only its grandchild ignores it.
      const cli = `
        const { spawn } = require('child_process');
        const grandchild = spawn(process.execPath, ['-e', "process.on('SIGTERM', () => {}); setTimeout(() => {}, 60000)"], { stdio: 'ignore' });
        require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(grandchild.pid));
        setTimeout(() => {}, 60000);
      `;
      let child: { pid: number } | null = null;
      const running = run(process.execPath, ['-e', cli], {
        cwd: pidDir,
        env: { PATH: process.env.PATH },
        write: () => {},
        onChild: (value: { pid: number } | null) => {
          if (value) child = value;
        },
      }).catch((error: Error) => error);
      expect(await waitFor(() => fs.existsSync(pidFile) && fs.readFileSync(pidFile, 'utf8').length > 0)).toBe(true);
      const grandchildPid = Number(fs.readFileSync(pidFile, 'utf8'));
      // Let the grandchild install its SIGTERM handler.
      await new Promise((resolve) => setTimeout(resolve, 300));
      const started = Date.now();
      await stopProcessTree(child, { timeoutMs: 400 });
      expect(((await running) as Error).message).toMatch(/Command failed \(SIGTERM\)/);
      expect(Date.now() - started).toBeGreaterThanOrEqual(350);
      // Gone when the stop returns, before any cleanup would run.
      expect(alive(grandchildPid)).toBe(false);
    } finally {
      fs.rmSync(pidDir, { recursive: true, force: true });
    }
  }, 20000);

it('a real SIGTERM to a running publish removes the temp copy and exits 143', async () => {
    const script = `
      const { main } = require(${JSON.stringify(path.join(__dirname, 'web-deploy.js'))});
      const { run } = require(${JSON.stringify(path.join(__dirname, 'web-deploy.js'))});
      main(['prod'], {
        guardProduction: async () => ({ head: ${JSON.stringify(HEAD)}, tree: 'b', message: 'ok' }),
        rootDir: ${JSON.stringify(repo)},
        tempRoot: ${JSON.stringify(tempRoot)},
        log: () => {},
        checkCli: () => ({ command: 'vercel', args: [] }),
        runCommand: (command, args, options) => {
          console.log('READY ' + options.cwd);
          return run(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], options);
        },
      }).catch((error) => { console.error(error.message); process.exit(1); });
    `;
    const {
  spawn
} = require('child_process');
    const child = spawn(process.execPath, ['-e', script], { stdio: ['ignore', 'pipe', 'pipe'] });
    const copy: string = await new Promise((resolve, reject) => {
      let out = '';
      child.stdout.on('data', (chunk: Buffer) => {
        out += chunk.toString();
        const match = /READY (\S+)/.exec(out);
        if (match) resolve(match[1]);
      });
      child.on('exit', () => reject(new Error(`exited early: ${out}`)));
    });
    expect(fs.existsSync(copy)).toBe(true);
    const exitCode = await new Promise((resolve) => {
      child.on('exit', (codeValue: number) => resolve(codeValue));
      child.kill('SIGTERM');
    });
    expect(exitCode).toBe(143);
    expect(fs.existsSync(copy)).toBe(false);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  }, 20000);
});
