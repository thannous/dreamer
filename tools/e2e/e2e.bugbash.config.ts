import type { E2EConfig } from 'e2e';
import { chatgpt } from 'e2e/oauth/chatgpt';
import base from './e2e.config';
import { PERSONA_ACT_MODEL } from './persona-models.mjs';

const shared: E2EConfig = base;
const context = 'Noctalia Dreamer is running as a local mock. Stay on the loopback origin. Use a visible mock profile when a journey needs an account. Do not buy, subscribe, create a real account, or call a production service. Seeded copy and mock prices are fixtures, not bugs.';
const persona = {
  model: chatgpt(PERSONA_ACT_MODEL),
  maxSteps: 40,
  maxModelCalls: 40,
  context,
};

// Explore-only config. Repro tests stay under tests/bugbash and are selected
// with E2E_BUGBASH=1 on the main config. This file does not widen the PR gate.
export default {
  ...shared,
  tests: ['tests/bugbash.setup.e2e.ts', 'tests/bugbash/**/*.e2e.ts'],
  agents: {
    default: persona,
    skeptic: { ...persona, system: 'Distrust every number, price, and label. Compare each with the rest of the screen. Do not purchase.' },
    fuzzer: { ...persona, system: 'At every text field, try an empty value and a very long value before the happy path. Do not purchase.' },
  },
} satisfies E2EConfig;
