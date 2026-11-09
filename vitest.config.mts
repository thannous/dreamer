import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: [
      // Both app and test tsconfigs use this single alias. Vite resolves it
      // directly, without tsconfck's obsolete TypeScript 5 peer dependency.
      { find: /^@\//, replacement: `${path.resolve(import.meta.dirname)}/` },
      { find: /^react-native$/, replacement: path.resolve(import.meta.dirname, 'tests/react-native-stub.ts') },
      { find: /^react-native-reanimated$/, replacement: path.resolve(import.meta.dirname, 'tests/react-native-reanimated-stub.ts') },
      { find: /^@react-native-masked-view\/masked-view$/, replacement: path.resolve(import.meta.dirname, 'tests/masked-view-stub.ts') },
      { find: /^expo-blur$/, replacement: path.resolve(import.meta.dirname, 'tests/expo-blur-stub.ts') },
      { find: /^@expo\/vector-icons\/createIconSet$/, replacement: path.resolve(import.meta.dirname, 'tests/expo-vector-icons-create-icon-set-stub.ts') },
      { find: /^@expo\/vector-icons\/.+$/, replacement: path.resolve(import.meta.dirname, 'tests/expo-vector-icons-subpath-stub.ts') },
      { find: /^@expo\/vector-icons$/, replacement: path.resolve(import.meta.dirname, 'tests/expo-vector-icons-stub.ts') },
      { find: /^expo-linear-gradient$/, replacement: path.resolve(import.meta.dirname, 'tests/expo-linear-gradient-stub.ts') },
    ],
  },
  test: {
    environment: 'happy-dom',
    include: ['**/*.perf.test.ts', '**/*.perf.test.tsx'],
    setupFiles: ['vitest.setup.ts'],
    exclude: ['**/node_modules/**', '.claude/**', '.expo/**', 'expo/**', 'dist/**', '.eas-local-work/**'],
    server: {
      deps: {
        inline: ['react-native', 'uniwind'],
      },
    },
  },
});
