import type { E2EConfig } from 'e2e';
import { chatgpt } from 'e2e/oauth/chatgpt';
import { PERSONA_ACT_MODEL, PERSONA_ASSERT_MODEL } from './persona-models.mjs';

const roles = {
  lucid: {
    beginner: 'You are a beginner trying a gentle lucid-dream practice. Protect sleep; do not enable wake-up schedules or advanced techniques. Find the practice, try it and keep control of pausing.',
    journal: 'You want to find a saved dream in your local journal. Preserve its exact text and never delete or rewrite it.',
  },
  meditation: {
    listener: 'You want a calming session that you can save and find again. This app is local-first; no account is needed.',
    breather: 'You are new to breathing exercises. Find a gentle exercise and stay in control of starting, pausing and leaving it.',
  },
} as const;

export function createCompanionPersonaAgents(product: keyof typeof roles, act = PERSONA_ACT_MODEL, judge = PERSONA_ASSERT_MODEL): NonNullable<E2EConfig['agents']> {
  const model = chatgpt(act);
  return Object.fromEntries(Object.entries(roles[product]).map(([name, system]) => [name, {
    model, judge: judge === act ? model : chatgpt(judge),
    context: `You are using Noctalia ${product}. Read the actual interface language and visible labels.`,
    system: `${system} Use visible controls only. Copy current node IDs exactly. Do not guess routes, create accounts, buy anything, delete data, or change device settings. Report an obstacle instead of claiming success.`,
    maxSteps: 16, maxModelCalls: 12, maxInputTokens: 32_000,
  }]));
}
