'use strict';
/* global describe, expect, it */

const fs = require('node:fs');
const path = require('node:path');

const {
  MATERIAL_SYMBOLS_FONT,
  MOCK_ONLY_FILES,
  REANIMATED_STUBBED_EXPORTS,
  REANIMATED_STUBBED_MODULES,
  RC_WEB_SDK,
  SHIMS,
  isRevenueCatWebStubDisabled,
  resolveBuildFlagStub,
  resolveNativeStub,
} = require('./metro-native-stubs');

const EMPTY = { type: 'empty' };
const ROOT = path.resolve(__dirname, '..');
const NM = path.join(ROOT, 'node_modules');
const from = (file) => ({ originModulePath: path.join(NM, file), dev: false });
const fromDev = (file) => ({ originModulePath: path.join(NM, file), dev: true });
const NATIVE = ['android', 'ios'];

describe('metro native stubs', () => {
  describe('RevenueCat web SDK', () => {
    it('stubs the web SDK on native when the flag is unset', () => {
      expect(resolveNativeStub(RC_WEB_SDK, 'android', {})).toEqual(EMPTY);
      expect(resolveNativeStub(RC_WEB_SDK, 'ios', {})).toEqual(EMPTY);
    });

    it('never stubs the web SDK on web', () => {
      expect(resolveNativeStub(RC_WEB_SDK, 'web', {})).toBeNull();
      expect(resolveNativeStub(RC_WEB_SDK, 'web', { NOCTALIA_DISABLE_RC_WEB_STUB: '1' })).toBeNull();
    });

    it('resolves the real SDK on native when NOCTALIA_DISABLE_RC_WEB_STUB=1', () => {
      const env = { NOCTALIA_DISABLE_RC_WEB_STUB: '1' };
      expect(isRevenueCatWebStubDisabled(env)).toBe(true);
      expect(resolveNativeStub(RC_WEB_SDK, 'android', env)).toBeNull();
      expect(resolveNativeStub(RC_WEB_SDK, 'ios', env)).toBeNull();
    });

    it('only accepts the exact value 1', () => {
      for (const value of ['', '0', 'true', 'yes']) {
        expect(resolveNativeStub(RC_WEB_SDK, 'android', { NOCTALIA_DISABLE_RC_WEB_STUB: value })).toEqual(EMPTY);
      }
    });

    it('keeps the stub on EAS build workers even if the flag leaks in', () => {
      const env = { NOCTALIA_DISABLE_RC_WEB_STUB: '1', EAS_BUILD: 'true' };
      expect(isRevenueCatWebStubDisabled(env)).toBe(false);
      expect(resolveNativeStub(RC_WEB_SDK, 'android', env)).toEqual(EMPTY);
    });
  });

  it('stubs the Material Symbols font on Android only, regardless of the flag', () => {
    const env = { NOCTALIA_DISABLE_RC_WEB_STUB: '1' };
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'android', {})).toEqual(EMPTY);
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'android', env)).toEqual(EMPTY);
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'ios', {})).toBeNull();
    expect(resolveNativeStub(MATERIAL_SYMBOLS_FONT, 'web', {})).toBeNull();
  });

  it('stubs expo-symbols on Android only when expo-router\'s optional loader asks', () => {
    const origin = from('expo-router/build/optional-libraries/expo-symbols.js');
    expect(resolveNativeStub('expo-symbols', 'android', {}, origin)).toEqual(EMPTY);
    expect(resolveNativeStub('expo-symbols', 'ios', {}, origin)).toBeNull();
    expect(resolveNativeStub('expo-symbols', 'web', {}, origin)).toBeNull();
    expect(resolveNativeStub('expo-symbols', 'android', {}, { originModulePath: path.join(ROOT, 'components/ui/icon-symbol.tsx') })).toBeNull();
  });

  it('stubs RevenueCat\'s browser module next to the web SDK, with the same opt-out', () => {
    const origin = from('react-native-purchases/dist/purchases.js');
    for (const platform of NATIVE) {
      expect(resolveNativeStub('./browser/nativeModule', platform, {}, origin)).toEqual(EMPTY);
    }
    expect(resolveNativeStub('./browser/nativeModule', 'web', {}, origin)).toBeNull();
    expect(resolveNativeStub('./browser/nativeModule', 'ios', { NOCTALIA_DISABLE_RC_WEB_STUB: '1' }, origin)).toBeNull();
    expect(resolveNativeStub('./browser/nativeModule', 'ios', {}, from('other/dist/purchases.js'))).toBeNull();
  });

  describe('Reanimated presets', () => {
    it('stubs the unused preset files on native only', () => {
      for (const [file, modules] of Object.entries(REANIMATED_STUBBED_MODULES)) {
        const origin = from(`react-native-reanimated/${file}`);
        for (const moduleName of modules) {
          for (const platform of NATIVE) {
            expect(resolveNativeStub(moduleName, platform, {}, origin)).toEqual(EMPTY);
          }
          expect(resolveNativeStub(moduleName, 'web', {}, origin)).toBeNull();
        }
      }
    });

    it('keeps Fade, LinearTransition and EntryExitTransition', () => {
      const animations = from('react-native-reanimated/src/layoutReanimation/defaultAnimations/index.ts');
      const transitions = from('react-native-reanimated/src/layoutReanimation/defaultTransitions/index.ts');
      expect(resolveNativeStub('./Fade', 'ios', {}, animations)).toBeNull();
      expect(resolveNativeStub('./utils', 'ios', {}, animations)).toBeNull();
      expect(resolveNativeStub('./LinearTransition', 'ios', {}, transitions)).toBeNull();
      expect(resolveNativeStub('./EntryExitTransition', 'ios', {}, transitions)).toBeNull();
    });

    it('lists exactly the exports of the stubbed files, which the ESLint ban uses', () => {
      const exported = new Set();
      for (const [file, modules] of Object.entries(REANIMATED_STUBBED_MODULES)) {
        for (const moduleName of modules) {
          const base = path.join(NM, 'react-native-reanimated', path.dirname(file), moduleName);
          const source = fs.existsSync(`${base}.ts`) ? fs.readFileSync(`${base}.ts`, 'utf8') : fs.readFileSync(path.join(base, 'index.ts'), 'utf8');
          for (const match of source.matchAll(/^export class (\w+)/gm)) exported.add(match[1]);
          for (const match of source.matchAll(/^export \{([^}]+)\}/gm)) {
            for (const name of match[1].split(',')) if (name.trim()) exported.add(name.trim());
          }
        }
      }
      expect([...exported].sort()).toEqual([...REANIMATED_STUBBED_EXPORTS].sort());
    });

    it('is not imported by app code', () => {
      const banned = new Set(REANIMATED_STUBBED_EXPORTS);
      const offenders = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== '__tests__') walk(full);
          } else if (/\.(t|j)sx?$/.test(entry.name) && !/\.test\./.test(entry.name)) {
            const source = fs.readFileSync(full, 'utf8');
            for (const match of source.matchAll(/import\s+(?:\w+\s*,\s*)?\{([^}]*)\}\s+from\s+'react-native-reanimated'/g)) {
              for (const name of match[1].split(',').map((part) => part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, ''))) {
                if (banned.has(name)) offenders.push(`${path.relative(ROOT, full)}: ${name}`);
              }
            }
          }
        }
      };
      for (const dir of ['app', 'components', 'context', 'hooks', 'lib', 'routes', 'services']) walk(path.join(ROOT, dir));
      expect(offenders).toEqual([]);
    });
  });

  it('shims Supabase Realtime and stubs iceberg-js on native only', () => {
    const supabase = from('@supabase/supabase-js/dist/index.mjs');
    const storage = from('@supabase/storage-js/dist/index.mjs');
    for (const platform of NATIVE) {
      expect(resolveNativeStub('@supabase/realtime-js', platform, {}, supabase)).toEqual({ type: 'sourceFile', filePath: SHIMS.supabaseRealtime });
      expect(resolveNativeStub('iceberg-js', platform, {}, storage)).toEqual(EMPTY);
    }
    expect(resolveNativeStub('@supabase/realtime-js', 'web', {}, supabase)).toBeNull();
    expect(resolveNativeStub('iceberg-js', 'web', {}, storage)).toBeNull();
    expect(resolveNativeStub('@supabase/realtime-js', 'ios', {}, { originModulePath: path.join(ROOT, 'lib/supabase.ts') })).toBeNull();
  });

  it('shims culori for Uniwind\'s native runtime and character-entities for micromark', () => {
    const uniwind = from('uniwind/src/core/native/native-utils.ts');
    const decoder = from('decode-named-character-reference/index.js');
    expect(resolveNativeStub('culori', 'ios', {}, uniwind)).toEqual({ type: 'sourceFile', filePath: SHIMS.culori });
    expect(resolveNativeStub('culori', 'web', {}, from('uniwind/src/core/web/webUtils.ts'))).toBeNull();
    expect(resolveNativeStub('culori', 'ios', {}, { originModulePath: path.join(ROOT, 'lib/colors.ts') })).toBeNull();
    expect(resolveNativeStub('character-entities', 'android', {}, decoder)).toEqual({ type: 'sourceFile', filePath: SHIMS.characterEntities });
    expect(resolveNativeStub('character-entities', 'web', {}, decoder)).toBeNull();
    for (const file of Object.values(SHIMS)) expect(fs.existsSync(file)).toBe(true);
  });

  it('only shims culori names that the shim exports', () => {
    const imported = new Set();
    const walk = (dir) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else for (const match of fs.readFileSync(full, 'utf8').matchAll(/import\s+\{([^}]*)\}\s+from\s+'culori'/g)) {
          for (const name of match[1].split(',')) if (name.trim()) imported.add(name.trim());
        }
      }
    };
    walk(path.join(NM, 'uniwind/src/core/native'));
    const shim = fs.readFileSync(SHIMS.culori, 'utf8');
    for (const name of imported) expect(shim).toMatch(new RegExp(`\\b${name}\\b`));
    expect([...imported].sort()).toEqual(['formatHex', 'formatHex8', 'interpolate', 'parse']);
    // Its relative imports bypass culori's exports map; they must still exist.
    for (const match of shim.matchAll(/from '([^']+)'/g)) {
      expect(fs.existsSync(path.resolve(path.dirname(SHIMS.culori), match[1]))).toBe(true);
    }
  });

  it('stubs the unused enriched-markdown editor on native only', () => {
    const origin = from('react-native-enriched-markdown/lib/module/index.js');
    expect(fs.existsSync(path.join(NM, 'react-native-enriched-markdown/lib/module/EnrichedMarkdownTextInput.js'))).toBe(true);
    expect(fs.readFileSync(origin.originModulePath, 'utf8')).toContain("from \"./EnrichedMarkdownTextInput.js\"");
    expect(resolveNativeStub('./EnrichedMarkdownTextInput.js', 'ios', {}, origin)).toEqual(EMPTY);
    expect(resolveNativeStub('./EnrichedMarkdownTextInput.js', 'web', {}, origin)).toBeNull();
    expect(resolveNativeStub('./native/EnrichedMarkdownText.js', 'ios', {}, origin)).toBeNull();
  });

  it('stubs dev-only tooling in release bundles and keeps it in development', () => {
    const cases = [
      ['../Libraries/Utilities/HMRClient', 'react-native/src/unstable-internals-do-not-use.js'],
      ['expo/devtools', 'expo-sqlite/build/SQLiteDevToolsClient.js'],
      ['react-native-reanimated/scripts/validate-worklets-version', 'react-native-reanimated/src/platform-specific/workletsVersion.ts'],
    ];
    for (const [moduleName, origin] of cases) {
      for (const platform of NATIVE) {
        expect(resolveNativeStub(moduleName, platform, {}, from(origin))).toEqual(EMPTY);
        expect(resolveNativeStub(moduleName, platform, {}, fromDev(origin))).toBeNull();
      }
      expect(resolveNativeStub(moduleName, 'web', {}, from(origin))).toBeNull();
    }
    expect(resolveNativeStub('../Libraries/Utilities/HMRClient', 'ios', {}, from('react-native/Libraries/Core/setUpBatchedBridge.js'))).toBeNull();
  });

  it('passes every other module through', () => {
    expect(resolveNativeStub('react-native-purchases', 'android', {})).toBeNull();
    expect(resolveNativeStub('@revenuecat/purchases-js', 'android', {})).toBeNull();
  });
});

