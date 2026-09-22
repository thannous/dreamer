#!/usr/bin/env python3
"""Reading journey worker for android:perf:measure; Python stdlib only."""
import csv
import hashlib
import io
import json
import os
from pathlib import Path
import re
import signal
import statistics
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

PHASES = ['detail-open', 'detail-scroll', 'reading-open', 'reading-scroll']
PACKAGE = 'com.tanuki75.noctalia'

def save(file, value):
    temporary = file.with_suffix(file.suffix + '.tmp')
    temporary.write_text(json.dumps(value, indent=2) + '\n')
    temporary.replace(file)

def profileable(manifest):
    # APK manifests can contain unescaped JSON metadata; parse only this tag.
    tag = re.search(r'<profileable\b[^>]*>', manifest)
    return bool(tag and 'android:shell="true"' in tag[0] and 'android:enabled="false"' not in tag[0])

def summaries(rows):
    output = {}
    for phase in PHASES:
        group = [r for r in rows if r['phase'] == phase and r.get('valid')]
        if not group:
            continue
        frames = sum(r['surfaceFrames'] for r in group)
        missed = sum(r['missed'] for r in group)
        p95 = [r['p95Ms'] for r in group]
        output[phase] = dict(runs=len(group), frames=frames, missed=missed,
                             missedPercent=100 * missed / frames,
                             medianP95Ms=statistics.median(p95), p95Range=[min(p95), max(p95)])
    return output

def compare(current, baseline):
    criteria = 'At least 3 runs; same scenario/device/settings; >=10% P95 change, non-overlapping run P95 ranges, missed-frame rate not worse by >0.2 percentage points.'
    comparable = all(current.get(k) == baseline.get(k) and current.get(k) is not None
                     for k in ['scenarioHash', 'conditions'])
    a = [t for t in current.get('temperaturesC', []) if t is not None]
    b = [t for t in baseline.get('temperaturesC', []) if t is not None]
    comparable = comparable and bool(a and b) and abs(statistics.median(a)-statistics.median(b)) <= 2
    comparable = comparable and current.get('status') == baseline.get('status') == 'complete'
    verdicts = {}
    metrics = {}
    for phase, after in current['summary'].items():
        before = baseline.get('summary', {}).get(phase)
        verdict = 'indeterminate'
        if comparable and before and min(before['runs'], after['runs']) >= 3:
            ratio = after['medianP95Ms'] / before['medianP95Ms'] if before['medianP95Ms'] else 1
            if ratio <= .9 and after['p95Range'][1] < before['p95Range'][0] and after['missedPercent'] <= before['missedPercent'] + .2:
                verdict = 'gain observed'
            elif ratio >= 1.1 and after['p95Range'][0] > before['p95Range'][1]:
                verdict = 'regression'
        verdicts[phase] = verdict
        metrics[phase] = {'before': before, 'after': after}
    return dict(criteria=criteria, comparable=comparable, phases=verdicts, metrics=metrics)

