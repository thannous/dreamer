// plugins/withDisableNotificationsBootActions.js
// Workaround for Android 15 BOOT_COMPLETED restrictions
// See: https://github.com/expo/expo/issues/41627
const { withAndroidManifest } = require('@expo/config-plugins');

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

module.exports = function withDisableNotificationsBootActions(config, options = {}) {
  const { removeBootPermission = false } = options;

  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults;

    // Ensure tools namespace exists
    manifest.manifest.$ = manifest.manifest.$ || {};
    if (!manifest.manifest.$['xmlns:tools']) {
      manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    const app = manifest.manifest.application?.[0];
    if (!app) return config;

    const targetName = 'expo.modules.notifications.service.NotificationsService';

    // Replace the receiver definition entirely (removes BOOT_COMPLETED etc)
    const replacementReceiver = {
      $: {
        'android:name': targetName,
        'android:enabled': 'true',
        'android:exported': 'false',
        'tools:node': 'replace',
      },
      'intent-filter': [
        {
          $: { 'android:priority': '-1' },
          action: [
            { $: { 'android:name': 'expo.modules.notifications.NOTIFICATION_EVENT' } },
          ],
        },
      ],
    };

    const receivers = asArray(app.receiver);
    const idx = receivers.findIndex(r => r?.$?.['android:name'] === targetName);

    if (idx >= 0) {
      receivers[idx] = replacementReceiver;
    } else {
      receivers.push(replacementReceiver);
    }

    app.receiver = receivers;

    // Optional: remove RECEIVE_BOOT_COMPLETED permission
    if (removeBootPermission && manifest.manifest['uses-permission']) {
      const perms = asArray(manifest.manifest['uses-permission']);
      manifest.manifest['uses-permission'] = perms.filter(
        p => p?.$?.['android:name'] !== 'android.permission.RECEIVE_BOOT_COMPLETED'
      );
    }

    console.log('[withDisableNotificationsBootActions] Replaced NotificationsService receiver');
    return config;
  });
};
