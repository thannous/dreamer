/* global describe, it, expect */
const {
  BOOT_COMPLETED,
  NOTIFICATION_EVENT,
  NOTIFICATIONS_SERVICE,
  RECEIVE_BOOT_COMPLETED,
  collectIntentActions,
  disableNotificationBootActions,
} = require('../plugins/withDisableNotificationsBootActions');

function bootReceiverManifest() {
  return {
    manifest: {
      $: {},
      'uses-permission': [{ $: { 'android:name': RECEIVE_BOOT_COMPLETED } }],
      application: [
        {
          receiver: [
            {
              $: {
                'android:name': NOTIFICATIONS_SERVICE,
                'android:enabled': 'true',
                'android:exported': 'true',
              },
              'intent-filter': [
                {
                  action: [
                    { $: { 'android:name': BOOT_COMPLETED } },
                    { $: { 'android:name': NOTIFICATION_EVENT } },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

describe('withDisableNotificationsBootActions', () => {
  it('keeps NotificationsService private, retains NOTIFICATION_EVENT, and drops BOOT_COMPLETED', () => {
    const manifest = bootReceiverManifest();
    disableNotificationBootActions(manifest);
    const receiver = manifest.manifest.application[0].receiver[0];
    const actions = collectIntentActions(receiver);

    expect(receiver.$['android:name']).toBe(NOTIFICATIONS_SERVICE);
    expect(receiver.$['android:exported']).toBe('false');
    expect(actions).toEqual([NOTIFICATION_EVENT]);
    expect(actions).not.toContain(BOOT_COMPLETED);
    expect(manifest.manifest['uses-permission']).toEqual([
      { $: { 'android:name': RECEIVE_BOOT_COMPLETED } },
    ]);
  });

  it('can also drop RECEIVE_BOOT_COMPLETED when asked', () => {
    const manifest = bootReceiverManifest();
    disableNotificationBootActions(manifest, { removeBootPermission: true });
    expect(manifest.manifest['uses-permission']).toEqual([]);
  });
});
