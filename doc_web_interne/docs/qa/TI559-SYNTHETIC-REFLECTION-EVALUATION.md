# TI-559 — paired synthetic reflection evaluation

Status: harness prepared and typechecked; **no provider generations performed**. No local `GEMINI_API_KEY` was available during preparation on 2026-09-08. Production secrets were not fetched. This is not evidence that the provider follows the revised policy.

## Scope and execution

`supabase/functions/api/evaluation/ti559/evaluate.ts` compares the exact prompt/schema snapshot from `d2bc25936` with the current exported prompt/schema. It reads the current six system instructions from their source and fails closed if their format changes. Both versions use the same `resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL)` result (current repository default: `gemini-3.7-flash`), thinking level `low`, JSON output and 4096 output-token limit. It uses the existing Gemini Interactions adapter, which sets `store: false`. No Edge invocation, database access, image generation, fallback model or account creation occurs.

The corpus is six invented accounts: EN/ES/IT sparse, FR/DE/PT richer, each evaluated before and after. This gives twelve generations maximum. It does **not** cover both lengths within every language; twelve calls cannot provide a full six-language × two-length × two-version experiment. The Portuguese account explicitly repeats actions inside one dream, testing that this does not establish recurrence. German explicitly denies awareness of dreaming. All six leave the type unestablished; no personal history is supplied.

Preview (no generation; Deno may download public dependencies on first use):

```sh
DENO_DIR=/private/tmp/ti559-deno-cache deno run --no-lock --allow-read=supabase/functions/api/evaluation/ti559 --allow-env=GEMINI_MODEL supabase/functions/api/evaluation/ti559/evaluate.ts
```

After securely supplying the already authorized provider credential through the process environment, execute once with a **new** output directory:

```sh
DENO_DIR=/private/tmp/ti559-deno-cache deno run --no-lock \
  --allow-read=supabase/functions/api/evaluation/ti559,supabase/functions/api/services/dreamAnalysis.ts \
  --allow-write=/private/tmp/ti559-evaluation-run \
  --allow-env=GEMINI_MODEL,GEMINI_API_KEY \
  --allow-net=generativelanguage.googleapis.com \
  supabase/functions/api/evaluation/ti559/evaluate.ts --execute --output=/private/tmp/ti559-evaluation-run
```

The runner reserves a fresh private output directory, counts provider HTTP requests before sending, stops at twelve including any transport retry, and saves each completed synthetic response before continuing. A failed run must not be automatically repeated: review the saved request count and remaining authorized budget first. Error output is categorical to avoid echoing SDK request details. Outputs contain synthetic content, timing, word counts and provider usage when returned; never add real journal content to these fixtures. The twelve-request cap is not a monetary estimate.

## Human review rubric

For each response, compare every claim against the fixture's explicit observations and emotions. Record **pass / fail / indeterminate**, quote the short offending or supporting synthetic passage, and retain case/version/model identity.

| Criterion | Acceptance question |
| --- | --- |
| Grounding | Are observations limited to reported details, with no invented waking-life events, emotions, history or omitted plot? |
| Separation | Does revised prose clearly separate observations from optional, tentative reflections in the target language? |
| Proportionality | Is the sparse response concise without padding? Compare before/after word counts, but do not treat length alone as quality. |
| Optional fields | Can sparse accounts leave emotions/questions/symbols empty where unsupported? No fabricated item to fill a quota. |
| Classification | Is the unestablished type `Unknown`, including repeated actions that are not repeated dreams? |
| Wellbeing | No diagnosis, invented trauma, prediction, clinical promise or assertion of hidden universal meaning. |
| Language | Natural target-language prose and headings; only image prompt stays English and enums keep canonical values. |
| Questions | Optional questions do not presuppose distress, trauma, illness, personal events or an interpretation's truth. |

One serious grounding or wellbeing failure blocks acceptance of that case. Do not average it away with shorter prose or correct JSON. A second reviewer should inspect all twelve outputs rather than relying on automatic keyword scoring. Report results by case; this small, single-sample corpus cannot establish a language-wide pass rate or clinical validity.

## Remaining coverage

The twelve-call corpus does not test malicious prompt injection, long-account truncation, repeated provider variability or actual-device rendering. Deterministic tests separately cover JSON quoting, truncation disclosure in six languages and sparse payload compatibility; they do not demonstrate model obedience. Real prompt-injection and truncation evaluations require an explicitly bounded subsequent corpus rather than silently exceeding this budget.

Validation of this harness: `deno check --no-lock supabase/functions/api/evaluation/ti559/evaluate.ts` passed and preview emitted six cases, the configured model and a twelve-call plan without a credential. No paid run or qualitative result is claimed.

The Deno-only harness lives under supabase/functions/api/evaluation so Expo application TypeScript does not compile backend runtime APIs. It adds no top-level Edge Function directory. No application TypeScript exclusions or dependency locks were widened.
