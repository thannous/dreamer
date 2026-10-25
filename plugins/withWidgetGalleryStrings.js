// Translates the widgets' names and descriptions in the iOS widget gallery. expo-widgets
// writes them in English (app.json) and WidgetKit looks each one up in the widget
// extension's own Localizable.strings: this lays one per language in the extension only,
// as Xcode's localized resources do, so the app keeps its Siri strings
// (app-intents/<language>.lproj) under the same file name.
//
// Listed before expo-widgets in app.json: a plugin's mods run after those of the plugins
// listed after it, and the extension target only exists once expo-widgets' have run.
const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const TARGET_NAME = 'ExpoWidgetsTarget';
const STRINGS_FILE = 'Localizable.strings';

function stringsLiteral(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

function stringsFileContent(translations) {
  return `${Object.entries(translations)
    .map(([english, translated]) => `"${stringsLiteral(english)}" = "${stringsLiteral(translated)}";`)
    .join('\n')}\n`;
}

// pbxproj quotes a region such as "pt-BR".
function pbxValue(value) {
  return /^[A-Za-z0-9_.]+$/.test(value) ? value : `"${value}"`;
}

function unquote(value) {
  return typeof value === 'string' ? value.replace(/^"(.*)"$/, '$1') : value;
}

function variantGroupIn(project, group) {
  const variants = project.hash.project.objects.PBXVariantGroup ?? {};
  const child = group.children.find(({ value, comment }) => comment === STRINGS_FILE && variants[value]);
  return child ? { key: child.value, variant: variants[child.value] } : null;
}

function addVariantGroup(project, groupKey) {
  const variants = section(project, 'PBXVariantGroup');
  const key = project.generateUuid();
  variants[key] = {
    isa: 'PBXVariantGroup',
    children: [],
    name: STRINGS_FILE,
    sourceTree: '"<group>"',
  };
  variants[`${key}_comment`] = STRINGS_FILE;
  project.getPBXGroupByKey(groupKey).children.push({ value: key, comment: STRINGS_FILE });
  return { key, variant: variants[key] };
}

function section(project, name) {
  const objects = project.hash.project.objects;
  objects[name] = objects[name] ?? {};
  return objects[name];
}

function addLanguageFile(project, variant, language) {
  const references = section(project, 'PBXFileReference');
  const filePath = `${language}.lproj/${STRINGS_FILE}`;
  const known = variant.children.some(({ value }) => unquote(references[value]?.path) === filePath);
  if (known) return;
  const key = project.generateUuid();
  references[key] = {
    isa: 'PBXFileReference',
    lastKnownFileType: 'text.plist.strings',
    name: pbxValue(language),
    path: pbxValue(filePath),
    sourceTree: '"<group>"',
  };
  references[`${key}_comment`] = language;
  variant.children.push({ value: key, comment: language });
}

function resourcesPhaseOf(project, targetKey) {
  const target = project.pbxNativeTargetSection()[targetKey];
  const phases = project.hash.project.objects.PBXResourcesBuildPhase ?? {};
  const listed = target.buildPhases.find(({ value }) => phases[value]);
  if (listed) return phases[listed.value];
  project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', targetKey);
  return project.hash.project.objects.PBXResourcesBuildPhase[target.buildPhases.at(-1).value];
}

function linkToTarget(project, targetKey, variantKey) {
  const phase = resourcesPhaseOf(project, targetKey);
  const buildFiles = section(project, 'PBXBuildFile');
  if (phase.files.some(({ value }) => buildFiles[value]?.fileRef === variantKey)) return;
  const key = project.generateUuid();
  buildFiles[key] = { isa: 'PBXBuildFile', fileRef: variantKey, fileRef_comment: STRINGS_FILE };
  buildFiles[`${key}_comment`] = `${STRINGS_FILE} in Resources`;
  phase.files.push({ value: key, comment: `${STRINGS_FILE} in Resources` });
}

function addKnownRegions(project, languages) {
  const { firstProject } = project.getFirstProject();
  const regions = firstProject.knownRegions ?? [];
  for (const language of languages) {
    const value = pbxValue(language);
    if (!regions.includes(value) && !regions.includes(language)) regions.push(value);
  }
  firstProject.knownRegions = regions;
}

/**
 * English as a language of its own, each text standing for itself: without en.lproj an
 * iPhone set to English then French would take the French names, iOS choosing among the
 * extension's .lproj folders before it falls back to the development language.
 */
function withEnglish(translations) {
  const english = Object.fromEntries(Object.values(translations).flatMap(Object.keys).map((text) => [text, text]));
  return { en: english, ...translations };
}

/**
 * Writes `<language>.lproj/Localizable.strings` in the extension's folder and adds them to
 * the extension target as one localized resource. Without the extension (Lucid), nothing.
 */
function applyWidgetGalleryStrings(project, { iosRoot, translations: given }) {
  const targetKey = project.findTargetKey(TARGET_NAME);
  const groupKey = project.findPBXGroupKey({ name: TARGET_NAME });
  if (!targetKey || !groupKey) return project;
  const translations = withEnglish(given);
  const languages = Object.keys(translations).sort();
  for (const language of languages) {
    const directory = path.join(iosRoot, TARGET_NAME, `${language}.lproj`);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, STRINGS_FILE), stringsFileContent(translations[language]));
  }
  const group = project.getPBXGroupByKey(groupKey);
  const { key, variant } = variantGroupIn(project, group) ?? addVariantGroup(project, groupKey);
  for (const language of languages) addLanguageFile(project, variant, language);
  linkToTarget(project, targetKey, key);
  addKnownRegions(project, languages);
  return project;
}

const withWidgetGalleryStrings = (config, translations = {}) =>
  withXcodeProject(config, (nextConfig) => {
    nextConfig.modResults = applyWidgetGalleryStrings(nextConfig.modResults, {
      iosRoot: nextConfig.modRequest.platformProjectRoot,
      translations,
    });
    return nextConfig;
  });

module.exports = withWidgetGalleryStrings;
module.exports.applyWidgetGalleryStrings = applyWidgetGalleryStrings;
module.exports.stringsFileContent = stringsFileContent;
