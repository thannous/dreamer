// plugins/withDisableNotificationsBootActions.js
// Workaround for Android 15 BOOT_COMPLETED restrictions.
// See: https://github.com/expo/expo/issues/41627
// Dreamer does not restore scheduled reminders on reboot; launch/foreground
// reconciliation is the recovery path.
const { withAndroidManifest } = require('expo/config-plugins');

const NOTIFICATIONS_SERVICE = 'expo.modules.notifications.service.NotificationsService';
const BOOT_COMPLETED = 'android.intent.action.BOOT_COMPLETED';
const RECEIVE_BOOT_COMPLETED = 'android.permission.RECEIVE_BOOT_COMPLETED';
const NOTIFICATION_EVENT = 'expo.modules.notifications.NOTIFICATION_EVENT';

function asArray(v) {
  if (!v) return [];
  return Array.isArray(v) ? v : [v];
}

function collectIntentActions(receiver) {
  return asArray(receiver?.['intent-filter']).flatMap((filter) =>
    asArray(filter?.action).map((action) => action?.$?.['android:name'])
  );
}

function createNotificationsReceiverWithoutBoot() {
  return {
    $: {
      'android:name': NOTIFICATIONS_SERVICE,
      'android:enabled': 'true',
      'android:exported': 'false',
      'tools:node': 'replace',
    },
    'intent-filter': [
      {
        $: { 'android:priority': '-1' },
        action: [{ $: { 'android:name': NOTIFICATION_EVENT } }],
      },
    ],
  };
}

function disableNotificationBootActions(manifest, options = {}) {
  const { removeBootPermission = false } = options;
  manifest.manifest = manifest.manifest || {};
  manifest.manifest.$ = manifest.manifest.$ || {};
  if (!manifest.manifest.$['xmlns:tools']) {
    manifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
  }

  const app = manifest.manifest.application?.[0];
  if (!app) return manifest;

  const replacementReceiver = createNotificationsReceiverWithoutBoot();
  const receivers = asArray(app.receiver);
  const idx = receivers.findIndex((r) => r?.$?.['android:name'] === NOTIFICATIONS_SERVICE);

  if (idx >= 0) {
    receivers[idx] = replacementReceiver;
  } else {
    receivers.push(replacementReceiver);
  }

  app.receiver = receivers;

  if (removeBootPermission && manifest.manifest['uses-permission']) {
    const perms = asArray(manifest.manifest['uses-permission']);
    manifest.manifest['uses-permission'] = perms.filter(
      (p) => p?.$?.['android:name'] !== RECEIVE_BOOT_COMPLETED
    );
  }

  return manifest;
}

function withDisableNotificationsBootActions(config, options = {}) {
  return withAndroidManifest(config, (config) => {
    disableNotificationBootActions(config.modResults, options);
    console.log('[withDisableNotificationsBootActions] Replaced NotificationsService receiver');
    return config;
  });
}

module.exports = withDisableNotificationsBootActions;
module.exports.disableNotificationBootActions = disableNotificationBootActions;
module.exports.collectIntentActions = collectIntentActions;
module.exports.NOTIFICATIONS_SERVICE = NOTIFICATIONS_SERVICE;
module.exports.BOOT_COMPLETED = BOOT_COMPLETED;
module.exports.RECEIVE_BOOT_COMPLETED = RECEIVE_BOOT_COMPLETED;
module.exports.NOTIFICATION_EVENT = NOTIFICATION_EVENT;
