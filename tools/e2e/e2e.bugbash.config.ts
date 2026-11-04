import type { E2EConfig } from 'e2e';
import { chatgpt } from 'e2e/oauth/chatgpt';
import base from './e2e.config';
import { PERSONA_ACT_MODEL } from './persona-models.mjs';

const shared: E2EConfig = base;
// Facts every model call reads (in explore, the explorer and the planner): what is
// fixture, and the explorer's blind spots, worded so a real bug is still reported.
const context = 'Noctalia Dreamer is running as a local mock. Seeded copy and mock prices are fixtures, not bugs. '
  + 'Not bugs by themselves: the Journal and its filtered lists are virtualized, so scroll through the whole list before reporting an entry as missing or a filter as wrong; '
  + 'dream cards and their art lazy-load, so scroll and wait before calling one blank; accessible text splits around inline links, so judge copy by the rendered screen when a screenshot is available.';
// How every explorer acts; only the act loop reads `system`.
const rules = 'Stay on the loopback origin. Use a visible mock profile when a journey needs an account. Do not buy, subscribe, create a real account, or call a production service.';
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
    default: { ...persona, system: rules },
    skeptic: { ...persona, system: `${rules}\nDistrust every number, price, and label. Compare each with the rest of the screen.` },
    fuzzer: { ...persona, system: `${rules}\nAt every text field, try an empty value and a very long value before the happy path.` },
  },
} satisfies E2EConfig;
