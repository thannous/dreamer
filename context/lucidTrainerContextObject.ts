import { createContext, useContext } from 'react';

// Type only: this module must not pull the provider, its storage and the whole
// Lucid domain into whoever only needs to know whether a provider is mounted.
import type { LucidTrainerContextValue } from '@/context/LucidTrainerContext';

/**
 * The Trainer's context object, kept apart from its provider. Shared
 * components (the auth sheet, Lucid's presentation primitives) are also
 * bundled into Dreamer, where they only ask "is there a Trainer here?":
 * importing the provider for that question shipped the Lucid domain,
 * content catalogs and sync code in the Dreamer bundle.
 */
export const LucidTrainerContext = createContext<LucidTrainerContextValue | null>(null);

/** Optional access for shared presentation components that also render outside the provider. */
export function useOptionalLucidTrainer(): LucidTrainerContextValue | null {
  return useContext(LucidTrainerContext);
}
