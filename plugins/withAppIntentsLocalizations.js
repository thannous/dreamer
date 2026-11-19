// Declares the languages of the Siri strings (app-intents/<language>.lproj) as
// project localizations, like adding them in Xcode, so Siri on a French iPhone
// gets the French phrases and answers instead of the English ones.
const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const { addKnownRegions } = require('./xcodeProjectResources');

const STRINGS_DIRECTORY = 'app-intents';

function stringsLanguages(projectRoot) {
  return fs
    .readdirSync(path.join(projectRoot, STRINGS_DIRECTORY), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.endsWith('.lproj'))
    .map((entry) => entry.name.slice(0, -'.lproj'.length))
    .sort();
}

module.exports = function withAppIntentsLocalizations(config) {
  return withXcodeProject(config, (nextConfig) => {
    addKnownRegions(nextConfig.modResults, stringsLanguages(nextConfig.modRequest.projectRoot));
    return nextConfig;
  });
};
