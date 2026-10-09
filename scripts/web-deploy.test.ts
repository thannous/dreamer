const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const { buildVercelDeployArgs, buildVercelLinkArgs, main, parseTarget } = require('./web-deploy');

const CLI = 'vercel@62.2.0';

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

describe('web-deploy production guard and clean-copy upload', () => {
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

  function deps(guardProduction: () => Promise<{ head: string; tree: string; message: string }>, overrides: Record<string, unknown> = {}) {
    const calls: { args: string[]; cwd: string; files: string[]; contents: Record<string, string> }[] = [];
    return {
      calls,
      deps: {
        guardProduction: jest.fn(guardProduction),
        runCommand: (command: string, args: string[], options: { cwd: string }) => {
          if (args.includes('link')) {
            // What `vercel link` writes in its cwd.
            fs.mkdirSync(path.join(options.cwd, '.vercel'), { recursive: true });
            fs.writeFileSync(path.join(options.cwd, '.vercel', 'project.json'), '{"projectId":"prj_1","orgId":"team_1"}');
          }
          const files = listFiles(options.cwd);
          const contents: Record<string, string> = {};
          for (const file of files) contents[file] = fs.readFileSync(path.join(options.cwd, file), 'utf8');
          calls.push({ args: [command, ...args], cwd: options.cwd, files, contents });
        },
        readHead: () => git(repo, 'rev-parse', 'HEAD'),
        rootDir: repo,
        tempRoot,
        log: () => {},
        ...overrides,
      },
    };
  }
  const deployCalls = (calls: { args: string[] }[]) => calls.filter((call) => call.args.includes('deploy'));

  it('a refusal runs nothing and creates no copy', async () => {
    const setup = deps(async () => {
      throw new Error('[site-publish-proof] production publish refused: the checkout has changes (1 paths). There is no override.');
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('refused');
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(setup.calls).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('deploys with --prod from a clean copy of the guarded HEAD, never the working directory', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(2);
    const [link, deploy] = setup.calls;
    expect(link.args).toEqual(['npx', '--yes', CLI, 'link', '--yes', '--scope', 'thanhs-projects-9baa3976', '--project', 'noctalia']);
    expect(deploy.args).toEqual(['npx', '--yes', CLI, 'deploy', '--prod', '--yes', '--scope', 'thanhs-projects-9baa3976', '--meta', `gitCommitSha=${HEAD}`]);
    expect(deploy.cwd).toBe(link.cwd);
    expect(deploy.cwd).not.toBe(repo);
    expect(deploy.cwd.startsWith(tempRoot + path.sep)).toBe(true);

    // The copy is exactly the guarded tree plus .vercel/project.json.
    const tracked = git(repo, 'ls-tree', '-r', '--name-only', HEAD).split('\n').sort();
    expect(deploy.files).toEqual([...tracked, '.vercel/project.json'].sort());
    for (const file of tracked) expect(deploy.contents[file]).toBe(git(repo, 'show', `${HEAD}:${file}`) + '\n');
  });

  it('keeps untracked and ignored files (dist/x, .env.local, caches, local .vercel output) out of the upload', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    const { files } = deployCalls(setup.calls)[0];
    for (const leaked of ['untracked.txt', 'dist/x', '.env.local', '.cache/c', '.vercel/output.json', '.git']) {
      expect(files).not.toContain(leaked);
    }
    expect(files.some((file) => file.startsWith('.git/'))).toBe(false);
  });

  it('makes the copy from the guarded SHA even when the working tree has uncommitted edits', async () => {
    fs.writeFileSync(path.join(repo, 'app', 'index.ts'), 'export const committed = false; // local edit\n');
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    expect(deployCalls(setup.calls)[0].contents['app/index.ts']).toBe('export const committed = true;\n');
  });

  it('removes the temp dir after a successful deploy', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    expect(fs.existsSync(setup.calls[1].cwd)).toBe(false);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('removes the temp dir and deploys nothing when the recheck refuses (origin/master moved or the tree changed)', async () => {
    const guard = jest
      .fn()
      .mockResolvedValueOnce(accepted())
      .mockRejectedValueOnce(new Error('[site-publish-proof] production publish refused: HEAD a is not origin/master c. There is no override.'));
    const setup = deps(guard);
    await expect(main(['prod'], setup.deps)).rejects.toThrow('is not origin/master');
    expect(deployCalls(setup.calls)).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('refuses the deploy when the recheck accepts another HEAD', async () => {
    const guard = jest.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(accepted('c'.repeat(40)));
    const setup = deps(guard);
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`HEAD moved from ${HEAD}`);
    expect(deployCalls(setup.calls)).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('refuses the deploy when the checkout HEAD differs from the guarded HEAD', async () => {
    const setup = deps(async () => accepted(), { readHead: () => 'd'.repeat(40) });
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`not the guarded ${HEAD}`);
    expect(deployCalls(setup.calls)).toEqual([]);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('refuses the deploy when vercel link wrote no project.json, and cleans up', async () => {
    const calls: string[][] = [];
    const setup = deps(async () => accepted(), {
      runCommand: (command: string, args: string[]) => {
        calls.push([command, ...args]);
      },
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('vercel link did not write');
    expect(calls.filter((call) => call.includes('deploy'))).toEqual([]);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(fs.readdirSync(tempRoot)).toEqual([]);
  });

  it('never puts VERCEL_TOKEN in argv and pins the CLI', () => {
    const args = [...buildVercelLinkArgs(), ...buildVercelDeployArgs(HEAD)];
    expect(args).not.toContain('--token');
    expect(args.filter((arg: string) => arg.startsWith('vercel'))).toEqual([CLI, CLI]);
    const source = fs.readFileSync(path.join(__dirname, 'web-deploy.js'), 'utf8');
    expect(source).not.toMatch(/--token|VERCEL_TOKEN\s*[,)\]]/);
  });

  it('only accepts the prod target and has no override', () => {
    expect(() => parseTarget(['preview'])).toThrow('Expected deployment target: prod.');
    const source = fs.readFileSync(path.join(__dirname, 'web-deploy.js'), 'utf8');
    expect(source).toContain("await import('./check-site-publish-proof.mjs')");
    expect(source).not.toMatch(/OVERRIDE|--force|--override/);
  });

  it('package.json exposes web:deploy:prod through this script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['web:deploy:prod']).toBe('node ./scripts/web-deploy.js prod');
  });
});
