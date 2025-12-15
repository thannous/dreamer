import path from 'node:path';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      'react-native': path.resolve(__dirname, 'tests/react-native-stub.ts'),
      '@expo/vector-icons': path.resolve(__dirname, 'tests/expo-vector-icons-stub.ts'),
    },
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['**/hooks/**/*.test.ts?(x)', 'happy-dom'],
    ],
    setupFiles: ['vitest.setup.ts'],
    exclude: ['node_modules', '.expo', 'expo', 'dist', '.eas-local-work'],
  },
});
