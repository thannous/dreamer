export const LUCID_DREAM_SIGN_DECISIONS = ['pending', 'confirmed', 'rejected'] as const;
export type LucidDreamSignDecision = (typeof LUCID_DREAM_SIGN_DECISIONS)[number];

export interface LucidDreamSignDecisionRecord {
  id: string;
  decision: LucidDreamSignDecision;
  customLabel?: string | null;
}
