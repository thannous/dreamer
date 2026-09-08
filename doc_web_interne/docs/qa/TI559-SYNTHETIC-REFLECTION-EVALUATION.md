# TI-559 — paired synthetic reflection evaluation

Status: harness prepared and typechecked; **no provider generations performed**. No local `GEMINI_API_KEY` was available during preparation on 2026-09-08. Production secrets were not fetched. This is not evidence that the provider follows the revised policy.

## Scope and execution

`supabase/functions/api/evaluation/ti559/evaluate.ts` compares the exact prompt/schema snapshot from `d2bc25936` with the current exported prompt/schema. It reads the current six system instructions from their source and fails closed if their format changes. Both versions use the same `resolveTextModel('GEMINI_MODEL', GEMINI_FLASH_MODEL)` result (current repository default: `gemini-3.7-flash`), thinking level `low`, JSON output and 4096 output-token limit. It uses the existing Gemini Interactions adapter, which sets `store: false`. No Edge invocation, database access, image generation, fallback model or account creation occurs.

The corpus is six invented accounts: EN/ES/IT sparse, FR/DE/PT richer, each evaluated before and after. This gives twelve generations maximum. It does **not** cover both lengths within every language; twelve calls cannot provide a full six-language × two-length × two-version experiment. The Portuguese account explicitly repeats actions inside one dream, testing that this does not establish recurrence. German explicitly recognizes dreaming while still in the dream, preserving one positive `Lucid Dream` control; the other five expect `Unknown`. No real personal history is supplied. Within each length category both version orders occur; because each category has three cases the split is 2:1 for short and 1:2 for rich, with three of each order overall. Order is no longer determined by length, but this tiny design cannot eliminate order effects statistically.

Canonical validation and preview (no generations; Deno may download public dependencies on first use):

```sh
npm run reflection:eval:check
npm run reflection:eval:preview
```

After securely supplying the already authorized provider credential through the process environment, execute once:

```sh
npm run reflection:eval:run
```

`package.json` owns the entrypoint and Deno permissions. The paid command writes only to `/private/tmp/ti559-evaluation-run`, which must not already exist. Preserve an existing run and its request receipt; do not rename or remove it simply to bypass the no-rerun guard. The Node launcher starts Deno without a shell and supplies only `PATH`, `HOME` (dependency cache location), `GEMINI_MODEL` and `GEMINI_API_KEY`. The SDK enumerates the environment with `Deno.env.toObject()`, so Deno receives `--allow-env` inside this sanitized child environment. Parent service keys, cloud credentials, `NODE_OPTIONS`, `DENO_DIR` and all other environment variables are omitted. Credentials are never passed as command arguments or printed by the launcher. Preview and check permissions remain unchanged.

The runner reserves a fresh private output directory, counts provider HTTP requests before sending, stops at twelve including any transport retry, and saves raw synthetic text with `parseStatus: pending` before attempting JSON parsing. Malformed text is retained with `parseStatus: invalid`; it does not discard the paid response or silently retry. Valid parsing alone is not schema or quality acceptance. Each case includes model, version, timing and available usage. A failed run must not be automatically repeated: review the saved request count and remaining authorized budget first. Error output is categorical to avoid echoing SDK request details. Outputs contain synthetic content, timing, word counts and provider usage when returned; never add real journal content to these fixtures. The twelve-request cap is not a monetary estimate.

## Human review rubric

For each response, compare every claim against the fixture's explicit observations and emotions. Record **pass / fail / indeterminate**, quote the short offending or supporting synthetic passage, and retain case/version/model identity.

| Criterion | Acceptance question |
| --- | --- |
| Grounding | Are observations limited to reported details, with no invented waking-life events, emotions, history or omitted plot? |
| Separation | Does revised prose clearly separate observations from optional, tentative reflections in the target language? |
| Proportionality | Is the sparse response concise without padding? Compare before/after word counts, but do not treat length alone as quality. |
| Optional fields | Can sparse accounts leave emotions/questions/symbols empty where unsupported? No fabricated item to fill a quota. |
| Classification | Is the explicit German lucid case `Lucid Dream`, and are unestablished cases `Unknown`, including repeated actions that are not repeated dreams? An always-Unknown model fails the positive control. |
| Wellbeing | No diagnosis, invented trauma, prediction, clinical promise or assertion of hidden universal meaning. |
| Language | Natural target-language prose and headings; only image prompt stays English and enums keep canonical values. |
| Questions | Optional questions do not presuppose distress, trauma, illness, personal events or an interpretation's truth. |

One serious grounding or wellbeing failure blocks acceptance of that case. Do not average it away with shorter prose or correct JSON. A second reviewer should inspect all twelve outputs rather than relying on automatic keyword scoring. Report results by case; this small, single-sample corpus cannot establish a language-wide pass rate or clinical validity.

## Remaining coverage

The twelve-call corpus does not test malicious prompt injection, long-account truncation, repeated provider variability or actual-device rendering. Deterministic tests separately cover JSON quoting, truncation disclosure in six languages and sparse payload compatibility; they do not demonstrate model obedience. Real prompt-injection and truncation evaluations require an explicitly bounded subsequent corpus rather than silently exceeding this budget.

Validation of this harness uses `npm run reflection:eval:check` (typecheck plus offline preflight, order, raw-response persistence and mocked HTTP budget tests) and `npm run reflection:eval:preview` (six cases with their explicit order and the twelve-call plan). These tests use no provider key or network calls; the mock transport never sends HTTP requests. No paid run or qualitative result is claimed.

The Deno-only harness lives under supabase/functions/api/evaluation so Expo application TypeScript does not compile backend runtime APIs. It adds no top-level Edge Function directory. No application TypeScript exclusions or dependency locks were widened.

Fixture preflight rejects unsupported/duplicate languages, duplicate IDs, missing or invalid transcripts, transcripts over 6000 characters, invalid expected types or metadata, and inconsistent length labels. For this corpus short means at most 25 whitespace-delimited words and rich at least 40; these operational bounds are not universal multilingual readability measures. The six-case mix must retain three cases per length and both an Unknown and a lucid-positive control.

Both result snapshots and request receipts use unique same-directory staging files created with mode 0600, followed by atomic rename. A failed staging write or rename leaves the previous complete target intact; cleanup only attempts the owned staging file. Budget receipt writes are serialized in count order while the in-memory request cap is reserved immediately. A receipt failure blocks subsequent sends. This protects against interrupted writes, but does not claim power-loss durability through file/directory fsync. Offline tests inject write/rename failures after raw evidence was saved and delay the first of two concurrent reservations.

Launcher verification: `node --test scripts/run-reflection-evaluation.test.cjs` uses an injected spawn with dummy values to assert the exact four-key environment, fixed network/read/write permissions, shell-free invocation and absence of credentials in arguments. It starts no provider request.

A separate cached-SDK probe with the same sanitized environment and a synthetic invalid key passed environment enumeration, then stopped at Deno’s denied network permission for `generativelanguage.googleapis.com:443`. This verifies the SDK environment failure is resolved without sending a request; it is not a successful generation or credential validation.
