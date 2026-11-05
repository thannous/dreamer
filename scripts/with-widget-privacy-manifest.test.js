'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const plist = require('plist');
const xcode = require('xcode');

const { applyWidgetPrivacyManifest } = require('../plugins/withWidgetPrivacyManifest');

// The app and the widget extension as expo-widgets leaves them. Apple's privacy report on
// the uploaded archive is the only other place this file shows, after the upload.
const PROJECT = `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 54;
	objects = {

/* Begin PBXGroup section */
		AA0000000000000000000001 = {
			isa = PBXGroup;
			children = (
				AA0000000000000000000002 /* ExpoWidgetsTarget */,
			);
			sourceTree = "<group>";
		};
		AA0000000000000000000002 /* ExpoWidgetsTarget */ = {
			isa = PBXGroup;
			children = (
			);
			name = ExpoWidgetsTarget;
			path = ExpoWidgetsTarget;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		AA0000000000000000000003 /* Noctalia */ = {
			isa = PBXNativeTarget;
			buildPhases = (
				AA0000000000000000000005 /* Resources */,
			);
			name = Noctalia;
			productType = "com.apple.product-type.application";
		};
		AA0000000000000000000004 /* ExpoWidgetsTarget */ = {
			isa = PBXNativeTarget;
			buildPhases = (
			);
			name = ExpoWidgetsTarget;
			productType = "com.apple.product-type.app-extension";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		AA0000000000000000000006 /* Project object */ = {
			isa = PBXProject;
			mainGroup = AA0000000000000000000001;
			targets = (
				AA0000000000000000000003 /* Noctalia */,
				AA0000000000000000000004 /* ExpoWidgetsTarget */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		AA0000000000000000000005 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */
	};
	rootObject = AA0000000000000000000006 /* Project object */;
}
`;

function setUp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-privacy-manifest-'));
  const iosRoot = path.join(root, 'ios');
  fs.mkdirSync(path.join(iosRoot, 'ExpoWidgetsTarget'), { recursive: true });
  const pbxPath = path.join(root, 'project.pbxproj');
  fs.writeFileSync(pbxPath, PROJECT);
  const project = xcode.project(pbxPath);
  project.parseSync();
  return { root, iosRoot, project, pbxPath };
}

describe('withWidgetPrivacyManifest', () => {
  let made;
  afterEach(() => {
    if (made) fs.rmSync(made.root, { recursive: true, force: true });
    made = null;
  });

  it('declares the App Group defaults the extension reads, and no tracking', () => {
    made = setUp();
    applyWidgetPrivacyManifest(made.project, made.iosRoot);

    const manifest = plist.parse(fs.readFileSync(path.join(made.iosRoot, 'ExpoWidgetsTarget/PrivacyInfo.xcprivacy'), 'utf8'));
    expect(manifest).toEqual({
      NSPrivacyAccessedAPITypes: [{
        NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults',
        NSPrivacyAccessedAPITypeReasons: ['1C8F.1'],
      }],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyTracking: false,
    });
  });

  it('bundles it with the extension only', () => {
    made = setUp();
    applyWidgetPrivacyManifest(made.project, made.iosRoot);
    fs.writeFileSync(made.pbxPath, made.project.writeSync());
    const project = xcode.project(made.pbxPath);
    project.parseSync();
    const objects = project.hash.project.objects;

    const [fileRef] = objects.PBXGroup.AA0000000000000000000002.children.map(({ value }) => value);
    expect(objects.PBXFileReference[fileRef]).toEqual(expect.objectContaining({ path: 'PrivacyInfo.xcprivacy' }));
    const extensionPhases = objects.PBXNativeTarget.AA0000000000000000000004.buildPhases;
    expect(extensionPhases).toHaveLength(1);
    const resources = objects.PBXResourcesBuildPhase[extensionPhases[0].value];
    expect(resources.files.map(({ value }) => objects.PBXBuildFile[value].fileRef)).toEqual([fileRef]);
    // The app keeps its own manifest from app.json's ios.privacyManifests.
    expect(objects.PBXResourcesBuildPhase.AA0000000000000000000005.files).toEqual([]);
  });

  it('adds nothing twice when prebuild runs again on the same project', () => {
    made = setUp();
    applyWidgetPrivacyManifest(made.project, made.iosRoot);
    const once = made.project.writeSync();
    applyWidgetPrivacyManifest(made.project, made.iosRoot);

    expect(made.project.writeSync()).toBe(once);
  });

  it('leaves a project without the widget extension alone', () => {
    made = setUp();
    made.project.hash.project.objects.PBXNativeTarget.AA0000000000000000000004.name = 'Other';
    const before = made.project.writeSync();

    applyWidgetPrivacyManifest(made.project, made.iosRoot);

    expect(made.project.writeSync()).toBe(before);
    expect(fs.existsSync(path.join(made.iosRoot, 'ExpoWidgetsTarget/PrivacyInfo.xcprivacy'))).toBe(false);
  });
});
