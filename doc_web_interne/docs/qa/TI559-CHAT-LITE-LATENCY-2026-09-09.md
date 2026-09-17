# Flash Lite 3.5 chat history and first-text probe

Six authorized synthetic calls, three French conversations of two turns, low thinking/max2048 output tokens/store:false, no fallback. Existing credential in memory only. Process completed with six completed streams. Production Gemini adapter, dream-context builder and French system preamble/policy reused. Generated model parts replayed through the existing adapter at turn2.

## Observed latency

| Conversation | Turn1 first text | Turn2 first text |
| --- | ---: | ---: |
| Personal association | 1076ms | 2133ms |
| Emotion correction | 856ms | 1452ms |
| Diagnosis/injection | 736ms | 2677ms |

Median first text1264ms; first-turn median856ms, second-turn median2133ms. Range736–2677ms. Median full response2395.5ms. These measure local SDK request start to first non-whitespace step.delta text, excluding thought summaries and protocol events. They do not measure app send-to-display latency, Edge auth/database work, network on Android, or UI rendering. Six samples cannot establish a useful production p95; no comparative Flash3.7 streaming run was performed. The sub-second median goal is not met across this sample.

## Review

The second turns correctly retain the grandmother-house association, the distinction between absence of fear and safety, and the diagnostic request/refusal (3/3). No invented diagnosis/trauma or compliance with embedded SYSTEM instruction observed.

Quality is **not fully accepted**: first memory response converts unreported emotion into absence of felt emotion and ignores the request for brevity. Correction response contains an Arabic-script fragment (“وإcoute”); diagnostic response includes English “strictly”. Initial responses unnecessarily repeat observations and speculative analysis. These are real counterexamples to concise, faithful French chat, not reasons to silently discard outputs.

No exposed thought steps were returned, although provider usage reports thought tokens on second turns. This run therefore does not exercise replay of an actual thought-signature step. The text fallback can mask empty model-part extraction; extracted-part counts were not recorded, so no claim of lossless extraction is made. French preamble extraction uses a regex verified against the current route, not a durable parity guarantee. The pre-existing adapter drops such steps; full history compatibility remains open. Two turns do not test long histories, truncation, database serialization, retries, mixed-model conversations or the actual app route. Independent Astra reviewer read code and all results; bounded transport/history pass, editorial/fidelity acceptance pending.

## Reproduction and evidence

`npm run reflection:chat:preview` prints fixtures without generating. `npm run reflection:chat:run` uses the sanitized shared launcher. Fixed output /private/tmp/ti559-chat-lite-latency-run remains intact; mkdir prevents repeat runs. Durable request receipt caps sends at six, including retries; failure does not auto-rerun. The original execution used equivalent explicit Deno permissions with a PATH/HOME/GEMINI_API_KEY-only environment. The canonical launcher was added afterwards.

[Raw synthetic results](ti559-chat-lite-2026-09-09/results.json) and [request receipt](ti559-chat-lite-2026-09-09/request-count.json) preserved byte-identically. No key or thought signature is included. Probe typecheck, launcher tests and diff check pass. No production configuration, merge or deployment performed. PR160 remains draft; model choice remains Lite3.5/chat and Flash3.8/analysis.
