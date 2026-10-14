const { AndroidConfig, withStringsXml } = require('expo/config-plugins');

/**
 * Home-screen label for device languages without a `locales` entry. Expo
 * writes `app_name` from `name`, which stays the project name; on iOS
 * `ios.infoPlist.CFBundleDisplayName` plays this role.
 */
module.exports = function withAndroidDefaultLabel(config, label) {
  return withStringsXml(config, (modConfig) => {
    modConfig.modResults = AndroidConfig.Strings.setStringItem(
      [{ $: { name: 'app_name' }, _: label }],
      modConfig.modResults
    );
    return modConfig;
  });
};
