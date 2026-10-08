import path from 'node:path';

import { getPrebuildConfigAsync } from '@expo/prebuild-config';
import { compileModsAsync } from '@expo/config-plugins';

const BILLING_PERMISSION = 'com.android.vending.BILLING';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

type AndroidManifestPermission = {
  $?: { 'android:name'?: string; 'tools:node'?: string };
};

type IntrospectedConfig = {
  android?: { permissions?: string[] };
  _internal?: {
    modResults?: {
      ios?: { infoPlist?: Record<string, unknown> };
      android?: {
        manifest?: {
          manifest?: {
            'uses-permission'?: AndroidManifestPermission[];
          };
        };
      };
    };
  };
};

describe('Android Play Billing permission', () => {
  it('survives Expo config introspection into the generated Android manifest', async () => {
    const { exp } = await getPrebuildConfigAsync(PROJECT_ROOT, { platforms: ['android'] });
    const compiled = (await compileModsAsync(exp, {
      projectRoot: PROJECT_ROOT,
      introspect: true,
      platforms: ['android'],
      assertMissingModProviders: false,
    })) as IntrospectedConfig;

    const declared = compiled.android?.permissions ?? [];
    const generated =
      compiled._internal?.modResults?.android?.manifest?.manifest?.['uses-permission']?.map(
        (permission) => permission.$?.['android:name']
      ) ?? [];

    expect(declared).toEqual(expect.arrayContaining([BILLING_PERMISSION]));
    expect(generated).toEqual(expect.arrayContaining([BILLING_PERMISSION]));
  }, 30_000);

  // App Review rejects purpose strings for hardware the app never uses.
  it('keeps camera and microphone out of the release manifests', async () => {
    const ios = await introspect('ios');
    const infoPlist = ios._internal?.modResults?.ios?.infoPlist ?? {};
    expect(infoPlist).not.toHaveProperty('NSCameraUsageDescription');
    expect(infoPlist).not.toHaveProperty('NSMicrophoneUsageDescription');
    expect(infoPlist.NSPhotoLibraryUsageDescription).toMatch(/profile picture/);

    const android = await introspect('android');
    const requested =
      android._internal?.modResults?.android?.manifest?.manifest?.['uses-permission']
        ?.filter((permission) => permission.$?.['tools:node'] !== 'remove')
        .map((permission) => permission.$?.['android:name']) ?? [];
    expect(requested).not.toContain('android.permission.CAMERA');
    expect(requested).not.toContain('android.permission.RECORD_AUDIO');
    expect(requested).not.toContain('android.permission.READ_EXTERNAL_STORAGE');
  }, 30_000);
});

async function introspect(platform: 'ios' | 'android'): Promise<IntrospectedConfig> {
  const { exp } = await getPrebuildConfigAsync(PROJECT_ROOT, { platforms: [platform] });
  return (await compileModsAsync(exp, {
    projectRoot: PROJECT_ROOT,
    introspect: true,
    platforms: [platform],
    assertMissingModProviders: false,
  })) as IntrospectedConfig;
}
