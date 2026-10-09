const fs = require('fs');
const path = require('path');

const { buildVercelDeployArgs, describe: describeArgs, main, parseTarget } = require('./web-deploy');

describe('web-deploy production guard', () => {
  const HEAD = 'a'.repeat(40);
  const accepted = (head = HEAD) => ({ head, tree: 'b'.repeat(40), message: `[site-publish-proof] OK: HEAD ${head}` });

  function deps(guardProduction: () => Promise<{ head: string; tree: string; message: string }>, overrides: Record<string, unknown> = {}) {
    const calls: string[][] = [];
    return {
      calls,
      deps: {
        guardProduction: jest.fn(guardProduction),
        runCommand: (command: string, args: string[]) => {
          calls.push([command, ...args]);
        },
        readHead: () => HEAD,
        env: {},
        log: () => {},
        ...overrides,
      },
    };
  }
  const deployCalls = (calls: string[][]) => calls.filter((call) => call.includes('deploy'));

  it('a refusal runs nothing', async () => {
    const setup = deps(async () => {
      throw new Error('[site-publish-proof] production publish of noctalia.app refused: the checkout has changes (1 paths). There is no override.');
    });
    await expect(main(['prod'], setup.deps)).rejects.toThrow('refused');
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(1);
    expect(setup.calls).toEqual([]);
  });

  it('an accepted run checks twice and calls vercel deploy with --prod, labelled with the guarded HEAD', async () => {
    const setup = deps(async () => accepted());
    await main(['prod'], setup.deps);
    expect(setup.deps.guardProduction).toHaveBeenCalledTimes(2);
    expect(setup.calls[0]).toEqual(expect.arrayContaining(['npx', 'vercel', 'link', '--project', 'noctalia']));
    expect(setup.calls[1]).toEqual(['npx', '--yes', 'vercel', 'deploy', '--prod', '--yes', '--scope', 'thanhs-projects-9baa3976', '--meta', `gitCommitSha=${HEAD}`]);
  });

  it('refuses the deploy when the recheck refuses (origin/master moved or the tree changed)', async () => {
    const guard = jest
      .fn()
      .mockResolvedValueOnce(accepted())
      .mockRejectedValueOnce(new Error('[site-publish-proof] production publish of noctalia.app refused: HEAD a is not origin/master c. There is no override.'));
    const setup = deps(guard);
    await expect(main(['prod'], setup.deps)).rejects.toThrow('is not origin/master');
    expect(deployCalls(setup.calls)).toEqual([]);
  });

  it('refuses the deploy when the recheck accepts another HEAD', async () => {
    const guard = jest.fn().mockResolvedValueOnce(accepted()).mockResolvedValueOnce(accepted('c'.repeat(40)));
    const setup = deps(guard);
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`HEAD moved from ${HEAD}`);
    expect(deployCalls(setup.calls)).toEqual([]);
  });

  it('refuses the deploy when the checkout HEAD differs from the guarded HEAD', async () => {
    const setup = deps(async () => accepted(), { readHead: () => 'd'.repeat(40) });
    await expect(main(['prod'], setup.deps)).rejects.toThrow(`not the guarded ${HEAD}`);
    expect(deployCalls(setup.calls)).toEqual([]);
  });

  it('passes VERCEL_TOKEN without ever showing it', async () => {
    const setup = deps(async () => accepted(), { env: { VERCEL_TOKEN: 'secret-token' } });
    await main(['prod'], setup.deps);
    expect(setup.calls[1]).toEqual(expect.arrayContaining(['--token', 'secret-token']));
    expect(describeArgs(buildVercelDeployArgs(HEAD, { VERCEL_TOKEN: 'secret-token' }))).not.toContain('secret-token');
  });

  it('only accepts the prod target and has no override', () => {
    expect(() => parseTarget(['preview'])).toThrow('Expected deployment target: prod.');
    expect(() => parseTarget(['prod', '--force'])).not.toThrow();
    const source = fs.readFileSync(path.join(__dirname, 'web-deploy.js'), 'utf8');
    expect(source).toContain("await import('./check-site-publish-proof.mjs')");
    expect(source).not.toMatch(/OVERRIDE|--force|--override/);
  });

  it('package.json exposes web:deploy:prod through this script', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    expect(pkg.scripts['web:deploy:prod']).toBe('node ./scripts/web-deploy.js prod');
  });
});
