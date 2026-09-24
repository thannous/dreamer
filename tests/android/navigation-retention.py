#!/usr/bin/env python3
"""Repeat Capture/Journal navigation on an installed Release APK; preserve app data."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

PACKAGE = 'com.tanuki75.noctalia'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--device', required=True)
    parser.add_argument('--adb', default='adb')
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--runs', type=int, default=10)
    args = parser.parse_args()
    if args.runs < 1:
        parser.error('--runs must be positive')
    args.output.mkdir(parents=True, exist_ok=False)
    report = {'package': PACKAGE, 'device': args.device, 'runs': args.runs,
              'settle_seconds': 0.7, 'idle_seconds': 20, 'samples': [],
              'assertions': [], 'back_screens': [], 'passed': False}

    def adb(*command):
        return subprocess.check_output([args.adb, '-s', args.device, *command],
                                       text=True, timeout=30)

    def save(name, data):
        (args.output / name).write_text(data)
        return data

    def tree(name):
        text = save(name + '.xml', adb('exec-out', 'uiautomator', 'dump', '/dev/tty'))
        return ET.fromstring(text[text.index('<?xml'):text.index('</hierarchy>') + 12])

    def node(root, test_id):
        matches = [n for n in root.iter('node') if n.get('resource-id') == test_id]
        if len(matches) != 1:
            raise AssertionError(f'Expected one visible {test_id}; found {len(matches)}')
        return matches[0]

    def center(root, test_id):
        bounds = [int(n) for n in re.findall(r'\d+', node(root, test_id).get('bounds'))]
        return str((bounds[0] + bounds[2]) // 2), str((bounds[1] + bounds[3]) // 2)

    def check(condition, description):
        report['assertions'].append({'description': description, 'passed': bool(condition)})
        if not condition:
            raise AssertionError(description)

    def screen(root):
        ids = {n.get('resource-id') for n in root.iter('node')}
        if 'screen.recording' in ids:
            return 'capture'
        if 'screen.journal' in ids:
            return 'journal'
        if 'tab.home' in ids:
            return 'tabs'
        if not any(n.get('package') == PACKAGE for n in root.iter('node')):
            return 'outside-app'
        return 'other-app-screen'

    def sample(label):
        raw = save(label + '-meminfo.txt', adb('shell', 'dumpsys', 'meminfo', PACKAGE))
        pss = re.search(r'TOTAL PSS:\s*(\d+)', raw)
        views = re.search(r'Views:\s*(\d+)', raw)
        activities = re.search(r'Activities:\s*(\d+)', raw)
        if not all((pss, views, activities)):
            raise AssertionError('meminfo is missing process counters')
        result = {'label': label, 'pss_kib': int(pss[1]), 'views': int(views[1]),
                  'activities': int(activities[1])}
        report['samples'].append(result)
        print(json.dumps(result), flush=True)
        return result

    try:
        report['source_head'] = subprocess.check_output(
            ['git', 'rev-parse', 'HEAD'], text=True).strip()
        for prop in ('ro.build.version.release', 'ro.build.version.sdk', 'ro.product.model'):
            report[prop] = adb('shell', 'getprop', prop).strip()
        save('package.txt', adb('shell', 'dumpsys', 'package', PACKAGE))
        package_path = adb('shell', 'pm', 'path', PACKAGE).splitlines()[0].removeprefix('package:')
        report['installed_apk_sha256'] = adb('shell', 'sha256sum', package_path).split()[0]
        report['runner_sha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
        adb('shell', 'am', 'force-stop', PACKAGE)
        save('launch.txt', adb('shell', 'am', 'start', '-W', '-n', PACKAGE + '/.MainActivity'))
        time.sleep(2)
        root = tree('initial-capture')
        check(screen(root) == 'capture', 'Onboarded app starts on Capture')
        journal = center(root, 'tab.journal')
        adb('shell', 'input', 'tap', *journal)
        time.sleep(0.7)
        root = tree('warm-journal')
        check(screen(root) == 'journal', 'Warm-up opens Journal')
        capture = center(root, 'tab.addDream')
        adb('shell', 'input', 'tap', *capture)
        time.sleep(0.7)
        root = tree('warm-capture')
        check(screen(root) == 'capture', 'Warm-up returns to Capture')
        baseline = sample('before')
        for index in range(1, args.runs + 1):
            adb('shell', 'input', 'tap', *journal)
            time.sleep(0.7)
            root = tree(f'cycle-{index}-journal')
            check(screen(root) == 'journal', f'Cycle {index} opens Journal')
            capture = center(root, 'tab.addDream')
            adb('shell', 'input', 'tap', *capture)
            time.sleep(0.7)
            root = tree(f'cycle-{index}-capture')
            check(screen(root) == 'capture', f'Cycle {index} returns to Capture')
            journal = center(root, 'tab.journal')
            if index == 5 or index == args.runs:
                sample(f'after-{index}')
        time.sleep(20)
        final = sample('after-idle')
        report['view_growth'] = final['views'] - baseline['views']
        report['pss_growth_mib'] = round((final['pss_kib'] - baseline['pss_kib']) / 1024, 2)
        # Same warmed-up screens: the original defect adds 159 views per cycle.
        # PSS is recorded, not gated: allocation/GC timing varies on an emulator.
        check(report['view_growth'] <= 100, 'Repeated cycles do not retain another screen tree')
        check(final['activities'] == baseline['activities'] == 1, 'Exactly one Activity remains')
        for index in range(1, 6):
            adb('shell', 'input', 'keyevent', '4')
            time.sleep(0.7)
            state = screen(tree(f'back-{index}'))
            report['back_screens'].append(state)
            check(state != 'capture', f'Back {index} does not revisit an older Capture')
            if state == 'outside-app':
                break
        check(report['back_screens'][0] == 'journal', 'Back from Capture returns to Journal')
        check(report['back_screens'][-1] == 'outside-app', 'Back exits without replaying prior cycles')
        report['passed'] = True
    except Exception as error:
        report['error'] = str(error)
    finally:
        for name, command in (
            ('runtime.log', ('shell', 'logcat', '-d', '-s', 'ReactNativeJS:I')),
            ('crash.log', ('shell', 'logcat', '-b', 'crash', '-d')),
        ):
            try:
                save(name, adb(*command))
            except Exception as error:
                report.setdefault('collection_errors', []).append(str(error))
        save('report.json', json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))
    raise SystemExit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
