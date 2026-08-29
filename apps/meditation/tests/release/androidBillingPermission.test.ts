import path from 'node:path';

import { getPrebuildConfigAsync } from '@expo/prebuild-config';
import { compileModsAsync } from '@expo/config-plugins';

const BILLING_PERMISSION = 'com.android.vending.BILLING';
const PROJECT_ROOT = path.resolve(__dirname, '../..');

type AndroidManifestPermission = {
  $?: { 'android:name'?: string };
};

type IntrospectedConfig = {
  android?: { permissions?: string[] };
  _internal?: {
    modResults?: {
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
});
