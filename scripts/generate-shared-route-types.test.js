const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// A browser journey cannot observe tsc reading a declaration while another
// process replaces it. Exercise the real generator with concurrent readers.
it('always exposes a complete declaration to readers while generators overlap', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'noctalia-route-writers-'));
  const script = path.join(root, 'scripts/generate-shared-route-types.cjs');
  const destination = path.join(root, '.expo/types/noctalia-router.d.ts');
  try {
    for (const dir of ['scripts', 'app', 'routes/lucid/lucid']) fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.copyFileSync(path.join(__dirname, 'generate-shared-route-types.cjs'), script);
    fs.symlinkSync(path.resolve(__dirname, '../node_modules'), path.join(root, 'node_modules'), 'junction');
    for (const route of ['app/index.tsx', 'routes/lucid/lucid/index.tsx']) fs.writeFileSync(path.join(root, route), 'export default function Screen() { return null; }');
    const first = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8' });
    expect(first.status).toBe(0);
    const expected = fs.readFileSync(destination, 'utf8');
    const previous = '/* previous complete declaration */\n';
    fs.writeFileSync(destination, previous);
    let invalid = null;
    let reads = 0;
    const poll = setInterval(() => {
      try {
        const content = fs.readFileSync(destination, 'utf8');
        if (content !== previous && content !== expected) invalid = content;
        reads += 1;
      } catch (error) {
        invalid = error.message;
      }
    }, 1);
    let results;
    try {
      results = await Promise.all(Array.from({ length: 4 }, () => new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [script], { cwd: root, stdio: 'ignore' });
        child.on('error', reject);
        child.on('exit', (code) => resolve(code));
      })));
    } finally {
      clearInterval(poll);
    }
    expect(results).toEqual([0, 0, 0, 0]);
    expect(reads).toBeGreaterThan(0);
    expect(invalid).toBeNull();
    expect(fs.readFileSync(destination, 'utf8')).toBe(expected);
    expect(fs.readdirSync(path.dirname(destination))).toEqual(['noctalia-router.d.ts']);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}, 20000);
