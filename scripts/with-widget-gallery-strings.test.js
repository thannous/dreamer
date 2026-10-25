'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const xcode = require('xcode');

const { applyWidgetGalleryStrings, stringsFileContent } = require('../plugins/withWidgetGalleryStrings');

// The app and the widget extension as expo-widgets leaves them, before any translation.
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
			developmentRegion = en;
			knownRegions = (
				en,
				Base,
				fr,
				"pt-BR",
			);
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

const TRANSLATIONS = {
  fr: { 'Tell my dream': 'Raconter mon rêve', 'Your latest dream\'s painting.': 'La peinture de ton "dernier" rêve.' },
  pt: { 'Tell my dream': 'Contar meu sonho', 'Your latest dream\'s painting.': 'A pintura do seu último sonho.' },
};

function setUp() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'widget-gallery-strings-'));
  const iosRoot = path.join(root, 'ios');
  fs.mkdirSync(path.join(iosRoot, 'ExpoWidgetsTarget'), { recursive: true });
  const pbxPath = path.join(root, 'project.pbxproj');
  fs.writeFileSync(pbxPath, PROJECT);
  const project = xcode.project(pbxPath);
  project.parseSync();
  return { root, iosRoot, project, pbxPath };
}

function reparse({ project, pbxPath }) {
  fs.writeFileSync(pbxPath, project.writeSync());
  const written = xcode.project(pbxPath);
  written.parseSync();
  return written;
}

describe('withWidgetGalleryStrings', () => {
  let made;
  afterEach(() => {
    if (made) fs.rmSync(made.root, { recursive: true, force: true });
    made = null;
  });

  it('writes one strings file per language in the extension folder', () => {
    made = setUp();
    applyWidgetGalleryStrings(made.project, { iosRoot: made.iosRoot, translations: TRANSLATIONS });

    const french = fs.readFileSync(path.join(made.iosRoot, 'ExpoWidgetsTarget/fr.lproj/Localizable.strings'), 'utf8');
    expect(french).toBe(stringsFileContent(TRANSLATIONS.fr));
    expect(french).toContain('"Tell my dream" = "Raconter mon rêve";');
    expect(french).toContain('"Your latest dream\'s painting." = "La peinture de ton \\"dernier\\" rêve.";');
    expect(fs.existsSync(path.join(made.iosRoot, 'ExpoWidgetsTarget/pt.lproj/Localizable.strings'))).toBe(true);
  });

  it('gives English its own strings, so an English iPhone keeps the English names', () => {
    made = setUp();
    applyWidgetGalleryStrings(made.project, { iosRoot: made.iosRoot, translations: TRANSLATIONS });

    expect(fs.readFileSync(path.join(made.iosRoot, 'ExpoWidgetsTarget/en.lproj/Localizable.strings'), 'utf8')).toBe(
      stringsFileContent({ 'Tell my dream': 'Tell my dream', 'Your latest dream\'s painting.': 'Your latest dream\'s painting.' }),
    );
  });

  it('adds them to the extension only, as one localized resource', () => {
    made = setUp();
    applyWidgetGalleryStrings(made.project, { iosRoot: made.iosRoot, translations: TRANSLATIONS });
    const project = reparse(made);
    const objects = project.hash.project.objects;

    const variants = Object.entries(objects.PBXVariantGroup).filter(([key]) => !key.endsWith('_comment'));
    expect(variants).toHaveLength(1);
    const [variantKey, variant] = variants[0];
    const references = variant.children.map(({ value }) => objects.PBXFileReference[value]);
    expect(references.map(({ name, path: filePath }) => [name, filePath.replace(/"/g, '')])).toEqual([
      ['en', 'en.lproj/Localizable.strings'],
      ['fr', 'fr.lproj/Localizable.strings'],
      ['pt', 'pt.lproj/Localizable.strings'],
    ]);
    expect(objects.PBXGroup.AA0000000000000000000002.children.map(({ value }) => value)).toEqual([variantKey]);

    const extensionPhases = objects.PBXNativeTarget.AA0000000000000000000004.buildPhases;
    expect(extensionPhases).toHaveLength(1);
    const resources = objects.PBXResourcesBuildPhase[extensionPhases[0].value];
    expect(resources.files.map(({ value }) => objects.PBXBuildFile[value].fileRef)).toEqual([variantKey]);
    // The app's own resources, where its Siri strings go, are left as they were.
    expect(objects.PBXResourcesBuildPhase.AA0000000000000000000005.files).toEqual([]);

    const { firstProject } = project.getFirstProject();
    expect(firstProject.knownRegions).toEqual(['en', 'Base', 'fr', '"pt-BR"', 'pt']);
  });

  it('adds nothing twice when prebuild runs again on the same project', () => {
    made = setUp();
    applyWidgetGalleryStrings(made.project, { iosRoot: made.iosRoot, translations: TRANSLATIONS });
    const once = made.project.writeSync();
    applyWidgetGalleryStrings(made.project, { iosRoot: made.iosRoot, translations: TRANSLATIONS });

    expect(made.project.writeSync()).toBe(once);
  });

  it('leaves a project without the widget extension alone', () => {
    made = setUp();
    const project = made.project;
    project.hash.project.objects.PBXNativeTarget.AA0000000000000000000004.name = 'Other';
    const before = project.writeSync();

    applyWidgetGalleryStrings(project, { iosRoot: made.iosRoot, translations: TRANSLATIONS });

    expect(project.writeSync()).toBe(before);
    expect(fs.existsSync(path.join(made.iosRoot, 'ExpoWidgetsTarget/fr.lproj'))).toBe(false);
  });
});
