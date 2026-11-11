import type { TestFixtures } from 'e2e';

// A production Android build carries a telemetry library that schedules a background
// job about 30 seconds after launch. When the runner force-stops the app after a long
// journey, Android starts a new, empty process for that job just as it is cancelled, and
// the close step refuses the open ("process remained running after close"). That empty
// process has no screen and dies with the next force-stop, so one more open is the
// whole recovery; any other failure, or the same one twice, still fails the journey.
const EMPTY_JOB_PROCESS = /process remained running after close/;

export async function openApp(app: TestFixtures['app']) {
  try {
    await app.open();
  } catch (error) {
    if (!EMPTY_JOB_PROCESS.test(error instanceof Error ? error.message : String(error))) throw error;
    await app.open();
  }
}
