import { execFileSync } from 'node:child_process';
import type { TestFixtures } from 'e2e';

const appId = 'com.tanuki75.noctalia';

// A production Android build carries a telemetry library that schedules a background job
// about 30 seconds after launch. When the app is force-stopped after a longer journey,
// Android starts a new, empty process for that job just as the job is cancelled, and the
// runner's close inside app.open() refuses it ("process remained running after close").
// Stopping the app here first lets that empty process appear and die before app.open(),
// which stays the journey's first recorded step. Any other failure still fails the journey.
function stopAndroidApp() {
  const serial = process.env.E2E_DEVICE ?? '';
  if (process.env.E2E_PLATFORM !== 'android' || !/^emulator-\d+$/.test(serial)) return;
  const adb = (...args: string[]) => execFileSync(process.env.ADB_BIN || 'adb', ['-s', serial, 'shell', ...args],
    { encoding: 'utf8', timeout: 15_000, stdio: ['ignore', 'pipe', 'pipe'] });
  const running = () => {
    try { return adb('pidof', appId).trim() !== ''; } catch { return false; } // pidof exits 1 when nothing runs.
  };
  for (let round = 0; round < 3; round++) {
    if (!running()) {
      // The job's process starts within about 100 ms of a force-stop; watch a while longer.
      const until = Date.now() + 1_500;
      let restarted = false;
      while (!restarted && Date.now() < until) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
        restarted = running();
      }
      if (!restarted) return;
    }
    adb('am', 'force-stop', appId);
  }
}

export async function openApp(app: TestFixtures['app']) {
  stopAndroidApp();
  await app.open();
}
