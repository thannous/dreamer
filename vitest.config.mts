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
