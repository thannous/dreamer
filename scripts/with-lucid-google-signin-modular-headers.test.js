'use strict';

const fs = require('node:fs');
const path = require('node:path');
const appConfigSource = fs.readFileSync(
  path.join(__dirname, '../app.config.ts'),
  'utf8'
);
const appConfig = require('../app.json');
const {
  applyLucidGoogleSignInModularHeaders,
} = require('../plugins/withLucidGoogleSignInModularHeaders');

const BASE_PODFILE = `
platform :ios, podfile_properties['ios.deploymentTarget'] || '16.4'

target 'NoctaliaLucidTrainer' do
  use_expo_modules!

  config = use_native_modules!(config_command)

  use_react_native!(
    :path => config[:reactNativePath],
  )
end
`;

describe('withLucidGoogleSignInModularHeaders', () => {
  it('is registered on every Lucid iOS companion build', () => {
    const lucidPluginBlock = appConfigSource.match(
      /plugins:\s*\[[\s\S]*?withLucidNoctaliaQueries[\s\S]*?\],\s*extra:/
    )?.[0];

    expect(lucidPluginBlock).toContain(
      "./plugins/withLucidGoogleSignInModularHeaders"
    );
    expect(lucidPluginBlock).not.toMatch(
      /lucidGooglePlugins\.length\s*>\s*0[\s\S]*withLucidGoogleSignInModularHeaders/
    );
    expect(appConfig.expo.plugins).not.toEqual(
      expect.arrayContaining(['./plugins/withLucidGoogleSignInModularHeaders'])
    );
  });

  it('keeps the Google Sign-In Expo plugin conditional on both OAuth client IDs', () => {
    expect(appConfigSource).toContain('function resolveLucidGooglePlugin');
    expect(appConfigSource).toMatch(
      /if \(!webClientId \|\| !iosClientId\) return \[\];/
    );
    expect(appConfigSource).toContain("'@react-native-google-signin/google-signin'");
    expect(appConfigSource).toContain('...lucidGooglePlugins,');
  });

  it('enables modular headers for the AppCheckCore Objective-C pods', () => {
    const output = applyLucidGoogleSignInModularHeaders(BASE_PODFILE);

    expect(output).toContain("pod 'GoogleUtilities', :modular_headers => true");
    expect(output).toContain("pod 'RecaptchaInterop', :modular_headers => true");
    expect(output).not.toContain('use_modular_headers!');
    expect(output.indexOf('use_expo_modules!')).toBeLessThan(
      output.indexOf("pod 'GoogleUtilities'")
    );
  });

  it('keeps the existing target body', () => {
    const output = applyLucidGoogleSignInModularHeaders(BASE_PODFILE);

    expect(output).toContain('use_native_modules!(config_command)');
    expect(output).toContain('use_react_native!');
    expect(output).toContain("target 'NoctaliaLucidTrainer' do");
  });

  it('is idempotent across repeated Expo prebuilds', () => {
    const once = applyLucidGoogleSignInModularHeaders(BASE_PODFILE);
    const twice = applyLucidGoogleSignInModularHeaders(once);

    expect(twice).toBe(once);
    expect(twice.match(/pod 'GoogleUtilities', :modular_headers => true/g)).toHaveLength(1);
    expect(twice.match(/pod 'RecaptchaInterop', :modular_headers => true/g)).toHaveLength(1);
  });

  it('fills in only the missing targeted pod', () => {
    const partial = BASE_PODFILE.replace(
      'use_expo_modules!',
      "use_expo_modules!\n  pod 'GoogleUtilities', :modular_headers => true"
    );
    const output = applyLucidGoogleSignInModularHeaders(partial);

    expect(output.match(/pod 'GoogleUtilities', :modular_headers => true/g)).toHaveLength(1);
    expect(output).toContain("pod 'RecaptchaInterop', :modular_headers => true");
  });

  it('fails loudly when the Expo Podfile target cannot be found', () => {
    expect(() => applyLucidGoogleSignInModularHeaders('platform :ios, \'16.4\'')).toThrow(
      /Unable to locate use_expo_modules!/
    );
  });
});
