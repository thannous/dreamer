export const PERSONA_ACT_MODEL: string;
export const PERSONA_ASSERT_MODEL: string;
export function personaModels(env?: Record<string, string | undefined>): { personaModel: string; personaJudgeModel: string };
export function personaEnvironment(env?: Record<string, string | undefined>): { E2E_PERSONAS: string; E2E_PERSONA_MODEL: string; E2E_PERSONA_JUDGE_MODEL: string };
