# Gemini 3.8 migration candidate and paired evaluation

Latest chat update: [provenance and minimal qualification](TI559-CHAT-OPTIMIZATION-2026-09-09.md). Chat now selects minimal on Lite3.5; analysis remains low. The measurements below are historical low-vs-low model comparison.

Date: 9 September 2026. Decision: **candidate prepared, no production activation or quality acceptance**. Based on PR #157 (4a38afd27); changing models does not resolve its remaining fidelity reservations.

## Changes and boundaries

- Dream analysis default becomes gemini-3.8-flash in this draft branch.
- Owner selection after the comparison: chat defaults to gemini-3.5-flash-lite, analysis to gemini-3.8-flash. Low thinking and store:false remain explicit. This selection does not establish chat quality or time-to-first-token measurements. Existing stateless adapter discards thinking steps; exact history/signature preservation remains a separate qualification issue on the selected model.
- Every text request explicitly selects low thinking when omitted; minimal normalizes to low. store:false remains enforced, no previous_interaction_id, no provider-side conversation persistence introduced.
- Lite fallback, image models and categorisation remain unchanged. Existing valid environment overrides remain honored: analysis GEMINI_MODEL / GEMINI_FALLBACK_MODEL; chat GEMINI_CHAT_MODEL then GEMINI_LITE_MODEL, fallback GEMINI_LITE_MODEL. Production override values were not inspected or modified. A source default change cannot establish the deployed model.

## Real comparison

The owner approved the proposed migration and comparison. Existing Dreamweaver credential was retrieved only in memory. Model metadata confirmed models/gemini-3.8-flash, followed by **12 requests and 12 valid JSON responses**, process exit0. No private journal data submitted.

Six unchanged followup fixtures, three short/three rich, EN/FR/ES/DE/IT/PT. Both models receive identical analysis-2026-09-09.1 prompt, policy, localized system instructions and JSON schema, low thinking, max4096 output tokens. Each side uses its model as both primary and fallback (no fallback generation). Three pairs in each order; one sample per model/case.

`npm run reflection:eval:models:check` validates types and launcher; `reflection:eval:models:preview` does not generate; `reflection:eval:models:run` performs this fixed experiment. The original and followup receipts are untouched. New output directory /private/tmp/ti559-gemini38-evaluation-run is retained: mkdir rejects repeats. All transport requests consume the durable twelve-request cap. Launcher passes only PATH/HOME/GEMINI_MODEL/GEMINI_API_KEY; model comparison fixes model IDs regardless of GEMINI_MODEL.

## Observations

All six classifications correct on each model. ES diagnostic and PT injection cases do not produce a diagnosis, trauma or recurrence on either model. IT memory remains partial with no invented spatial relation in observations/quote. This does not establish universal safety or a statistical advantage.

Localized 3.8 reservations: EN question assumes physical shaking subsided and emotion insight adds continuity; FR quote puts the envelope in hand while awaiting the train, although the narrative gives it later; DE adds “Kurz darauf” and states waking was caused by the alarm, neither explicitly established. The optional symbolic suggestions are distinct from factual observations. Image prompts are artistic compositions, not factual reconstructions. No clear fidelity advantage established over3.7.

| Measured quantity, six samples each | 3.7 | 3.8 |
| --- | ---: | ---: |
| Median call duration, milliseconds | 2563 | 2587 |
| Reported input tokens | 6980 | 6980 |
| Reported output tokens | 2553 | 2736 |
| Separately reported thought tokens | 396 | 0 |

These are provider usage fields, not a billing receipt. Output tokens increase about7.2%; thought tokens are separately shown and must not be ignored in cost comparisons. Tiny sequential corpus does not establish production latency or price savings. Long-input truncation, native UX and actual chat continuation on3.8 were not tested. No further provider calls made.

## Validation and evidence

21 Deno Gemini/image tests pass, chat route and evaluation typechecks pass, four launcher tests pass, preview and diff --check pass. Deno needed an existing dependency installation and writable cache; no tracked lock changes. Independent reviewer inspected harness before execution and final code/results after execution.

- [Results](ti559-gemini38-evaluation-2026-09-09/results.json), SHA256 02deb408f0346cef0a577a743941f008a0dbb1b69bac584eced48f6f1f39407d.
- [Request receipt](ti559-gemini38-evaluation-2026-09-09/request-count.json), SHA256 a159e54a72bbc5b35475dc6e71b69800bd21496b91b66743ae8e42cde6ca7e6d.

## Official references

- [Gemini3.8 specs](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash): stable, structured outputs, low/medium/high, minimal unsupported.
- [Migration guide](https://ai.google.dev/gemini-api/docs/latest-model): no obsolete sampling parameters; default medium and possible increased token use.
- [Stateless history](https://ai.google.dev/gemini-api/docs/interactions/text-generation): store:false and replay generated steps/signatures. Existing code does not yet preserve them exactly.

Next acceptance work: address remaining factual/chronology additions, implement and qualify lossless stateless chat-history handling with legacy-history compatibility, then review actual deployment overrides and activation separately. Do not merge or deploy this draft solely because its API smoke and contract tests passed.