describe('build-flag stubs', () => {
  const resolved = (file) => ({ type: 'sourceFile', filePath: path.join(ROOT, file) });
  const QA_SHIM = { type: 'sourceFile', filePath: SHIMS.qaLabsOff };
  const release = { dev: false };

  it('leaves the mock services out unless EXPO_PUBLIC_MOCK_MODE is true, read like lib/env.ts', () => {
    for (const file of MOCK_ONLY_FILES) {
      expect(fs.existsSync(path.join(ROOT, file))).toBe(true);
      for (const platform of [...NATIVE, 'web']) {
        expect(resolveBuildFlagStub(ROOT, resolved(file), platform, {}, release)).toEqual(EMPTY);
        expect(resolveBuildFlagStub(ROOT, resolved(file), platform, { EXPO_PUBLIC_MOCK_MODE: 'false' }, release)).toEqual(EMPTY);
        expect(resolveBuildFlagStub(ROOT, resolved(file), platform, { EXPO_PUBLIC_MOCK_MODE: 'true' }, release)).toBeNull();
        expect(resolveBuildFlagStub(ROOT, resolved(file), platform, { EXPO_PUBLIC_MOCK_MODE: 'TRUE' }, release)).toBeNull();
      }
    }
  });

  it('keeps the mocks that real builds still call', () => {
    for (const file of ['services/mocks/subscriptionServiceMock.ts', 'services/quota/MockQuotaEventStore.ts', 'services/storageService.ts']) {
      expect(resolveBuildFlagStub(ROOT, resolved(file), 'ios', {}, release)).toBeNull();
    }
    expect(resolveBuildFlagStub(ROOT, EMPTY, 'ios', {}, release)).toBeNull();
  });

  it('renders no subscription QA lab unless mock mode or the lab flag can show it', () => {
    const file = resolved('components/subscription/SubscriptionQALab.tsx');
    expect(resolveBuildFlagStub(ROOT, file, 'ios', {}, release)).toEqual(QA_SHIM);
    expect(resolveBuildFlagStub(ROOT, file, 'ios', { EXPO_PUBLIC_SUBSCRIPTION_QA_LAB: 'true' }, release)).toBeNull();
    expect(resolveBuildFlagStub(ROOT, file, 'ios', { EXPO_PUBLIC_MOCK_MODE: 'True' }, release)).toBeNull();
  });

  it('keeps the guest QA lab only in Android builds with its flag', () => {
    const file = resolved('components/guest/GuestProdQALab.tsx');
    expect(resolveBuildFlagStub(ROOT, file, 'android', {}, release)).toEqual(QA_SHIM);
    expect(resolveBuildFlagStub(ROOT, file, 'android', { EXPO_PUBLIC_GUEST_QA_LAB: 'true' }, release)).toBeNull();
    expect(resolveBuildFlagStub(ROOT, file, 'android', { EXPO_PUBLIC_GUEST_QA_LAB: 'TRUE' }, release)).toBeNull();
    expect(resolveBuildFlagStub(ROOT, file, 'ios', { EXPO_PUBLIC_GUEST_QA_LAB: 'true' }, release)).toEqual(QA_SHIM);
  });

  it('keeps the guest recording reset in development only', () => {
    const file = resolved('components/dev/GuestRecordingQaReset.tsx');
    expect(resolveBuildFlagStub(ROOT, file, 'ios', {}, release)).toEqual(QA_SHIM);
    expect(resolveBuildFlagStub(ROOT, file, 'ios', {}, { dev: true })).toBeNull();
  });

  it('exports every QA lab component the settings screen renders', () => {
    const settings = fs.readFileSync(path.join(ROOT, 'app/settings.tsx'), 'utf8');
    const shim = fs.readFileSync(SHIMS.qaLabsOff, 'utf8');
    for (const name of ['GuestProdQALab', 'GuestRecordingQaReset', 'SubscriptionQALab']) {
      expect(settings).toContain(`import { ${name} }`);
      expect(shim).toContain(`export const ${name} = () => null;`);
    }
  });
});
