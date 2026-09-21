import * as Application from 'expo-application';
import * as Updates from 'expo-updates';

let reported = false;

/** One allowlisted diagnostic per JS runtime, including release builds. No storage or network calls. */
export function reportRuntimeIdentity(): void {
  if (reported) return;
  reported = true;

  try {
    const updateId = Updates.updateId;
    const runtimeVersion = Updates.runtimeVersion;
    // In development/disabled mode, Expo can default isEmbeddedLaunch to false.
    // That absence of evidence must never be labelled as an OTA launch.
    const canIdentifyLaunch = !__DEV__ && Updates.isEnabled && Boolean(updateId && runtimeVersion);
    const identity = {
      schemaVersion: 1,
      observedAt: new Date().toISOString(),
      applicationId: Application.applicationId,
      nativeApplicationVersion: Application.nativeApplicationVersion,
      nativeBuildVersion: Application.nativeBuildVersion,
      development: __DEV__,
      updatesEnabled: Updates.isEnabled,
      updateId,
      runtimeVersion,
      isEmbeddedLaunch: Updates.isEmbeddedLaunch,
      launchSource: canIdentifyLaunch ? (Updates.isEmbeddedLaunch ? 'embedded' : 'ota') : 'unknown',
      isEmergencyLaunch: Updates.isEmergencyLaunch ?? null,
      channel: Updates.channel,
    };
    // Keep this release log: unlike the development logger, it identifies the code
    // actually executing. Never spread a manifest, error, account or device object here.
    console.info(`[NoctaliaRuntime] ${JSON.stringify(identity)}`);
  } catch {
    // Diagnostics must neither break startup nor expose native error details.
  }
}
