const LUCID_LOCAL_MICROPHONE_PERMISSION =
  'Noctalia Lucid Trainer records a morning dream note on this device after you tap Speak. Audio stays local and is never uploaded or transcribed automatically.';

function pluginName(plugin) {
  return Array.isArray(plugin) ? plugin[0] : plugin;
}

function evaluateLucidMicrophoneContract(target = {}) {
  const pluginsList = (target.plugins || []).map(pluginName);
  const audioPlugin = (target.plugins || []).find((entry) => pluginName(entry) === 'expo-audio');
  const audioOptions = Array.isArray(audioPlugin) ? audioPlugin[1] : undefined;
  const microphonePermission = audioOptions?.microphonePermission;
  const blockedPermissions = target.android?.blockedPermissions ?? [];
  const androidPermissions = target.android?.permissions ?? [];
  const usageDescription = target.ios?.infoPlist?.NSMicrophoneUsageDescription;
  const speechUsageDescription = target.ios?.infoPlist?.NSSpeechRecognitionUsageDescription;

  return {
    ok:
      microphonePermission === LUCID_LOCAL_MICROPHONE_PERMISSION &&
      !blockedPermissions.includes('android.permission.RECORD_AUDIO') &&
      androidPermissions.includes('android.permission.RECORD_AUDIO') &&
      usageDescription === LUCID_LOCAL_MICROPHONE_PERMISSION &&
      speechUsageDescription == null &&
      !pluginsList.includes('expo-speech-recognition'),
    detail: [
      `microphonePermission=${JSON.stringify(microphonePermission ?? null)}`,
      `RECORD_AUDIO blocked=${blockedPermissions.includes('android.permission.RECORD_AUDIO')}`,
      `RECORD_AUDIO declared=${androidPermissions.includes('android.permission.RECORD_AUDIO')}`,
      `NSMicrophoneUsageDescription=${JSON.stringify(usageDescription ?? null)}`,
      `NSSpeechRecognitionUsageDescription=${JSON.stringify(speechUsageDescription ?? null)}`,
      `expo-speech-recognition=${pluginsList.includes('expo-speech-recognition')}`,
    ].join(' · '),
  };
}

module.exports = {
  evaluateLucidMicrophoneContract,
  LUCID_LOCAL_MICROPHONE_PERMISSION,
};
