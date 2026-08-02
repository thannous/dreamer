'use strict';

const {
  DEV_TRANSPORT_PATTERN,
  FATAL_PATTERN,
  parseArgs,
  parseDeviceReadiness,
  parseGfxinfo,
  parseLaunch,
  parseMarkers,
  parseMeminfo,
  percentile,
  getRunFailureReasons,
  summarizeRuns,
  toCsv,
} = require('./measure-android-performance');

describe('measure-android-performance', () => {
  it('parses the CLI contract and rejects invalid modes', () => {
    expect(parseArgs(['--device', 'wifi:1234', '--apk', './candidate.apk', '--mode', 'all', '--runs', '15'])).toMatchObject({
      apk: expect.stringMatching(/candidate\.apk$/),
      device: 'wifi:1234',
      mode: 'all',
      runs: 15,
    });
    expect(() => parseArgs(['--mode', 'debug'])).toThrow('Unsupported --mode');
  });

  it('parses launch, marker, frame, and memory evidence', () => {
    expect(parseLaunch('Status: ok\nLaunchState: COLD\nActivity: app/.Main\nTotalTime: 895\nWaitTime: 897\n')).toEqual({
      activity: 'app/.Main',
      launchState: 'COLD',
      status: 'ok',
      totalTimeMs: 895,
      waitTimeMs: 897,
    });
    expect(parseMarkers([
      '[NoctaliaPerf] name=startup.root_mounted elapsed_ms=100.0',
      '[NoctaliaPerf] name=startup.navigation_replace elapsed_ms=250.0',
      '[NoctaliaPerf] name=startup.route_committed elapsed_ms=320.0',
      '[NoctaliaPerf] name=startup.interactive elapsed_ms=510.5',
    ].join('\n'))).toMatchObject({
      rootToInteractiveMs: 410.5,
      rootToNavigationMs: 150,
      navigationToRouteMs: 70,
      routeToInteractiveMs: 190.5,
    });
    expect(parseGfxinfo([
      'Total frames rendered: 195',
      'Janky frames: 3 (1.54%)',
      '50th percentile: 11ms',
      '90th percentile: 12ms',
      '95th percentile: 22ms',
      '99th percentile: 150ms',
      'Number Frame deadline missed: 3',
    ].join('\n'))).toMatchObject({ frames: 195, jankyPercent: 1.54, p95Ms: 22, p99Ms: 150 });
    expect(parseMeminfo('App Summary\n Native Heap: 211696\n Graphics: 79843\n TOTAL PSS: 411163 TOTAL RSS: 546487')).toMatchObject({
      nativeHeapKb: 211696,
      graphicsKb: 79843,
      totalPssKb: 411163,
      totalRssKb: 546487,
    });
  });

  it('uses nearest-rank medians and p95 values', () => {
    expect(percentile([957, 886, 895, 900, 892], 50)).toBe(895);
    expect(percentile([957, 886, 895, 900, 892], 95)).toBe(957);
  });

  it('summarizes runs and exports stable CSV columns', () => {
    const runs = [1, 2, 3].map((run) => ({
      devTransportDetected: false,
      fatalError: run === 3,
      gfxinfo: { deadlineMisses: run, jankyPercent: run, p95Ms: 20 + run, p99Ms: 90 + run },
      launch: { totalTimeMs: 700 + run },
      markers: { rootToInteractiveMs: 300 + run },
      meminfo: { graphicsKb: 60 + run, nativeHeapKb: 170 + run, totalPssKb: 320 + run },
      mode: 'cold',
      run,
      thermalStatus: 0,
    }));
    expect(summarizeRuns(runs)).toMatchObject({
      count: 3,
      amTotalMs: { median: 702, p95: 703 },
      fatalRuns: 1,
    });
    expect(toCsv(runs)).toContain('mode,run,am_total_ms');
    expect(toCsv(runs)).toContain('cold,1,701,301');
  });

  it('detects fatal and development transport signatures', () => {
    expect(FATAL_PATTERN.test('FATAL EXCEPTION: main')).toBe(true);
    expect(DEV_TRANSPORT_PATTERN.test('Connecting to Metro on :8081')).toBe(true);
    expect(DEV_TRANSPORT_PATTERN.test('Release startup complete')).toBe(false);
  });

  it('rejects a sleeping or securely locked measurement device', () => {
    expect(parseDeviceReadiness(
      'mWakefulness=Awake',
      'KeyguardServiceDelegate\n showing=false\n occluded=false'
    )).toMatchObject({ ready: true, wakefulness: 'Awake' });
    expect(parseDeviceReadiness(
      'mWakefulness=Dozing',
      'KeyguardServiceDelegate\n showing=true\n occluded=false'
    )).toMatchObject({ ready: false, keyguardShowing: true });
  });

  it('records explicit reasons for invalid runs', () => {
    expect(getRunFailureReasons({
      activityResumed: false,
      devTransportDetected: false,
      fatalError: false,
      launch: { status: 'ok', totalTimeMs: null },
      markers: { rootToInteractiveMs: null },
      mode: 'cold',
    })).toEqual([
      'activity_not_resumed',
      'missing_am_total_time',
      'missing_cold_interactive_marker',
    ]);
  });
});
