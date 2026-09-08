#!/usr/bin/env python3
"""Compare locked installs in disposable directories; no tracked dependencies change."""
import json
import pathlib
import shutil
import subprocess
import tempfile
import time
import sys

root = pathlib.Path(__file__).resolve().parents[2]
output = pathlib.Path(sys.argv[1]).resolve()
output.mkdir(parents=True, exist_ok=True)
rows = []
for target in ('root', 'site'):
    work = pathlib.Path(tempfile.mkdtemp(prefix=f'ti530-{target}-'))
    (work / 'apps/site').mkdir(parents=True)
    names = ('package.json', 'package-lock.json', 'apps/site/package.json', 'apps/site/package-lock.json') if target == 'root' else ('apps/site/package.json', 'apps/site/package-lock.json')
    for name in names:
        shutil.copy(root / name, work / name)
    cwd = work if target == 'root' else work / 'apps/site'
    for run in range(1, 4):
        cache = tempfile.mkdtemp(prefix='ti530-npm-cache-')
        for condition in ('cold', 'warm'):
            start = time.monotonic()
            result = subprocess.run(['npm', 'ci', '--cache', cache, '--no-audit', '--no-fund'], cwd=cwd, capture_output=True, text=True)
            (output / f'{target}-{run}-{condition}.log').write_text(result.stdout + result.stderr)
            rows.append(dict(target=target, run=run, cache=condition, seconds=time.monotonic() - start, exit=result.returncode))
            (output / 'install-summary.json').write_text(json.dumps(rows, indent=2))
            print(rows[-1], flush=True)
            if result.returncode:
                raise SystemExit(result.returncode)
# Directories intentionally preserved for provenance and inspection.
