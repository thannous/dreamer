const { expo } = require('../apps/meditation/app.json');

describe('Meditation playback-only native capabilities', () => {
  it('disables recording permissions without disabling background playback', () => {
    const [, audio] = expo.plugins.find((entry) => Array.isArray(entry) && entry[0] === 'expo-audio');
    expect(audio).toMatchObject({
      microphonePermission: false,
      recordAudioAndroid: false,
      enableBackgroundPlayback: true,
    });
    expect(expo.android.blockedPermissions).toContain('android.permission.RECORD_AUDIO');
    expect(expo.android.permissions).not.toContain('android.permission.RECORD_AUDIO');
    expect(expo.android.permissions).toContain('android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK');
    expect(expo.ios.infoPlist.UIBackgroundModes).toContain('audio');
  });
});
