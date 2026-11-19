// The saved ChatGPT login supplies the persona action and judgment models.
export const PERSONA_ACT_MODEL = 'gpt-6.2-sol';
export const PERSONA_ASSERT_MODEL = 'gpt-6.2-sol';
export const PERSONA_PROVIDER = 'chatgpt.responses';
export const BUGBASH_MODEL = 'gpt-6.1-terra';

export function personaModels(env = process.env) {
  return {
    personaModel: env.E2E_PERSONA_MODEL?.trim() || env.E2E_PERSONA_ACT_MODEL?.trim() || PERSONA_ACT_MODEL,
    personaJudgeModel: env.E2E_PERSONA_JUDGE_MODEL?.trim() || PERSONA_ASSERT_MODEL,
  };
}

export function personaEnvironment(env = process.env) {
  const { personaModel, personaJudgeModel } = personaModels(env);
  return { E2E_PERSONAS: '1', E2E_PERSONA_MODEL: personaModel, E2E_PERSONA_JUDGE_MODEL: personaJudgeModel };
}
