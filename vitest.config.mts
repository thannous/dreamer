import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: [
        path.resolve(__dirname, 'tsconfig.json'),
        path.resolve(__dirname, 'tsconfig.test.json'),
      ],
    }),
  ],
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: path.resolve(__dirname, 'tests/react-native-stub.ts') },
      { find: /^react-native-reanimated$/, replacement: path.resolve(__dirname, 'tests/react-native-reanimated-stub.ts') },
      { find: /^@react-native-masked-view\/masked-view$/, replacement: path.resolve(__dirname, 'tests/masked-view-stub.ts') },
      { find: /^expo-blur$/, replacement: path.resolve(__dirname, 'tests/expo-blur-stub.ts') },
      { find: /^@expo\/vector-icons\/.+$/, replacement: path.resolve(__dirname, 'tests/expo-vector-icons-subpath-stub.ts') },
      { find: /^@expo\/vector-icons$/, replacement: path.resolve(__dirname, 'tests/expo-vector-icons-stub.ts') },
      { find: /^expo-linear-gradient$/, replacement: path.resolve(__dirname, 'tests/expo-linear-gradient-stub.ts') },
    ],
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['**/hooks/**/*.test.ts?(x)', 'happy-dom'],
    ],
    setupFiles: ['vitest.setup.ts'],
    exclude: ['node_modules', '.expo', 'expo', 'dist', '.eas-local-work'],
    server: {
      deps: {
        inline: ['react-native'],
      },
    },
  },
});