class Runner:
    def __init__(self, options):
        self.o = options
        self.out = Path(options['output'])
        self.out.mkdir(parents=True, exist_ok=True)
        self.scenario = json.loads(Path(options['scenario']).read_text())
        self.phases = options.get('phases', ','.join(PHASES)).split(',')
        if not self.phases or any(p not in PHASES for p in self.phases):
            raise ValueError('Unknown reading phase')
        if options['packageName'] != PACKAGE:
            raise ValueError('Reading scenario is restricted to the base Noctalia package')
        self.statefile = self.out / 'report.json'
        self.scenario_hash = hashlib.sha256(json.dumps({k:v for k,v in self.scenario.items() if k != 'expected'}, sort_keys=True).encode()).hexdigest()
        self.state = dict(schemaVersion=1, scenarioHash=self.scenario_hash, rows=[], durations={}, status='running')
        if self.statefile.exists():
            if not options.get('resume'):
                raise ValueError('Output already contains a report. Use --resume or a fresh directory.')
            self.state = json.loads(self.statefile.read_text())
            if self.state['scenarioHash'] != self.scenario_hash:
                raise ValueError('Cannot resume a different scenario')
        self.started = time.monotonic()
        self.state['runnerSha256'] = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()

    def command(self, args, **kw):
        return subprocess.run(args, check=True, capture_output=True, timeout=40, **kw)

    def adb(self, *args, **kw):
        return self.command([self.o.get('adbCommand', 'adb'), '-s', self.o['device'], *args], **kw).stdout

    def shell(self, *args):
        return self.adb('shell', *args).decode().strip()

    def persist(self):
        self.state['summary'] = summaries(self.state['rows'])
        self.state['durations']['elapsedThisInvocationSeconds'] = round(time.monotonic() - self.started, 2)
        save(self.statefile, self.state)

    def tree(self):
        raw = self.adb('exec-out', 'uiautomator', 'dump', '/dev/tty').decode()
        return ET.fromstring(raw[raw.index('<?xml'):raw.rindex('</hierarchy>') + 12])

    def find(self, tree, identifier):
        return next((n for n in tree.iter('node') if n.get('resource-id') == identifier), None)

    def tap(self, node):
        if node is None:
            raise ValueError('Required UI target absent')
        x, y, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
        self.shell('input', 'tap', str((x + right) // 2), str((y + bottom) // 2))

    def preflight(self):
        start = time.monotonic()
        dump = self.shell('dumpsys', 'package', PACKAGE)
        pid = self.shell('pidof', PACKAGE)
        if not pid.isdigit():
            raise ValueError('Open the installed Noctalia app before the pilot')
        version = int(re.search(r'versionCode=(\d+)', dump)[1])
        paths = self.shell('pm', 'path', PACKAGE).splitlines()
        base = next(p.removeprefix('package:') for p in paths if p.endswith('/base.apk'))
        apk = self.out / 'installed-base.apk'
        self.adb('pull', base, str(apk))
        manifest = self.command([self.o['apkanalyzer'], 'manifest', 'print', str(apk)]).stdout.decode()
        (self.out / 'installed-manifest.xml').write_text(manifest)
        if re.search(r'android:debuggable="true"', manifest):
            raise ValueError('Debuggable binary cannot qualify Release performance')
        signature = self.command([self.o['apksigner'], 'verify', '--print-certs', str(apk)]).stdout.decode()
        cert = re.search(r'certificate SHA-256 digest: ([0-9a-f]+)', signature)[1]
        logs = self.adb('logcat', '-d', '--pid', pid, '-v', 'brief').decode()
        runtimes = []
        for line in logs.splitlines():
            if '[NoctaliaRuntime]' in line and '{' in line:
                try:
                    runtimes.append(json.loads(line[line.index('{'):]))
                except json.JSONDecodeError:
                    pass
        runtime = runtimes[-1] if runtimes else None
        prior = self.state.get('provenance', {})
        if runtime is None and prior.get('pid') == pid and prior.get('versionCode') == version:
            runtime = prior['runtime']
        if runtime is None:
            raise ValueError('Runtime event unavailable for current PID; capture the pilot immediately after launching, before warming the scenario')
        expected = self.scenario['expected']
        observed = dict(versionCode=version, certificateSha256=cert, runtimeVersion=runtime['runtimeVersion'], updateId=runtime['updateId'])
        for key, value in expected.items():
            if observed.get(key) != value:
                raise ValueError(f'Installed provenance mismatch: {key}')
        if runtime.get('development') or runtime.get('isEmergencyLaunch'):
            raise ValueError('Development/emergency launch is not a valid candidate')
        conditions = dict(device=self.o['device'], model=self.shell('getprop', 'ro.product.model'),
                          android=self.shell('getprop', 'ro.build.version.release'),
                          screenSize=self.shell('wm', 'size'),
                          fontScale=self.shell('settings', 'get', 'system', 'font_scale'),
                          peakRefreshRate=self.shell('settings', 'get', 'system', 'peak_refresh_rate'),
                          minRefreshRate=self.shell('settings', 'get', 'system', 'min_refresh_rate'))
        if self.state.get('conditions') and self.state['conditions'] != conditions:
            raise ValueError('Device settings changed since the interrupted measurement')
        if prior and any(prior.get(k) != observed[k] for k in observed):
            raise ValueError('Installed code changed since the interrupted measurement')
        self.state['conditions'] = conditions
        self.state['provenance'] = dict(**observed, pid=pid, runtime=runtime, profileableByShell=profileable(manifest),
                                       installer=re.search(r'installerPackageName=([^\s]+)', dump)[1],
                                       installedApkSha256=hashlib.sha256(apk.read_bytes()).hexdigest())
        if self.o.get('pilot'):
            if not profileable(manifest):
                raise ValueError('Installed manifest does not allow shell profiling')
            probe = f'/data/local/tmp/noctalia-perf-probe-{os.getpid()}.data'
            self.adb('shell', 'simpleperf', 'record', '--app', PACKAGE, '-o', probe, '-e', 'cpu-clock:u', '--duration', '1')
            self.adb('shell', 'rm', probe)
            self.state['provenance']['profilerProbe'] = 'passed'
        self.state['durations']['preflightSeconds'] = round(time.monotonic() - start, 2)
        self.persist()

    def assert_same_process(self):
        checks = [
            (self.shell('pidof', PACKAGE), self.state['provenance']['pid'], 'Application process'),
            (self.shell('settings', 'get', 'system', 'font_scale'), self.state['conditions']['fontScale'], 'Font scale'),
            (self.shell('settings', 'get', 'system', 'peak_refresh_rate'), self.state['conditions']['peakRefreshRate'], 'Refresh-rate setting'),
        ]
        for actual, expected, name in checks:
            if actual != expected:
                if self.state.get('activeTrace'):
                    self.state['activeTrace']['invalidReason'] = name + ' changed during capture'
                raise ValueError(name + ' changed during measurement; start a fresh pilot')

    def start_trace(self, run):
        token = f'{os.getpid()}-{time.time_ns()}'
        remote = f'/data/misc/perfetto-traces/noctalia-reading-{token}.pftrace'
        config = ('buffers { size_kb: 16384 fill_policy: RING_BUFFER }\nduration_ms: 120000\n'
                  'data_sources { config { name: "linux.process_stats" process_stats_config { scan_all_processes_on_start: true } } }\n'
                  'data_sources { config { name: "android.surfaceflinger.frametimeline" } }\n')
        result = self.adb('shell', 'perfetto', '--background-wait', '--txt', '-c', '-', '-o', remote, input=config.encode())
        pid = result.decode().strip().splitlines()[-1]
        if not pid.isdigit():
            raise ValueError('Missing trace PID')
        self.state['activeTrace'] = dict(pid=pid, remote=remote, local=str(self.out / f'{token}.pftrace'), run=run)
        self.persist()

    def finish_trace(self):
        trace = self.state.get('activeTrace')
        if not trace:
            return
        # Never terminate unrelated Perfetto sessions, including a reused PID.
        result = subprocess.run([self.o.get('adbCommand', 'adb'), '-s', self.o['device'], 'shell', 'cat', f"/proc/{trace['pid']}/cmdline"], capture_output=True, timeout=10)
        if result.returncode == 0 and trace['remote'].encode() in result.stdout:
            self.shell('kill', '-TERM', trace['pid'])
            time.sleep(1)
        elif result.returncode == 0 and b'perfetto' in result.stdout:
            raise ValueError('Trace process ownership ambiguous; retained for bounded automatic completion')
        self.adb('pull', trace['remote'], trace['local'])
        health = self.query(trace['local'], "SELECT name,value FROM stats WHERE severity='error' AND value !=0;")
        if trace.get('invalidReason'):
            health.append({'name': trace['invalidReason'], 'value': 1})
        self.state.setdefault('traces', []).append(dict(**trace, errors=health))
        for row in self.state['rows']:
            if row.get('trace') == trace['local'] and not row.get('valid'):
                sql = ("SELECT COUNT(*) AS frames, SUM(CASE WHEN f.jank_type LIKE '%App Deadline Missed%' THEN 1 ELSE 0 END) AS missed, "
                       "ROUND(PERCENTILE(f.dur/1e6,95),2) AS p95 FROM actual_frame_timeline_slice f JOIN process p USING(upid) "
                       f"WHERE p.name='{PACKAGE}' AND f.dur>0 AND f.ts>={row['startNs']} AND f.ts<{row['endNs']};")
                result = self.query(trace['local'], sql)[0]
                row.update(surfaceFrames=int(result['frames']), missed=int(result['missed']) if result['missed'] not in ('', '[NULL]') else 0,
                           p95Ms=float(result['p95']) if result['p95'] not in ('', '[NULL]') else None,
                           valid=not health and int(result['frames']) > 0)
        self.state.pop('activeTrace')
        self.persist()

    def query(self, trace, sql):
        raw = self.command([self.o['traceProcessor'], trace, '-Q', sql]).stdout.decode()
        return list(csv.DictReader(io.StringIO(raw)))

    def measure(self, run, phase, action):
        already = any(r['run'] == run and r['phase'] == phase and r.get('valid') for r in self.state['rows'])
        if phase not in self.phases or already:
            action()
            time.sleep(1.2)
            return
        start = int(float(self.shell('cat', '/proc/uptime').split()[0]) * 1e9)
        action()
        time.sleep(1.2)
        end = int(float(self.shell('cat', '/proc/uptime').split()[0]) * 1e9)
        self.state['rows'].append(dict(run=run, phase=phase, startNs=start, endNs=end,
                                      trace=self.state['activeTrace']['local'], valid=False))
        self.persist()

    def scroll(self):
        x, bottom, top, duration = self.scenario['swipe']
        for a,b in [(bottom,top),(bottom,top),(top,bottom),(top,bottom)]:
            self.shell('input', 'swipe', str(x), str(a), str(x), str(b), str(duration))
            time.sleep(.35)

    def journey(self, run):
        tree = self.tree()
        for key in ['analysis.reading.close', 'btn.navigateJournal', 'tab.journal']:
            node = self.find(tree, key)
            if node is not None:
                self.tap(node)
                tree = self.tree()
        card = self.find(tree, self.scenario['targetTestId'])
        if card is None:
            raise ValueError('Reference dream is not visible; refusing to choose another')
        label = card.get('content-desc', '') or ''.join(n.get('text', '') for n in card.iter('node'))
        digest = hashlib.sha256(label.encode()).hexdigest()
        if digest != self.scenario['dreamLabelSha256']:
            raise ValueError('Reference dream content changed')
        self.measure(run, 'detail-open', lambda: self.tap(card))
        if self.find(self.tree(), 'btn.navigateJournal') is None:
            raise ValueError('Detail screen not verified')
        if 'detail-scroll' in self.phases:
            self.measure(run, 'detail-scroll', self.scroll)
        if not any(p.startswith('reading-') for p in self.phases):
            return
        tree = self.tree()
        opener = self.find(tree, 'analysis.reading.open')
        for _ in range(3):
            if opener is not None:
                break
            x,bottom,top,duration = self.scenario['swipe']
            self.shell('input', 'swipe', str(x), str(bottom), str(x), str(top), str(duration))
            opener = self.find(self.tree(), 'analysis.reading.open')
        self.measure(run, 'reading-open', lambda: self.tap(opener))
        if self.find(self.tree(), 'analysis.reading.modal') is None:
            raise ValueError('Reader not verified')
        if 'reading-scroll' in self.phases:
            self.measure(run, 'reading-scroll', self.scroll)
        if self.find(self.tree(), 'analysis.reading.modal') is None:
            raise ValueError('Reader lost during journey')

    def run(self):
        self.preflight()
        self.finish_trace()  # Recover only this report's interrupted capture.
        count = 1 if self.o.get('pilot') else self.o['runs']
        if self.state.get('requestedRuns', count) != count or self.state.get('requestedPhases', self.phases) != self.phases:
            raise ValueError('Resume must preserve the predefined run count and selected phases')
        self.state['requestedRuns'] = count
        self.state['requestedPhases'] = self.phases
        for run in range(1,count+1):
            done = {r['phase'] for r in self.state['rows'] if r['run']==run and r.get('valid')}
            if set(self.phases) <= done:
                continue
            self.assert_same_process()
            capture_started = time.monotonic()
            self.start_trace(run)
            try:
                self.journey(run)
                self.assert_same_process()
                battery = self.shell('dumpsys', 'battery')
                temperature = re.search(r'temperature:\s+(\d+)', battery)
                self.state.setdefault('temperaturesC', []).append(int(temperature[1])/10 if temperature else None)
                thermal = self.shell('dumpsys', 'thermalservice')
                status = re.search(r'Thermal Status:\s+(\d+)', thermal)
                level = re.search(r'level:\s+(\d+)', battery)
                self.state.setdefault('conditionsByRun', []).append(dict(run=run, thermalStatus=int(status[1]) if status else None, batteryLevel=int(level[1]) if level else None))
            finally:
                self.finish_trace()
                self.state['durations'].setdefault('captureAndAnalysisSeconds', []).append(round(time.monotonic()-capture_started,2))
                self.persist()
            print(json.dumps(dict(run=run, summary=self.state['summary'])), flush=True)
        valid = {(r['run'],r['phase']) for r in self.state['rows'] if r.get('valid')}
        self.state['status'] = 'complete' if all((i,p) in valid for i in range(1,count+1) for p in self.phases) else 'incomplete'
        if self.o.get('baseline'):
            self.state['comparison'] = compare(self.state, json.loads(Path(self.o['baseline']).read_text()))
        self.persist()
        lines = ['# Reading performance', '', f"Status: {self.state['status']}", '',
                 'FrameTimeline surface-frame durations; not click-to-display latency or CPU. Gfxinfo is not used as a frame denominator.', '',
                 '| Phase | Runs | P95 median (ms) | App Deadline Missed |', '|---|---:|---:|---:|']
        for phase,s in self.state['summary'].items():
            lines.append(f"| {phase} | {s['runs']} | {s['medianP95Ms']:.2f} | {s['missed']}/{s['frames']} ({s['missedPercent']:.2f}%) |")
        lines += ['', json.dumps(self.state.get('comparison', {'verdict':'indeterminate: no comparable baseline supplied'})), '', 'Raw files may contain private device metadata. Keep this evidence directory private.']
        with (self.out/'report.csv').open('w', newline='') as file:
            writer = csv.DictWriter(file, fieldnames=['run','phase','surfaceFrames','missed','p95Ms','valid'], extrasaction='ignore')
            writer.writeheader()
            writer.writerows(self.state['rows'])
        (self.out/'report.md').write_text('\n'.join(lines)+'\n')
        if self.state['status'] != 'complete':
            raise ValueError('Incomplete or invalid trace evidence')

if __name__ == '__main__':
    def interrupted(_signum, _frame):
        raise KeyboardInterrupt()
    signal.signal(signal.SIGTERM, interrupted)
    runner = Runner(json.loads(sys.stdin.read()))
    try:
        runner.run()
    except BaseException as error:
        runner.state['status'] = 'interrupted' if isinstance(error, KeyboardInterrupt) else 'failed'
        runner.state['error'] = type(error).__name__ + ': ' + str(error)
        runner.persist()
        raise
