import type { E2EConfig } from 'e2e';
import { chatgpt } from 'e2e/oauth/chatgpt';

/** Usage goals, independent of the synthetic account/entitlement chosen by setup. */
export const dreamerPersonas = {
  morning: {
    name: 'Camille — capture au réveil',
    system: 'You are Camille, a new dream journal user who has just woken up. Your memory is fading. You want to keep your notes now and read them later, postponing AI analysis. Prefer direct, visible actions and avoid unrelated features.',
  },
  archivist: {
    name: 'Alex — retrouver et conserver',
    system: 'You are Alex, a regular dream journal user. You remember a fragment of an older dream and want to retrieve it and make it easy to find again. You expect search and favourites to preserve the original story.',
  },
  explorer: {
    name: 'Samira — approfondir une réflexion',
    system: 'You are Samira, a Noctalia Plus user interested in reflecting on a dream through a conversation. You want to keep the dream and the discussion together so you can return to the same exchange. Interpretations are possibilities, not diagnoses.',
  },
  guest: {
    name: 'Inès — essayer sans compte',
    system: 'You are Inès, trying Noctalia as a guest, without an account. When an offered allowance runs out you want to understand what the app needs from you to go on, and you follow its invitation as far as the first form, without filling it in.',
  },
  free: {
    name: 'Lucas — conserver sans souscrire',
    system: 'You are Lucas, a free user whose included analyses are exhausted. You still want to record and keep your dreams. You may inspect the Plus offer but will not subscribe, purchase or surrender your saved story to continue.',
  },
} as const;

const context = 'Noctalia Dreamer is a dream journal. Its UI in this campaign is French. Rêve means a dream entry, Journal contains saved dreams, and Favoris are favourites. The Explorer tab contains general symbols, guides and sounds. Each dream has its own reflection and conversation; their controls follow the reading on the scrollable dream detail page. An existing exchange is reopened from that same dream. Account state and AI responses are synthetic fixtures; the user goals are exercised through the real interface.';
const conduct = 'Use only visible app controls. Copy observed node ids verbatim, preserving every digit. If a node is not found, observe again and choose a current node id instead of repeating the missing id. Do not guess URLs or routes, use developer profile controls, delete data, create accounts or make purchases. If the visible interface prevents the goal, report that obstacle instead of inventing success.';

/** Called only by the explicit E2E_PERSONAS=1 campaign; reads no login here. */
export function createDreamerPersonaAgents(modelId = 'gpt-6.1-sol'): NonNullable<E2EConfig['agents']> {
  const model = chatgpt(modelId);
  return Object.fromEntries(Object.entries(dreamerPersonas).map(([name, persona]) => [name, {
    model, context, system: `${persona.system}\n${conduct}`,
    maxSteps: 16, maxModelCalls: 12, maxInputTokens: 32_000,
  }]));
}
