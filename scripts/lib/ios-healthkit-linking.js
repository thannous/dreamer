'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const HEALTHKIT_PACKAGE = '@kingstinct/react-native-healthkit';
const HEALTH_PURPOSE_KEYS = ['NSHealthShareUsageDescription', 'NSHealthUpdateUsageDescription'];

// Whether the iOS build of an app variant links HealthKit. Apple rejects an upload
// that links it without both purpose strings (ITMS-90683). react-native.config.js
// decides per NOCTALIA_APP_VARIANT, and autolinking skips a platform set to null.
function iosLinksHealthKit(projectRoot, variant) {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  if (!pkg.dependencies?.[HEALTHKIT_PACKAGE]) return false;
  const configPath = path.join(projectRoot, 'react-native.config.js');
  if (!fs.existsSync(configPath)) return true;
  // Evaluated afresh with the variant's environment, as autolinking would see it.
  const env = { ...process.env, NOCTALIA_APP_VARIANT: variant };
  if (variant === undefined) delete env.NOCTALIA_APP_VARIANT;
  const configModule = { exports: {} };
  vm.runInNewContext(fs.readFileSync(configPath, 'utf8'), { module: configModule, exports: configModule.exports, process: { env } },
    { filename: configPath });
  return configModule.exports.dependencies?.[HEALTHKIT_PACKAGE]?.platforms?.ios !== null;
}

function missingHealthPurposeKeys(infoPlist) {
  return HEALTH_PURPOSE_KEYS.filter(key => typeof infoPlist?.[key] !== 'string' || !infoPlist[key].trim());
}

module.exports = { HEALTH_PURPOSE_KEYS, iosLinksHealthKit, missingHealthPurposeKeys };
