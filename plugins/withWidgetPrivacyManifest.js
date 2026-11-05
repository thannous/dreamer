// Gives the widget extension its own privacy manifest. Apple reads the .appex apart from the
// app (ITMS-91053), and the extension reads the App Group's UserDefaults through expo-widgets'
// storage (WidgetsStorage.swift), a required-reason API: 1C8F.1 is the App Group reason.
// app.json's ios.privacyManifests only reaches the app target.
//
// Listed before expo-widgets in app.json: a plugin's mods run after those of the plugins
// listed after it, and the extension target only exists once expo-widgets' have run.
const fs = require('node:fs');
const path = require('node:path');
const { withXcodeProject } = require('expo/config-plugins');

const { resourcesPhaseOf } = require('./withWidgetGalleryStrings');

const TARGET_NAME = 'ExpoWidgetsTarget';
const FILE_NAME = 'PrivacyInfo.xcprivacy';

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>NSPrivacyAccessedAPITypes</key>
	<array>
		<dict>
			<key>NSPrivacyAccessedAPIType</key>
			<string>NSPrivacyAccessedAPICategoryUserDefaults</string>
			<key>NSPrivacyAccessedAPITypeReasons</key>
			<array>
				<string>1C8F.1</string>
			</array>
		</dict>
	</array>
	<key>NSPrivacyCollectedDataTypes</key>
	<array/>
	<key>NSPrivacyTracking</key>
	<false/>
</dict>
</plist>
`;

/**
 * Writes the manifest in the extension's folder and adds it to the extension target's
 * resources, once. Without the extension (Lucid), nothing.
 */
function applyWidgetPrivacyManifest(project, iosRoot) {
  const targetKey = project.findTargetKey(TARGET_NAME);
  const groupKey = project.findPBXGroupKey({ name: TARGET_NAME });
  if (!targetKey || !groupKey) return project;
  fs.writeFileSync(path.join(iosRoot, TARGET_NAME, FILE_NAME), MANIFEST);
  const group = project.getPBXGroupByKey(groupKey);
  if (group.children.some(({ comment }) => comment === FILE_NAME)) return project;

  const objects = project.hash.project.objects;
  objects.PBXFileReference = objects.PBXFileReference ?? {};
  objects.PBXBuildFile = objects.PBXBuildFile ?? {};
  const fileRef = project.generateUuid();
  objects.PBXFileReference[fileRef] = {
    isa: 'PBXFileReference',
    lastKnownFileType: 'text.xml',
    path: FILE_NAME,
    sourceTree: '"<group>"',
  };
  objects.PBXFileReference[`${fileRef}_comment`] = FILE_NAME;
  group.children.push({ value: fileRef, comment: FILE_NAME });

  const phase = resourcesPhaseOf(project, targetKey);
  const buildFile = project.generateUuid();
  objects.PBXBuildFile[buildFile] = { isa: 'PBXBuildFile', fileRef, fileRef_comment: FILE_NAME };
  objects.PBXBuildFile[`${buildFile}_comment`] = `${FILE_NAME} in Resources`;
  phase.files.push({ value: buildFile, comment: `${FILE_NAME} in Resources` });
  return project;
}

const withWidgetPrivacyManifest = (config) =>
  withXcodeProject(config, (nextConfig) => {
    nextConfig.modResults = applyWidgetPrivacyManifest(
      nextConfig.modResults,
      nextConfig.modRequest.platformProjectRoot,
    );
    return nextConfig;
  });

module.exports = withWidgetPrivacyManifest;
module.exports.applyWidgetPrivacyManifest = applyWidgetPrivacyManifest;
module.exports.MANIFEST = MANIFEST;
