import tempfile
import hashlib
import json
import xml.etree.ElementTree as ET
import unittest
from pathlib import Path
from unittest.mock import patch
import importlib.util
spec = importlib.util.spec_from_file_location('reading', Path(__file__).with_name('reading-performance.py'))
reading = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reading)

class EvidenceTests(unittest.TestCase):
    def test_manifest_without_dumpsys_flag_is_profileable(self):
        # Real apkanalyzer output can contain malformed XML in unrelated metadata.
        manifest = '<application><meta-data value="{"channel":"qa"}"/><profileable android:enabled="true" android:shell="true"/></application>'
        self.assertTrue(reading.profileable(manifest))
        self.assertFalse(reading.profileable('<application/>'))
        self.assertFalse(reading.profileable('<profileable android:enabled="false" android:shell="true"/>'))

    def report(self, p95, span):
        return dict(status='complete', scenarioHash='dream', conditions={'device':'same'}, temperaturesC=[24],
                    summary={'reading-open': dict(runs=5, medianP95Ms=p95, p95Range=span, missedPercent=1)})

    def test_comparison_rejects_noisy_or_incomparable_improvements(self):
        before = self.report(30, [28,32])
        self.assertEqual(reading.compare(self.report(27,[26,29]),before)['phases']['reading-open'],'indeterminate')
        after = self.report(20,[19,21]);after['conditions']={'device':'different'}
        self.assertFalse(reading.compare(after,before)['comparable'])
        after = self.report(20,[19,21]);after['temperaturesC']=[29]
        self.assertFalse(reading.compare(after,before)['comparable'])

    def test_comparison_reports_both_directions_and_missed_deadlines(self):
        before = self.report(30,[28,32])
        self.assertEqual(reading.compare(self.report(20,[19,21]),before)['phases']['reading-open'],'gain observed')
        self.assertEqual(reading.compare(self.report(40,[39,41]),before)['phases']['reading-open'],'regression')
        after=self.report(20,[19,21]);after['summary']['reading-open']['missedPercent']=5
        self.assertEqual(reading.compare(after,before)['phases']['reading-open'],'indeterminate')

    def test_partial_and_invalid_rows_do_not_become_successful_measurements(self):
        rows=[dict(phase='reading-open',valid=True,surfaceFrames=10,missed=1,p95Ms=20),
              dict(phase='reading-open',valid=False,surfaceFrames=999,missed=0,p95Ms=1)]
        result=reading.summaries(rows)['reading-open']
        self.assertEqual(result['runs'],1)
        self.assertEqual(result['frames'],10)
        self.assertEqual(result['missedPercent'],10)

    def test_trace_recovery_does_not_kill_reused_unrelated_pid(self):
        with tempfile.TemporaryDirectory() as directory:
            runner=object.__new__(reading.Runner)
            runner.o={'device':'test'};runner.out=Path(directory)
            runner.state={'activeTrace':dict(pid='123',remote='/owned.trace',local=str(Path(directory)/'trace'),run=1),'rows':[]}
            calls=[]
            runner.adb=lambda *args: calls.append(args)
            runner.shell=lambda *args: self.fail('must not kill an unrelated process')
            runner.query=lambda *args: []
            runner.persist=lambda: None
            with patch.object(reading.subprocess,'run',return_value=reading.subprocess.CompletedProcess([],0,b'unrelated',b'')):
                runner.finish_trace()
            self.assertNotIn('activeTrace',runner.state)
            self.assertEqual(calls[0][0],'pull')

    def test_interruption_still_finalizes_owned_trace(self):
        runner=object.__new__(reading.Runner)
        runner.o={'runs':1};runner.phases=['reading-open'];runner.state={'rows':[], 'durations':{}}
        runner.preflight=lambda: None
        runner.assert_same_process=lambda: None
        calls=[]
        runner.finish_trace=lambda: calls.append('finish')
        runner.start_trace=lambda run: calls.append('start')
        runner.persist=lambda: None
        def interrupt(run):
            runner.state['rows'].append({'run':run,'phase':'reading-open','valid':False})
            raise KeyboardInterrupt()
        runner.journey=interrupt
        with self.assertRaises(KeyboardInterrupt):runner.run()
        self.assertEqual(calls,['finish','start','finish'])
        self.assertEqual(len(runner.state['rows']),1)

    def test_atomic_save_preserves_partial_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            file=Path(directory)/'report.json'
            reading.save(file, {'rows':[{'run':1,'phase':'reading-open','valid':False}]})
            self.assertEqual(reading.json.loads(file.read_text())['rows'][0]['valid'],False)
            self.assertFalse(file.with_suffix('.json.tmp').exists())


    def scenario_runner(self, directory, package='com.tanuki75.noctalia.qa', phase='screen-scroll'):
        scenario = Path(directory) / 'scenario.json'
        scenario.write_text(json.dumps(dict(name='Trends', screenTestId='screen.trends', targetTestId='ready',
            targetLabelSha256=hashlib.sha256(b'27 dreams').hexdigest(), swipe=[500, 2000, 700, 400],
            expected=dict(versionCode=83, certificateSha256='abc', runtimeVersion='', updateId=None))))
        return reading.Runner(dict(output=str(Path(directory) / 'evidence'), scenario=str(scenario),
            packageName=package, device='owned', phases=phase, apkanalyzer='apkanalyzer', apksigner='apksigner', pilot=True))

    def test_owned_qa_preflight_never_reads_the_personal_package(self):
        # The real negative case cannot safely probe another installed personal app.
        # Record the adb interface's actual arguments, including the profiler app.
        with tempfile.TemporaryDirectory() as directory:
            runner = self.scenario_runner(directory)
            qa = 'com.tanuki75.noctalia.qa'
            runtime = dict(applicationId=qa, runtimeVersion='', updateId=None, development=False, isEmergencyLaunch=False)
            calls = []
            def adb(*args, **_kwargs):
                calls.append(args)
                if args[:3] == ('shell', 'dumpsys', 'package'):
                    self.assertEqual(args[3], qa)
                    return b'versionCode=83 installerPackageName=null'
                if args[:2] == ('shell', 'pidof'):
                    self.assertEqual(args[2], qa)
                    return b'123'
                if args[:3] == ('shell', 'pm', 'path'):
                    self.assertEqual(args[3], qa)
                    return b'package:/data/app/owned/base.apk'
                if args[0] == 'pull':
                    Path(args[2]).write_bytes(b'owned APK')
                    return b''
                if args[0] == 'logcat':
                    return ('[NoctaliaRuntime] ' + json.dumps(runtime)).encode()
                if args[:2] == ('shell', 'getprop'): return b'Motorola'
                if args[:2] == ('shell', 'wm'): return b'Physical size: 1220x2712'
                if args[:2] == ('shell', 'settings'): return b'1.0'
                if args[:2] == ('shell', 'simpleperf'):
                    self.assertEqual(args[args.index('--app') + 1], qa)
                    return b''
                if args[:2] == ('shell', 'rm'): return b''
                self.fail('Unexpected adb call: ' + repr(args))
            runner.adb = adb
            runner.command = lambda args, **kw: reading.subprocess.CompletedProcess(args, 0,
                b'<profileable android:shell="true"/>' if args[0] == 'apkanalyzer' else b'certificate SHA-256 digest: abc', b'')
            runner.preflight()
            self.assertEqual(runner.state['conditions']['package'], qa)
            self.assertEqual(runner.state['provenance']['profilerProbe'], 'passed')
            self.assertFalse(any(reading.PACKAGE == item for args in calls for item in args))
            runtime['applicationId'] = reading.PACKAGE
            with self.assertRaisesRegex(ValueError, 'Runtime application'):
                runner.preflight()

    def test_other_products_and_mixed_screen_phases_are_refused(self):
        with tempfile.TemporaryDirectory() as directory:
            for package in ['com.other.app', reading.PACKAGE + '.lucid']:
                with self.assertRaisesRegex(ValueError, 'Dreamer base or owned QA'):
                    self.scenario_runner(directory, package)
            with self.assertRaisesRegex(ValueError, 'exactly one phase'):
                self.scenario_runner(directory, phase='screen-scroll,detail-open')
            # The historical default remains available, with the same phases.
            self.assertEqual(self.scenario_runner(directory, reading.PACKAGE).package, reading.PACKAGE)

    def test_screen_scroll_refuses_changed_content_and_a_lost_screen(self):
        with tempfile.TemporaryDirectory() as directory:
            runner = self.scenario_runner(directory)
            ready = ET.fromstring('<hierarchy><node resource-id="screen.trends"><node resource-id="ready" text="27 dreams"/></node></hierarchy>')
            wrong = ET.fromstring('<hierarchy><node resource-id="screen.recording"/></hierarchy>')
            actions = []
            runner.scroll = lambda: actions.append('scroll')
            runner.measure = lambda run, phase, action: action()
            runner.tree = iter([ready, wrong]).__next__
            with self.assertRaisesRegex(ValueError, 'Expected screen'):
                runner.journey(1)
            self.assertEqual(actions, ['scroll'])
            runner.tree = lambda: ready
            ready.find('.//node[@resource-id="ready"]').set('text', 'different journal')
            with self.assertRaisesRegex(ValueError, 'content changed'):
                runner.journey(1)
            self.assertEqual(actions, ['scroll'])

    def test_different_packages_are_not_comparable(self):
        before, after = self.report(30, [28, 32]), self.report(20, [19, 21])
        before['conditions']['package'] = reading.PACKAGE
        after['conditions']['package'] = reading.PACKAGE + '.qa'
        self.assertFalse(reading.compare(after, before)['comparable'])

if __name__=='__main__':unittest.main()
