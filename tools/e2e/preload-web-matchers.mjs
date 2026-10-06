import { createRequire } from 'node:module';

// Load the pinned matcher library before e2e's TypeScript collection hooks.
// This leaves app transpilation unchanged and registers no model or test runner.
createRequire(new URL('./package.json', import.meta.url))('playwright/test');
