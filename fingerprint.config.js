// The runtime fingerprint hashes autolinked native modules, not the app-target
// Swift that Expo inline modules compile from app-intents/ (Siri "Note a dream").
// Without this, a change there alone would keep the runtime version and let an
// update reach a binary built without it.
/** @type {import('expo/fingerprint').Config} */
module.exports = {
  extraSources: [{ type: 'dir', filePath: 'app-intents', reasons: ['appIntents'] }],
};
