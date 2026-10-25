#!/usr/bin/env python3
"""Compare cold/warm installs; release owned scratch even after a failed install."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    parser.add_argument('--repository', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--projects', type=Path, help='Explicit Projects root (default: ~/Projects)')
    parser.add_argument('--npm', default='npm', help='npm executable; never evaluated by a shell')
    parser.add_argument('--keep-workspace', action='store_true', help='Retain scratch for explicit diagnosis')
    args = parser.parse_args()
    root, output = args.repository.resolve(), args.output.resolve()
    allowed_output = root / 'outputs'
    if output != allowed_output and allowed_output not in output.parents:
        raise RuntimeError('Use outputs/: benchmark evidence must stay inside the repository outputs directory')
    output.mkdir(parents=True, exist_ok=True)
    cli = Path(__file__).resolve().parents[1] / 'local-workspace.js'
    common = ['--repo', str(root), '--task', 'measure-install', '--owner-pid', str(os.getpid())]
    if args.projects:
        common += ['--projects', str(args.projects.resolve())]

    def workspace(command, extra=()):
        result = subprocess.run(['node', str(cli), command, *common, *extra], capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stderr.strip() or 'Workspace command failed')
        return json.loads(result.stdout)

    disposable = ['root', 'site'] + [f'cache-{target}-{run}' for target in ('root', 'site') for run in range(1, 4)]
    declared = [arg for name in disposable for arg in ('--regenerable', name)]
    acquired = workspace('scratch', declared)
    scratch = Path(acquired['path'])
    # Explicitly retained or interrupted evidence is never overwritten by a rerun.
    if any(scratch.iterdir()):
        workspace('retain')
        raise RuntimeError('Previous benchmark scratch is not empty; inspect and release it before rerunning')
    receipt = {'schema': 'noctalia.install-measurement/1', 'source': str(root),
               'revision': acquired['revision'], 'workspace': str(scratch),
               'workspaceReceipt': acquired['receipt'], 'kept': args.keep_workspace,
               'npm': args.npm, 'manifests': {}, 'result': 'running'}
    rows, exit_code = [], 0
    try:
        for target in ('root', 'site'):
            work = scratch / target
            (work / 'apps/site').mkdir(parents=True)
            names = ('package.json', 'package-lock.json', 'apps/site/package.json', 'apps/site/package-lock.json') if target == 'root' else ('apps/site/package.json', 'apps/site/package-lock.json')
            for name in names:
                shutil.copyfile(root / name, work / name)
                receipt['manifests'][name] = hashlib.sha256((root / name).read_bytes()).hexdigest()
            cwd = work if target == 'root' else work / 'apps/site'
            for run in range(1, 4):
                cache = scratch / f'cache-{target}-{run}'
                cache.mkdir()
                for condition in ('cold', 'warm'):
                    start = time.monotonic()
                    result = subprocess.run([args.npm, 'ci', '--cache', str(cache), '--no-audit', '--no-fund'], cwd=cwd, capture_output=True, text=True)
                    (output / f'{target}-{run}-{condition}.log').write_text(result.stdout + result.stderr)
                    row = dict(target=target, run=run, cache=condition, seconds=time.monotonic() - start, exit=result.returncode)
                    rows.append(row)
                    (output / 'install-summary.json').write_text(json.dumps(rows, indent=2) + '\n')
                    print(json.dumps(row), flush=True)
                    if result.returncode:
                        raise subprocess.CalledProcessError(result.returncode, [args.npm, 'ci'])
        receipt['result'] = 'passed'
    except BaseException as error:
        exit_code = error.returncode if isinstance(error, subprocess.CalledProcessError) else 130 if isinstance(error, KeyboardInterrupt) else 1
        receipt['result'] = 'failed'
        receipt['error'] = type(error).__name__
        print(str(error), file=sys.stderr)
    finally:
        try:
            final = workspace('retain' if args.keep_workspace else 'release')
            receipt['cleanup'] = final['state']
        except Exception as error:
            receipt['cleanup'] = 'blocked; workspace preserved'
            print(str(error), file=sys.stderr)
            if exit_code == 0:
                exit_code = 1
        (output / 'workspace-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    return exit_code


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (RuntimeError, OSError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
