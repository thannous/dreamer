/**
 * Model ids for Dreamer personas. e2e 0.21.3 `chatgpt(id)` forwards `id` to the
 * saved ChatGPT login and does not embed a catalog (`e2e models openai` lists
 * what that login serves). These two strings are the OpenAI ids: Terra drives
 * `agent.act`, Sol judges `agent.assert` / `waitFor` / `extract`.
 * Revert by setting both constants back to `gpt-6.1-sol`.
 * `E2E_PERSONA_MODEL` or `E2E_PERSONA_ACT_MODEL` overrides act.
 * `E2E_PERSONA_JUDGE_MODEL` overrides the judge.
 */
export const PERSONA_ACT_MODEL = 'gpt-6.1-terra';
export const PERSONA_ASSERT_MODEL = 'gpt-6.1-sol';
