// Declares the languages of the Siri strings (app-intents/<language>.lproj) as
// project localizations, like adding them in Xcode, so Siri on a French iPhone
// gets the French phrases and answers instead of the English ones.
const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const STRINGS_DIRECTORY = 'app-intents';

function stringsLanguages(projectRoot) {
  return fs
    .readdirSync(path.join(projectRoot, STRINGS_DIRECTORY), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.lproj'))
    .map((entry) => entry.name.slice(0, -'.lproj'.length))
    .sort();
}

// pbxproj quotes a region such as "pt-BR".
function pbxValue(language) {
  return /^[A-Za-z0-9_]+$/.test(language) ? language : `"${language}"`;
}

module.exports = function withAppIntentsLocalizations(config) {
  return withXcodeProject(config, (nextConfig) => {
    const { firstProject } = nextConfig.modResults.getFirstProject();
    const regions = firstProject.knownRegions ?? [];
    for (const language of stringsLanguages(nextConfig.modRequest.projectRoot)) {
      const value = pbxValue(language);
      if (!regions.includes(value) && !regions.includes(language)) regions.push(value);
    }
    firstProject.knownRegions = regions;
    return nextConfig;
  });
};
