#!/usr/bin/env node
// Synthetic ADB transport for the runner's CLI contract, never a device measurement.
const fs = require('node:fs');
const args = process.argv.slice(4).join(' ');
const scenario = process.env.PERF_FIXTURE_SCENARIO;
const state = process.env.PERF_FIXTURE_STATE;
const run = fs.existsSync(state) ? Number(fs.readFileSync(state, 'utf8')) : 0;
let output = '';
if (args === 'shell run-as com.tanuki75.noctalia id') process.exit(1);
if (args === 'shell pm path com.tanuki75.noctalia') output = 'package:/fixture/base.apk';
if (args === 'shell dumpsys power') output = 'mWakefulness=Awake';
if (args === 'shell dumpsys window policy') output = 'KeyguardServiceDelegate\n showing=false';
if (args === 'shell dumpsys package com.tanuki75.noctalia') output = 'versionCode=1 versionName=fixture targetSdk=36';
if (args.startsWith('shell am start ')) {
  fs.writeFileSync(state, String(run + 1));
  output = `Status: ok\nTotalTime: ${scenario === 'mixed' && run === 2 ? 9999 : 100}\n`;
}
if (args.startsWith('logcat -d')) {
  output = '[NoctaliaPerf] name=startup.root_mounted elapsed_ms=10.0\n';
  if (scenario !== 'missing-marker') output += '[NoctaliaPerf] name=startup.interactive elapsed_ms=110.0\n';
  if (scenario === 'invalid' || (scenario === 'mixed' && run === 3)) output += 'FATAL EXCEPTION: fixture\n';
}
if (args === 'shell dumpsys activity activities') output = 'topResumedActivity=com.tanuki75.noctalia/.MainActivity';
if (args === 'shell dumpsys meminfo com.tanuki75.noctalia') output = 'App Summary\n TOTAL PSS: 12345';
process.stdout.write(output);
