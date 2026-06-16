// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
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
      '**/*.spec.{js,jsx,ts,tsx}',
    ],
    rules: {
      'expo/no-dynamic-env-var': 'off',
      // Tests intentionally use require() for module isolation and Jest resetModules flows.
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
]);
