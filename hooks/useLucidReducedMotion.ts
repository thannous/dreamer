import { useOptionalLucidTrainer } from '@/context/LucidTrainerContext';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';

/**
 * Lucid motion is reduced when either the Trainer preference or the system
 * setting asks for it. The optional Trainer context keeps shared UI usable
 * outside the provider (isolated tests, marketing previews).
 */
export function useLucidReducedMotion(): boolean {
  const trainerReduceMotion =
    useOptionalLucidTrainer()?.state?.onboarding.accessibility.reduceMotion ?? false;
  const systemReduceMotion = usePrefersReducedMotion();
  return trainerReduceMotion || systemReduceMotion;
}
