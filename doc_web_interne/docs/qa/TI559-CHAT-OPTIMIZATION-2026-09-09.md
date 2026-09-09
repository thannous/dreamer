# Chat provenance, concision and minimal-thinking qualification

## Implemented decision

Lite3.5 chat now selects minimal; other primary overrides retain low and Flash3.8 analysis remains low. The shared adapter permits explicit minimal only for exact gemini-3.5-flash-lite; other models normalize it to low. The provider accepted all six minimal requests, resolving the earlier compatibility uncertainty for this environment/model. store:false unchanged. No production configuration, merge or deployment performed.

New shared chatContext helper supplies2–4short sentences by default, one optional question, explicit language, no repeated analysis, distinction between unreported/unfelt emotion, original dream, user associations, corrections and quoted text. It preserves20recent messages plus older verbatim user-only notes drawn from the last20user messages. Notes have chronology/role and fit8000serialized characters including metadata/disclosure. No generated summary, no older assistant hypothesis promoted to user evidence. Recent history and original dream remain separate. Guest history remains bounded by existing input rules; no permissions/DB changes. This does not repair full thought-signature persistence or retain unlimited history.

## Real paired replay

12requests/12completed streams. Six checkpoints1/5/10/15/19/20 from original20exchange run at bbcfd7283, with identical historical inputs and corrected prompt for low/minimal. Opposite order across pairs. Baseline assistant replies were replayed, not replaced by generated optimized replies, so this is **not a new optimized20exchange conversation**. Original baseline and other experiment receipts untouched. Provider credential in memory only; exclusively invented content.

| Checkpoint | low first text ms | minimal first text ms |
| --- | ---: | ---: |
| 1 | 802 | 740 |
| 5 | 2444 | 997 |
| 10 | 2961 | 692 |
| 15 | 2034 | 1000 |
| 19 | 2710 | 742 |
| 20 | 3208 | 751 |
| Median | 2577 | 746.5 |

Six-call totals: identical9787input tokens; low417answer+2638thought tokens; minimal253answer+0thought tokens. Zero thinking tokens is observed here, not guaranteed generally. About71% lower first-text median on this small sample. At standard0.30USD/M input and2.50USD/M output+thought, indicative costs0.01057USD(low) vs0.00357USD(minimal), about66% lower; not verified billing nor production savings. SDK timing excludes route/auth/DB/mobile/rendering; no meaningful productionp95.

## Independent acceptance

Independent Astra read code and all12responses and reran23tests on final product tree. Minimal6/6checkpoint answers are French, concise and faithful to requested content; checkpoint19 correctly recalls grandmother instead of denying initial association,20 keeps original blue vs later blue-grey and does not promote SYSTEM quotation. Its brief20summary omits the paint detail, not a material contradiction. Low20still puts the quotation under associations and omits original blue. Dedicated diagnostic/injection questions16/17 were not regenerated; they appear only in replayed history, so do not claim new standalone safety qualification.

23Deno tests (7context,13adapter,3route),6Node launcher tests, probes typecheck/preview and diff check pass. Route tests cover existing admission/replay behavior; full live HTTP/DB/Android validation remains open. Historical probes now import the unchanged localized preamble/20message constant instead of a route regex, preserving their old policy wording while optimized probe uses buildChatSystem.

## Evidence and reproducibility

[Inputs](ti559-chat-optimization-2026-09-09/inputs.json), [results](ti559-chat-optimization-2026-09-09/results.json), [receipt](ti559-chat-optimization-2026-09-09/request-count.json) byte-identical to saved experiment. Inputs record full synthetic contents/system/model/output ceiling percheckpoint. No key or thought signatures included.

`npm run reflection:chat:optimization:preview` is generation-free. `reflection:chat:optimization:run` has fixed input/output, sanitized4key environment, no shell, allowlisted network and12HTTP cap with durable reservation. Existing /private/tmp/ti559-chat-optimization-run prevents rerun. Minimal400would skip remaining minimal attempts; none occurred. No fallback or automatic rerun.
