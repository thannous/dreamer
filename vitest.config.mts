import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['**/hooks/**/*.test.ts?(x)', 'happy-dom'],
    ],
    setupFiles: ['vitest.setup.ts'],
    exclude: ['node_modules', '.expo', 'expo', 'dist', '.eas-local-work'],
  },
});
