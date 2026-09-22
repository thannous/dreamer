import tempfile
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

if __name__=='__main__':unittest.main()
