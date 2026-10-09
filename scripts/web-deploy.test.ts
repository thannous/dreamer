const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  VERCEL_ORG_ID,
  VERCEL_PROJECT_ID,
  buildVercelBuildArgs,
  buildVercelDeployArgs,
  buildVercelLinkArgs,
  buildVercelPullArgs,
  collectSecrets,
  main,
  parseTarget,
  redact,
  run,
  vercelEnv,
} = require('./web-deploy');

const CLI = 'vercel@62.2.0';
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
      const sub = args[2];
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
        ...overrides,
      },
    };
  }
  const sub = (calls: Call[], name: string) => calls.filter((call) => call.args[3] === name);
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
      ['npx', '--yes', CLI, 'link', '--yes', ...PROJECT],
      ['npx', '--yes', CLI, 'pull', '--yes', '--environment=production', ...PROJECT],
      ['npx', '--yes', CLI, 'build', '--prod', '--yes', ...PROJECT],
      ['npx', '--yes', CLI, 'deploy', '--prebuilt', '--prod', '--yes', ...PROJECT, '--meta', `gitCommitSha=${HEAD}`],
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
        if (args[2] === 'build') return;
        inner(command, args, options);
      },
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('vercel build wrote no .vercel/output/config.json');
    expect(calls.filter((call) => call.args[3] === 'deploy')).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('strips ambient VERCEL_PROJECT_ID and VERCEL_ORG_ID pointing at another project, keeps the token in env only', async () => {
    const setup = deps(async () => accepted(), {
      env: { PATH: process.env.PATH, VERCEL_TOKEN: TOKEN, VERCEL_PROJECT_ID: 'prj_other', VERCEL_ORG_ID: 'team_other' },
    });
    await main(['prod'], setup.deps);
    for (const call of setup.calls) {
      expect(call.env.VERCEL_PROJECT_ID).toBeUndefined();
      expect(call.env.VERCEL_ORG_ID).toBeUndefined();
      expect(call.env.VERCEL_TOKEN).toBe(TOKEN);
      expect(call.args).toEqual(expect.arrayContaining(PROJECT));
      expect(call.args).not.toContain('--token');
      expect(call.args.join(' ')).not.toContain(TOKEN);
    }
    expect(vercelEnv({ VERCEL_PROJECT_ID: 'x', VERCEL_ORG_ID: 'y', VERCEL_TOKEN: 't' })).toEqual({ VERCEL_TOKEN: 't' });
  });

  it.each([
    ['another project', 'prj_other', VERCEL_ORG_ID],
    ['another team', VERCEL_PROJECT_ID, 'team_other'],
  ])('refuses before pull, build or upload when the link points at %s', async (_label, projectId, orgId) => {
    const setup = deps(async () => accepted(), {}, { linkJson: link(projectId, orgId) });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('not thanhs-projects-9baa3976/noctalia');
    expect(setup.calls.map((call) => call.args[3])).toEqual(['link']);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('refuses before build or upload when vercel pull rewrites the link to another project', async () => {
    const setup = deps(async () => accepted(), {}, { pullJson: link('prj_other') });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('not thanhs-projects-9baa3976/noctalia');
    expect(setup.calls.map((call) => call.args[3])).toEqual(['link', 'pull']);
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

  it('run() redacts pulled env values and the token from CLI output, also when the command fails', () => {
    const copy = fs.mkdtempSync(path.join(tempRoot, 'copy-'));
    fs.mkdirSync(path.join(copy, '.vercel'));
    fs.writeFileSync(path.join(copy, '.vercel', '.env.production.local'), `API_SECRET="${SECRET}"\nFLAG="1"\n`);
    const written: string[] = [];
    const write = (_stream: string, text: string) => written.push(text);
    const env = { PATH: process.env.PATH, VERCEL_TOKEN: TOKEN };
    run(process.execPath, ['-e', `console.log("value ${SECRET} token ${TOKEN} flag 1")`], { cwd: copy, env, write });
    expect(() =>
      run(process.execPath, ['-e', `console.error("boom ${SECRET}"); process.exit(3)`], { cwd: copy, env, write })
    ).toThrow(/Command failed \(3\)/);
    const output = written.join('');
    expect(output).toContain('value [redacted] token [redacted] flag 1');
    expect(output).toContain('boom [redacted]');
    expect(output).not.toContain(SECRET);
    expect(output).not.toContain(TOKEN);
    expect(collectSecrets(copy, env)).toEqual(expect.arrayContaining([SECRET, TOKEN]));
    expect(redact(`a ${SECRET} b`, [SECRET])).toBe('a [redacted] b');
  });

  it('pins the CLI and the project in every command, never --token', () => {
    const all = [buildVercelLinkArgs(), buildVercelPullArgs(), buildVercelBuildArgs(), buildVercelDeployArgs(HEAD)];
    for (const args of all) {
      expect(args[1]).toBe(CLI);
      expect(args).toEqual(expect.arrayContaining(PROJECT));
      expect(args).not.toContain('--token');
    }
    expect(VERCEL_PROJECT_ID).toBe('prj_ehKoWHHtWwekaivfEmqCCHRbjogu');
    expect(VERCEL_ORG_ID).toBe('team_2wbw33JALkqNG73AvmOQO17L');
  });

  it('only accepts the prod target and has no override', () => {
    expect(() => parseTarget(['preview'])).toThrow('Expected deployment target: prod.');
    const source = fs.readFileSync(path.join(__dirname, 'web-deploy.js'), 'utf8');
    expect(source).toContain("await import('./check-site-publish-proof.mjs')");
    expect(source).not.toMatch(/OVERRIDE|--force|--override|'--token'/);
  });

  it('package.json exposes web:deploy:prod through this script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['web:deploy:prod']).toBe('node ./scripts/web-deploy.js prod');
  });
});
