// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const { REANIMATED_STUBBED_EXPORTS } = require('./scripts/metro-native-stubs');

// Native bundles resolve these modules to empty stubs or a shim
// (scripts/metro-native-stubs.js), so a value import would be undefined at
// runtime. Remove the stub before adopting one of them.
const stubbedImportPaths = [
  {
    name: 'react-native-reanimated',
    importNames: REANIMATED_STUBBED_EXPORTS,
    message: 'Metro stubs this Reanimated preset on native (scripts/metro-native-stubs.js); use FadeIn/FadeOut, LinearTransition or a keyframe.',
  },
  {
    name: '@supabase/supabase-js',
    importNames: [
      'REALTIME_CHANNEL_STATES',
      'REALTIME_LISTEN_TYPES',
      'REALTIME_POSTGRES_CHANGES_LISTEN_EVENT',
      'REALTIME_PRESENCE_LISTEN_EVENTS',
      'REALTIME_SUBSCRIBE_STATES',
      'RealtimeChannel',
      'RealtimeClient',
      'RealtimePresence',
      'WebSocketFactory',
    ],
    message: 'Supabase Realtime is shimmed out of native bundles (scripts/metro-native-stubs.js).',
  },
  {
    name: 'react-native-enriched-markdown',
    importNames: ['EnrichedMarkdownTextInput'],
    message: 'Metro stubs the Markdown editor on native (scripts/metro-native-stubs.js).',
  },
  {
    name: '@supabase/realtime-js',
    message: 'Supabase Realtime is shimmed out of native bundles (scripts/metro-native-stubs.js).',
  },
];
const testFiles = [
  '**/__tests__/**/*.{js,jsx,ts,tsx}',
  '**/*.test.{js,jsx,ts,tsx}',
  '**/*.posix-native.ts',
  '**/*.spec.{js,jsx,ts,tsx}',
  'tests/**',
];

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', 'scripts/archive/**'],
  },
  {
    rules: {
      // SDK 56 promotes React Compiler diagnostics to lint errors. This app already
      // enables React Compiler; remaining diagnostics are migration/optimization
      // follow-ups, and the compiler safely skips components it cannot optimize.
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      // TypeScript (and Deno for Edge Functions) already checks namespace
      // members. Keep the import rule for JavaScript, which has no such check.
      // https://typescript-eslint.io/troubleshooting/typed-linting/performance/#eslint-plugin-import
      'import/namespace': 'off',
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    ignores: testFiles,
    rules: {
      'no-restricted-imports': ['error', { paths: stubbedImportPaths }],
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    ignores: testFiles,
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        { paths: stubbedImportPaths.map((entry) => ({ ...entry, allowTypeImports: true })) },
      ],
    },
  },
  {
    files: ['scripts/**/*.{js,cjs,mjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        __filename: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      'no-redeclare': ['warn', { builtinGlobals: false }],
    },
  },
  {
    files: ['supabase/functions/**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        Deno: 'readonly',
      },
    },
    rules: {
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['lib/auth.ts', 'services/supabaseDreamService.ts'],
    rules: {
      // These runtime bridges intentionally require optional native/mock modules
      // after environment detection so web, native, and Jest bundles stay loadable.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: [
      '**/__tests__/**/*.{js,jsx,ts,tsx}',
      '**/*.test.{js,jsx,ts,tsx}',
      '**/*.posix-native.ts',
      '**/*.spec.{js,jsx,ts,tsx}',
    ],
    languageOptions: {
      globals: {
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        describe: 'readonly',
        expect: 'readonly',
        fdescribe: 'readonly',
        fit: 'readonly',
        it: 'readonly',
        jest: 'readonly',
        pit: 'readonly',
        test: 'readonly',
        xdescribe: 'readonly',
        xit: 'readonly',
        xtest: 'readonly',
      },
    },
    rules: {
      'expo/no-dynamic-env-var': 'off',
      // Tests intentionally use require() for module isolation and Jest resetModules flows.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
