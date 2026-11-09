// Closed product/agent/profile mapping: extending coverage must never let a
// Dreamer test, foreign model or production profile qualify as another product.
export const personaContracts = {
  dreamer: { agents: ['morning', 'archivist', 'explorer', 'guest', 'free'], profile: 'mock-persistent' },
  lucid: { agents: ['beginner', 'journal'], profile: 'lucid-mock' },
  meditation: { agents: ['listener', 'breather'], profile: 'meditation-local' },
};

export function personaIdentity(target, platform) {
  const product = target?.slice(0, -(platform.length + 1));
  return personaContracts[product] && target === `${product}-${platform}` ? product : null;
}
