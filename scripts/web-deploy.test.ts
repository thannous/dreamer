const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  SIGNAL_EXIT_CODES,
  VERCEL_CLI_VERSION,
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  buildEnv,
  buildVercelBuildArgs,
  buildVercelDeployArgs,
  buildVercelLinkArgs,
  buildVercelPullArgs,
  checkPinnedCli,
  collectSecrets,
  handledSignals,
  main,
  parseEnvFile,
  parseTarget,
  redact,
  run,
  stopProcessTree,
  sweepStaleCopies,
  takeVercelToken,
  vercelEnv,
} = require('./web-deploy');
const { EventEmitter } = require('events');

// The pinned CLI as checkPinnedCli returns it (faked here: no install).
const BIN = '/repo/node_modules/.bin/vercel';
const PROJECT = ['--scope', 'thanhs-projects-9baa3976', '--project', 'noctalia'];
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
      const sub = args[0];
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
        checkCli: () => BIN,
        ...overrides,
      },
    };
  }
  const sub = (calls: Call[], name: string) => calls.filter((call) => call.args[1] === name);
  const repoHasEnvFile = () => listFiles(repo).some((file) => /(^|\/)\.env\.production/.test(file));

  it('a refusal runs nothing and creates no copy', async () => {
    const setup = deps(async () => {
      throw new Error('[site-publish-proof] production publish refused: the checkout has changes (1 paths). There is no override.');
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('refused');
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(setup.calls).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('runs link, pull, build, then deploy --prebuilt --prod, all pinned and from the clean copy', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    expect(setup.calls.map((call) => call.args)).toEqual([
      [BIN, 'link', '--yes', ...PROJECT],
      [BIN, 'pull', '--yes', '--environment=production', ...PROJECT],
      [BIN, 'build', '--prod'],
      [BIN, 'deploy', '--prebuilt', '--prod', '--yes', ...PROJECT, '--meta', `gitCommitSha=${HEAD}`],
    ]);
    const cwds = new Set(setup.calls.map((call) => call.cwd));
    expect(cwds.size).toBe(1);
    const [copy] = [...cwds];
    expect(copy).not.toBe(repo);
    expect(copy.startsWith(tempRoot + path.sep)).toBe(true);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(2);
  });

  it('the copy the build sees is exactly the guarded tree, without untracked or ignored files', async () => {
    fs.writeFileSync(path.join(repo, 'app', 'index.ts'), 'export const committed = false; // local edit\n');
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    const [linkCall] = sub(setup.calls, 'link');
    const tracked = git(repo, 'ls-tree', '-r', '--name-only', HEAD).split('\n').sort();
    expect(linkCall.files).toEqual([...tracked, '.vercel/project.json'].sort());
    for (const file of tracked) expect(linkCall.contents[file]).toBe(git(repo, 'show', `${HEAD}:${file}`) + '\n');
    for (const leaked of ['untracked.txt', 'dist/x', '.env.local', '.cache/c', '.vercel/output.json']) {
      expect(sub(setup.calls, 'build')[0].files).not.toContain(leaked);
    }
    expect(linkCall.files.some((file: string) => file === '.git' || file.startsWith('.git/'))).toBe(false);
  });

  it('only the prebuilt output is uploaded: deploy runs with --prebuilt after build wrote .vercel/output', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    const [deploy] = sub(setup.calls, 'deploy');
    expect(deploy.args).toContain('--prebuilt');
    expect(deploy.files).toEqual(expect.arrayContaining(['.vercel/output/config.json', '.vercel/output/static/index.html']));
  });

  it('refuses before any upload when vercel build wrote no output', async () => {
    const calls: Call[] = [];
    const inner = fakeCli(calls);
    const setup = deps(async () => accepted(), {
      runCommand: (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined> }) => {
        if (args[0] === 'build') return;
        inner(command, args, options);
      },
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('vercel build wrote no .vercel/output/config.json');
    expect(calls.filter((call) => call.args[1] === 'deploy')).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('passes only allowlisted variables: ambient EXPO_PUBLIC_*, NOCTALIA_*, NODE_ENV and VERCEL_PROJECT_ID never reach any call', async () => {
    const setup = deps(async () => accepted(), {
      env: {
        PATH: '/usr/bin',
        HOME: '/home/release',
        TMPDIR: '/tmp',
        VERCEL_TOKEN: TOKEN,
        HTTPS_PROXY: 'http://proxy:3128',
        NODE_EXTRA_CA_CERTS: '/etc/ca.pem',
        EXPO_PUBLIC_FOO: 'local',
        EXPO_PUBLIC_MOCK_MODE: 'true',
        EXPO_PUBLIC_API_URL: 'http://localhost:54321',
        NOCTALIA_X: 'x',
        NOCTALIA_APP_VARIANT: 'lucid',
        NODE_ENV: 'development',
        NODE_OPTIONS: '--require /tmp/evil.js',
        npm_config_registry: 'http://evil.example',
        VERCEL_PROJECT_ID: 'prj_other',
        VERCEL_ORG_ID: 'team_other',
        LANG: 'fr_FR.UTF-8',
      },
    });
    await main(['prod'], setup.deps);
    expect(setup.calls.map((call) => call.args[1])).toEqual(['link', 'pull', 'build', 'deploy']);
    for (const call of setup.calls.filter((entry) => entry.args[1] !== 'build')) {
      expect(call.env).toEqual({
        PATH: '/usr/bin',
        HOME: '/home/release',
        TMPDIR: '/tmp',
        VERCEL_TOKEN: TOKEN,
        HTTPS_PROXY: 'http://proxy:3128',
        NODE_EXTRA_CA_CERTS: '/etc/ca.pem',
      });
      expect(call.args).toEqual(expect.arrayContaining(PROJECT));
    }
    const [build] = setup.calls.filter((entry) => entry.args[1] === 'build');
    expect(build.env).toEqual({
      PATH: '/usr/bin',
      HOME: path.join(path.dirname(build.cwd), 'build-home'),
      TMPDIR: '/tmp',
      HTTPS_PROXY: 'http://proxy:3128',
      NODE_EXTRA_CA_CERTS: '/etc/ca.pem',
      npm_config_cache: path.join('/home/release', '.npm'),
    });
    for (const call of setup.calls) {
      expect(call.args).not.toContain('--token');
      expect(call.args.join(' ')).not.toContain(TOKEN);
    }
  });

  it('vercel build never sees VERCEL_TOKEN or the real HOME: env assertion and a fake build that prints its env', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    const byStep = Object.fromEntries(setup.calls.map((call) => [call.args[1], call.env]));
    expect(byStep.build.VERCEL_TOKEN).toBeUndefined();
    expect(byStep.build.HOME).not.toBe(process.env.HOME);
    for (const step of ['link', 'pull', 'deploy']) expect(byStep[step].VERCEL_TOKEN).toBe(TOKEN);
    expect(setup.calls.find((call) => call.args[1] === 'build')?.args).not.toEqual(expect.arrayContaining(['--project', '--scope', '--yes', 'vercel']));

    // A real child with the build env, printing everything it can see.
    const buildHome = fs.mkdtempSync(path.join(tempRoot, 'home-'));
    const env = buildEnv({ PATH: process.env.PATH, HOME: '/home/release', VERCEL_TOKEN: TOKEN, vercel_token: TOKEN }, buildHome, 'linux');
    const written: string[] = [];
    await run(process.execPath, ['-e', 'console.log(JSON.stringify(process.env))'], {
      cwd: buildHome,
      env,
      write: (_stream: string, text: string) => written.push(text),
    });
    const printed = JSON.parse(written.join(''));
    expect(printed.VERCEL_TOKEN).toBeUndefined();
    expect(JSON.stringify(printed)).not.toContain(TOKEN);
    expect(printed.HOME).toBe(buildHome);
    expect(buildEnv({ VERCEL_TOKEN: 't', Vercel_Token: 't', HOME: 'h', USERPROFILE: 'u' }, 'B', 'win32')).toEqual({
      HOME: 'B',
      USERPROFILE: 'B',
      npm_config_cache: path.join('h', '.npm'),
    });
  });

  it('vercelEnv keeps only the allowlist, plus the Windows essentials on win32, and never the token', () => {
    const ambient = { PATH: 'p', HOME: 'h', VERCEL_TOKEN: 't', EXPO_PUBLIC_FOO: 'f', NOCTALIA_X: 'n', VERCEL_PROJECT_ID: 'x', SystemRoot: 'C:\\Windows', APPDATA: 'a', TEMP: 'C:\\T', TMP: 'C:\\T' };
    expect(vercelEnv(ambient, 'linux')).toEqual({ PATH: 'p', HOME: 'h' });
    expect(vercelEnv(ambient, 'win32')).toEqual({ PATH: 'p', HOME: 'h', SystemRoot: 'C:\\Windows', APPDATA: 'a', TEMP: 'C:\\T', TMP: 'C:\\T' });
  });

  it('takes VERCEL_TOKEN out of process.env at start: absent from process.env during every step and from the build env, present only for link, pull and deploy', async () => {
    const saved = process.env.VERCEL_TOKEN;
    process.env.VERCEL_TOKEN = TOKEN;
    try {
      const seen: Record<string, { processEnv: string | undefined; child: string | undefined }> = {};
      const calls: Call[] = [];
      const inner = fakeCli(calls);
      const setup = deps(async () => {
        expect(process.env.VERCEL_TOKEN).toBeUndefined();
        return accepted();
      }, {
        env: process.env,
        runCommand: (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined> }) => {
          seen[args[0]] = { processEnv: process.env.VERCEL_TOKEN, child: options.env.VERCEL_TOKEN };
          inner(command, args, options);
        },
      });
      await main(['prod'], setup.deps);
      expect(process.env.VERCEL_TOKEN).toBeUndefined();
      expect(Object.keys(seen)).toEqual(['link', 'pull', 'build', 'deploy']);
      for (const step of ['link', 'pull', 'deploy']) expect(seen[step]).toEqual({ processEnv: undefined, child: TOKEN });
      expect(seen.build).toEqual({ processEnv: undefined, child: undefined });
      expect(JSON.stringify(calls.find((call) => call.args[1] === 'build')?.env)).not.toContain(TOKEN);
    } finally {
      if (saved === undefined) delete process.env.VERCEL_TOKEN;
      else process.env.VERCEL_TOKEN = saved;
    }
  });

  it('takeVercelToken returns the token and removes every case spelling from the env it is given', () => {
    const env: Record<string, string | undefined> = { PATH: 'p', VERCEL_TOKEN: 'real', vercel_token: 'other' };
    expect(takeVercelToken(env)).toBe('real');
    expect(env).toEqual({ PATH: 'p' });
    expect(takeVercelToken({ PATH: 'p' })).toBeUndefined();
  });

  it('a real run removes VERCEL_TOKEN from its own process.env before any step starts', async () => {
    const script = `
      const wd = require(${JSON.stringify(path.join(__dirname, 'web-deploy.js'))});
      const seen = [];
      wd.main(['prod'], {
        guardProduction: async () => { seen.push('guard:' + (process.env.VERCEL_TOKEN === undefined)); throw new Error('stop here'); },
        checkCli: () => 'vercel',
        sweep: () => [],
        log: () => {},
      }).catch(() => console.log(JSON.stringify({ seen, after: process.env.VERCEL_TOKEN === undefined })));
    `;
    const out = execFileSync(process.execPath, ['-e', script], { env: { PATH: process.env.PATH, VERCEL_TOKEN: TOKEN }, encoding: 'utf8' });
    expect(JSON.parse(out)).toEqual({ seen: ['guard:true'], after: true });
  });

  it.each([
    ['another project', 'prj_other', VERCEL_ORG_ID],
    ['another team', VERCEL_PROJECT_ID, 'team_other'],
  ])('refuses before pull, build or upload when the link points at %s', async (_label, projectId, orgId) => {
    const setup = deps(async () => accepted(), {}, { linkJson: link(projectId, orgId) });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('not thanhs-projects-9baa3976/noctalia');
    expect(setup.calls.map((call) => call.args[1])).toEqual(['link']);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('refuses before build or upload when vercel pull rewrites the link to another project', async () => {
    const setup = deps(async () => accepted(), {}, { pullJson: link('prj_other') });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('not thanhs-projects-9baa3976/noctalia');
    expect(setup.calls.map((call) => call.args[1])).toEqual(['link', 'pull']);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('refuses when vercel link wrote no project.json', async () => {
    const setup = deps(async () => accepted(), { runCommand: () => {} });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('vercel link did not write');
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('keeps the pulled env file inside the temp copy and removes it after success', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    const [deploy] = sub(setup.calls, 'deploy');
    expect(deploy.files).toContain('.vercel/.env.production.local');
    expect(repoHasEnvFile()).toBe(false);
    expect(fs.existsSync(deploy.cwd)).toBe(false);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it.each(['build', 'deploy'])('removes the pulled env file and the copy when %s fails', async (failOn) => {
    const setup = deps(async () => accepted(), {}, { failOn });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('Command failed');
    expect(repoHasEnvFile()).toBe(false);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('removes the copy and deploys nothing when the recheck refuses, or accepts another HEAD, or HEAD moved', async () => {
    const refusing = jest
      .fn()
      .mockResolvedValueOnce(accepted())
      .mockRejectedValueOnce(new Error('[site-publish-proof] production publish refused: HEAD a is not origin/master c. There is no override.'));
    const moved = jest.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(accepted('c'.repeat(40)));
    for (const [guard, overrides, message] of [
      [refusing, {}, 'is not origin/master'],
      [moved, {}, `HEAD moved from ${HEAD}`],
      [async () => accepted(), { readHead: () => 'd'.repeat(40) }, `not the guarded ${HEAD}`],
    ] as const) {
      const setup = deps(guard as () => Promise<{ head: string; tree: string; message: string }>, overrides);
      await expect(main(['prod'], setup.deps)).rejects.toThrow(message);
      expect(sub(setup.calls, 'deploy')).toEqual([]);
      expect(sub(setup.calls, 'build')).toHaveLength(1);
      expect(repoHasEnvFile()).toBe(false);
      expect(fs.readdirSync(tempRoot)).toEqual([]);
    }
  });

  it('prints nothing secret: logs of a full run hold no pulled value and no token', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    const printed = setup.logs.join('\n');
    expect(printed).not.toContain(SECRET);
    expect(printed).not.toContain(TOKEN);
  });

  it('run() redacts pulled env values and the token from CLI output, also when the command fails', async () => {
    const copy = fs.mkdtempSync(path.join(tempRoot, 'copy-'));
    fs.mkdirSync(path.join(copy, '.vercel'));
    fs.writeFileSync(path.join(copy, '.vercel', '.env.production.local'), `API_SECRET="${SECRET}"\nFLAG="1"\n`);
    const written: string[] = [];
    const write = (_stream: string, text: string) => written.push(text);
    const env = { PATH: process.env.PATH, VERCEL_TOKEN: TOKEN };
    await run(process.execPath, ['-e', `console.log("value ${SECRET} token ${TOKEN} flag 1")`], { cwd: copy, env, write });
    await expect(
      run(process.execPath, ['-e', `console.error("boom ${SECRET}"); process.exit(3)`], { cwd: copy, env, write })
    ).rejects.toThrow(/Command failed \(3\)/);
    const output = written.join('');
    expect(output).toContain('value [redacted] token [redacted] flag 1');
    expect(output).toContain('boom [redacted]');
    expect(output).not.toContain(SECRET);
    expect(output).not.toContain(TOKEN);
    expect(collectSecrets(copy, env)).toEqual(expect.arrayContaining([SECRET, TOKEN]));
    expect(redact(`a ${SECRET} b`, [SECRET])).toBe('a [redacted] b');
  });

  it('parses the pulled env file like dotenv: CRLF lines, quotes, comments, escaped \\r\\n', () => {
    const file = [
      'CRLF_SECRET="crlf_secret_value_1"',
      'export SINGLE=\'single_quoted_value\'',
      'PLAIN=plain_value_123 # comment',
      'CERT="-----BEGIN KEY-----\\r\\nline_one_secret_abc\\r\\n-----END KEY-----"',
      'EMPTY=""',
    ].join('\r\n');
    expect(parseEnvFile(file)).toEqual({
      CRLF_SECRET: 'crlf_secret_value_1',
      SINGLE: 'single_quoted_value',
      PLAIN: 'plain_value_123',
      CERT: '-----BEGIN KEY-----\r\nline_one_secret_abc\r\n-----END KEY-----',
      EMPTY: '',
    });
  });

  it('redacts a CRLF env file and an escaped \\r\\n value in every printed form, with no leak in the logs', async () => {
    const copy = fs.mkdtempSync(path.join(tempRoot, 'copy-'));
    fs.mkdirSync(path.join(copy, '.vercel'));
    const cert = '-----BEGIN KEY-----\r\nline_one_secret_abc\r\nline_two_secret_def\r\n-----END KEY-----';
    const serialized = cert.replace(/\r/g, '\\r').replace(/\n/g, '\\n');
    fs.writeFileSync(
      path.join(copy, '.vercel', '.env.production.local'),
      `CRLF_SECRET="crlf_secret_value_1"\r\nCERT="${serialized}"\r\nOTHER='other_secret_value'\r\n`
    );
    const written: string[] = [];
    const write = (_stream: string, text: string) => written.push(text);
    const env = { PATH: process.env.PATH, VERCEL_TOKEN: TOKEN };
    const echo = [
      'process.stdout.write("crlf crlf_secret_value_1\\r\\n")',
      `process.stdout.write(${JSON.stringify(cert)} + "\\n")`,
      `process.stdout.write(${JSON.stringify(cert.replace(/\r\n/g, '\n'))} + "\\n")`,
      `process.stdout.write(${JSON.stringify(serialized)} + "\\n")`,
      'process.stderr.write("other other_secret_value\\r\\n")',
    ].join(';');
    await run(process.execPath, ['-e', echo], { cwd: copy, env, write });
    const output = written.join('');
    for (const leaked of ['crlf_secret_value_1', 'line_one_secret_abc', 'line_two_secret_def', 'other_secret_value', serialized, cert]) {
      expect(output).not.toContain(leaked);
    }
    expect(output).toContain('[redacted]');
  });

  it.each([
    ['SIGINT', 130],
    ['SIGTERM', 143],
    ['SIGHUP', 129],
    ['SIGQUIT', 131],
  ])('on %s during the build: stops the CLI, removes the temp copy and the env file, exits %i, deploys nothing', async (signal, code) => {
    const proc = Object.assign(new EventEmitter(), {
      pid: process.pid,
      exit: jest.fn((exitCode: number) => {
        throw new Error(`exit ${exitCode}`);
      }),
    });
    const child = { pid: 1234 };
    const stopTree = jest.fn(async () => {});
    const calls: Call[] = [];
    const inner = fakeCli(calls);
    let copyDir = '';
    const setup = deps(async () => accepted(), {
      proc,
      stopTree,
      runCommand: (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined>; onChild: (c: unknown) => void }) => {
        inner(command, args, options);
        if (args[0] === 'build') {
          copyDir = options.cwd;
          options.onChild(child);
          expect(fs.existsSync(path.join(copyDir, '.vercel', '.env.production.local'))).toBe(true);
          proc.emit(signal);
          // The stopped step then fails, as a killed CLI does.
          throw new Error(`Command failed (${signal}): vercel`);
        }
      },
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`exit ${code}`);
    expect(proc.exit).toHaveBeenCalledWith(code);
    expect(stopTree).toHaveBeenCalledTimes(1);
    expect(stopTree).toHaveBeenCalledWith(child, { timeoutMs: 5000 });
    expect(fs.existsSync(copyDir)).toBe(false);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
    expect(calls.filter((call) => call.args[1] === 'deploy')).toEqual([]);
    for (const name of ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']) expect(proc.listenerCount(name)).toBe(0);
  });

  it('handles SIGINT, SIGTERM, SIGHUP and SIGQUIT with exit 128 + the signal number (no SIGQUIT on Windows)', () => {
    for (const [signal, code] of Object.entries(SIGNAL_EXIT_CODES)) expect(code).toBe(128 + os.constants.signals[signal]);
    expect(handledSignals('linux')).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']);
    expect(handledSignals('darwin')).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGQUIT']);
    expect(handledSignals('win32')).toEqual(['SIGINT', 'SIGTERM', 'SIGHUP']);
  });

  it('a real SIGTERM to a running publish removes the temp copy and exits 143', async () => {
    const script = `
      const { main } = require(${JSON.stringify(path.join(__dirname, 'web-deploy.js'))});
      const { run } = require(${JSON.stringify(path.join(__dirname, 'web-deploy.js'))});
      main(['prod'], {
        guardProduction: async () => ({ head: ${JSON.stringify(HEAD)}, tree: 'b', message: 'ok' }),
        rootDir: ${JSON.stringify(repo)},
        tempRoot: ${JSON.stringify(tempRoot)},
        log: () => {},
        checkCli: () => 'vercel',
        runCommand: (command, args, options) => {
          console.log('READY ' + options.cwd);
          return run(process.execPath, ['-e', 'setTimeout(() => {}, 30000)'], options);
        },
      }).catch((error) => { console.error(error.message); process.exit(1); });
    `;
    const { spawn } = require('child_process');
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
    if (process.platform === 'win32') return;
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
          checkCli: () => 'vercel',
          runCommand: (command, args, options) => {
            console.log('READY ' + options.cwd);
            return wd.run(process.execPath, ['-e', ${JSON.stringify(fakeCliWithGrandchild(pidFile))}], options);
          },
        }).catch((error) => { console.error(error.message); process.exit(1); });
      `;
      const { spawn } = require('child_process');
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
    if (process.platform === 'win32') return;
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

  it('sweeps only stale noctalia-vercel-* dirs: dead owner pid, or no owner file and older than 6 hours', () => {
    const make = (name: string, pid?: string, ageMs = 0) => {
      const dir = path.join(tempRoot, name);
      fs.mkdirSync(dir);
      fs.writeFileSync(path.join(dir, 'secret'), 'x');
      if (pid !== undefined) fs.writeFileSync(path.join(dir, 'owner.pid'), pid);
      const time = (Date.now() - ageMs) / 1000;
      fs.utimesSync(dir, time, time);
      return dir;
    };
    const dead = make('noctalia-vercel-dead', '999999');
    const live = make('noctalia-vercel-live', '4242');
    const oldNoOwner = make('noctalia-vercel-old', undefined, 7 * 60 * 60 * 1000);
    const freshNoOwner = make('noctalia-vercel-fresh', undefined, 60 * 1000);
    const other = make('other-tool-dir', '999999', 7 * 60 * 60 * 1000);
    fs.writeFileSync(path.join(tempRoot, 'noctalia-vercel-file'), 'not a dir');
    const target = make('target-dir');
    fs.symlinkSync(target, path.join(tempRoot, 'noctalia-vercel-link'));
    const removed = sweepStaleCopies({ tempRoot, alive: (pid: number) => pid === 4242 });
    expect(removed.sort()).toEqual([dead, oldNoOwner].sort());
    for (const kept of [live, freshNoOwner, other, target]) expect(fs.existsSync(kept)).toBe(true);
    expect(fs.existsSync(path.join(tempRoot, 'noctalia-vercel-file'))).toBe(true);
    expect(fs.existsSync(path.join(target, 'secret'))).toBe(true);
  });

  it('main sweeps stale copies before the guard, and writes its own owner pid', async () => {
    const stale = path.join(tempRoot, 'noctalia-vercel-stale');
    fs.mkdirSync(stale);
    fs.writeFileSync(path.join(stale, 'owner.pid'), '999999');
    let ownerSeen = '';
    const calls: Call[] = [];
    const inner = fakeCli(calls);
    const setup = deps(async () => accepted(), {
      sweep: (options: { tempRoot: string }) => sweepStaleCopies({ ...options, alive: () => false }),
      runCommand: (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined> }) => {
        if (args[0] === 'link') ownerSeen = fs.readFileSync(path.join(path.dirname(options.cwd), 'owner.pid'), 'utf8').trim();
        inner(command, args, options);
      },
    });
    await main(['prod'], setup.deps);
    expect(fs.existsSync(stale)).toBe(false);
    expect(ownerSeen).toBe(String(process.pid));
    expect(setup.logs.some((line) => line.includes('removed a stale temp copy'))).toBe(true);
  });

  it('creates the temp copy with mode 0700', async () => {
    let mode = 0;
    const calls: Call[] = [];
    const inner = fakeCli(calls);
    const setup = deps(async () => accepted(), {
      runCommand: (command: string, args: string[], options: { cwd: string; env: Record<string, string | undefined> }) => {
        if (args[0] === 'link') mode = fs.statSync(path.dirname(options.cwd)).mode & 0o777;
        inner(command, args, options);
      },
    });
    await main(['prod'], setup.deps);
    expect(mode).toBe(0o700);
  });

  it('names the project in every authenticated command, never --token, and never goes through npx', () => {
    for (const args of [buildVercelLinkArgs(), buildVercelPullArgs(), buildVercelDeployArgs(HEAD)]) {
      expect(args).toEqual(expect.arrayContaining(PROJECT));
      expect(args).not.toContain('--token');
    }
    // build resolves the project from the checked local link only.
    expect(buildVercelBuildArgs()).toEqual(['build', '--prod']);
    const source = fs.readFileSync(path.join(__dirname, 'web-deploy.js'), 'utf8');
    expect(source).not.toMatch(/['"]npx['"]|npx --yes/);
    expect(VERCEL_PROJECT_ID).toBe('prj_ehKoWHHtWwekaivfEmqCCHRbjogu');
    expect(VERCEL_ORG_ID).toBe('team_2wbw33JALkqNG73AvmOQO17L');
  });

  it('only accepts the prod target and has no override', () => {
    expect(() => parseTarget(['preview'])).toThrow('Expected deployment target: prod.');
    const source = fs.readFileSync(path.join(__dirname, 'web-deploy.js'), 'utf8');
    expect(source).toContain("await import('./check-site-publish-proof.mjs')");
    expect(source).not.toMatch(/OVERRIDE|--force|--override|'--token'/);
  });

  it('the CLI is the exact devDependency vercel@62.2.0, locked in package-lock.json', () => {
    expect(VERCEL_CLI_VERSION).toBe('62.2.0');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.devDependencies.vercel).toBe('62.2.0');
    const lock = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package-lock.json'), 'utf8'));
    expect(lock.packages[''].devDependencies.vercel).toBe('62.2.0');
    expect(lock.packages['node_modules/vercel'].version).toBe('62.2.0');
  });

  it('checkPinnedCli returns node_modules/.bin/vercel only when vercel 62.2.0 is installed, else refuses before anything runs', async () => {
    const root = fs.mkdtempSync(path.join(tempRoot, 'root-'));
    expect(() => checkPinnedCli(root, 'linux')).toThrow('Run `npm ci`');
    fs.mkdirSync(path.join(root, 'node_modules', 'vercel'), { recursive: true });
    fs.mkdirSync(path.join(root, 'node_modules', '.bin'));
    fs.writeFileSync(path.join(root, 'node_modules', 'vercel', 'package.json'), '{"version":"62.1.0"}');
    fs.writeFileSync(path.join(root, 'node_modules', '.bin', 'vercel'), '');
    expect(() => checkPinnedCli(root, 'linux')).toThrow('found "62.1.0"');
    fs.writeFileSync(path.join(root, 'node_modules', 'vercel', 'package.json'), '{"version":"62.2.0"}');
    expect(checkPinnedCli(root, 'linux')).toBe(path.join(root, 'node_modules', '.bin', 'vercel'));
    expect(() => checkPinnedCli(root, 'win32')).toThrow('no node_modules/.bin/vercel');

    const setup = deps(async () => accepted(), { checkCli: (dir: string) => checkPinnedCli(dir, 'linux') });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('Run `npm ci`');
    expect(setup.deps.guardProduction).not.toHaveBeenCalled();
    expect(setup.calls).toEqual([]);
    expect(fs.readdirSync(tempRoot).filter((name: string) => name.startsWith('noctalia-vercel-'))).toEqual([]);
  });

  it('package.json exposes web:deploy:prod through this script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['web:deploy:prod']).toBe('node ./scripts/web-deploy.js prod');
  });
});
