# Symbol-link bench

Measures how well dream analyses link the same element across two dreams, and keep
different elements apart, by comparing two analysis prompts in the same run:

- `baseline`: a frozen copy of master's `buildAnalysisPrompt` before the link rules of
  `analysis-2026-10-18.poetic6` (`baseline-prompt.ts`).
- `candidate`: the current `buildAnalysisPrompt`.

The run refuses to start when the two prompts differ anywhere but the link-fields line.
After a later prompt change, refresh `baseline-prompt.ts` from master before reusing it.

`cases.ts` holds 20 synthetic pairs of short accounts (15 French, 5 English), written
for this bench, never journal content. For each run, case and variant, dream A is
analyzed without known symbols; its stored reading gives the known symbols
(`collectKnownDreamSymbols`, as the analysis worker does) and dream B is analyzed with
them. Each call is production's: `requestClaudeJson` with `analysisSystemInstruction`,
the response schema with the legacy four themes, and `CLAUDE_MODELS.analysis`
(`claude-haiku-5-5`, effort `medium`). No retries.

Targets, links and dictionary ids are read from the stored readings (deduplicated, at most
six symbols), as the dreamer would get them. Duplicates, symbols without a link and key
lengths are read from the answers, each symbol normalized as production stores one, so
the prompt's own rules stay visible (`scoring.ts`). Same and return elements are the
dreamer's own (no dictionary symbol is that thing): only a shared personal key links them.

| Metric | Meaning |
| --- | --- |
| Link recall (same, return) | B has a symbol with the personal key of A's target |
| Joined through the dictionary only (same, return) | B shares only a dictionary id with A's target, folding the dreamer's own element into a generic symbol |
| Omission (same, return, trap) | B neither names the target nor carries its link |
| False links (trap) | Of the pairs where B names its target, those where B has a symbol with the link of A's target, which is a different thing |
| Dictionary precision | Of the symbols that name the target, those that resolve to the expected dictionary id |
| Duplicates per reading | Symbols whose link already appeared in the same reading |
| Mean key length | Words in each personal key |
| Known name kept | B symbols reusing a known key that also keep its name |
| Tokens and cost | Haiku 5.5 list price: 0.10 / 0.50 USD per million input / output tokens |

Link, omission and false-link rates leave out pairs whose A reading did not name the
target; the summary counts them.

## Preview (no network, no key)

```sh
mise exec -- deno run --config=supabase/functions/deno.json --frozen \
  supabase/functions/api/evaluation/symbol-links/evaluate.ts --dry-run
```

It prints the plan, the call count and both prompts' symbols paragraph for one case.

## Run

From the repository root on the owner's Mac, with the key in `.env.eval.local`
(ignored by Git, one unquoted `ANTHROPIC_API_KEY=` line). Only that variable is read;
results go to a new directory outside the repository:

```sh
OUT="$HOME/noctalia-evals/symbol-links-$(date +%Y%m%d-%H%M%S)"
ANTHROPIC_API_KEY="$(sed -n 's/^ANTHROPIC_API_KEY=//p' .env.eval.local | head -n 1)" \
mise exec -- deno run --config=supabase/functions/deno.json --frozen \
  --allow-net=api.anthropic.com --allow-env=ANTHROPIC_API_KEY --ignore-env \
  --allow-read="$OUT" --allow-write="$OUT" \
  supabase/functions/api/evaluation/symbol-links/evaluate.ts --output="$OUT"
```

- `--ignore-env` makes every other variable read as unset. The Anthropic SDK also looks
  up `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_LOG`, `ANTHROPIC_CUSTOM_HEADERS` and
  `ANTHROPIC_WEBHOOK_SIGNING_KEY`; a stray shell value of these cannot reach a request.
- `--config` and `--frozen` resolve the SDK through `supabase/functions/deno.lock`, as the
  Edge Functions do.
- `--runs=N` (default 2, at most 10) repeats every pair. `--output` must not exist yet.

The default run makes 160 calls (2 runs x 20 cases x 2 variants x 2 dreams), four pairs
at a time, in 7 to 10 minutes. At roughly 3,100 input and 3,100 output tokens per call
(thinking included, as a production analysis measured), it costs about 0.30 USD. A hard
cap stops any call beyond the planned count. With 12 same, 8 return and 12 trap pairs per
variant, a gap of one or two pairs is noise.

`$OUT` receives `results.json` (every call: raw response, symbols as answered and as
stored, the known symbols sent with B, usage and timing; saved after each pair) and
`summary.md` (metrics per variant and per case). Keep both out of Git. The run exits
with code 1 when a call failed or returned an unusable answer.

There is deliberately no npm script: `package.json` scripts feed the app's runtime
fingerprint.
