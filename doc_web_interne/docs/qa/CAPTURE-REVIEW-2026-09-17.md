# Capture review — 17 September 2026

## Delivered behavior

- Capture asks at most three optional follow-ups, with early stop when no useful question remains. Answered questions in restored drafts count toward the limit. The separate post-save recall assistant retains its existing limit.
- “Valider mon récit” stops recognition, includes its final words, then requests one Flash-Lite formatting proposal. Questions provide context for short answers but are not evidence of dream events. No interpretation, invented details, forced coherence or removal of uncertainty is requested.
- An editable review precedes the explicit journal save. Original exchanges remain expandable. Returning to capture restores the source; formatting failure offers an unchanged save.
- The existing durable draft record stores the source and edited proposal together. Original exchanges are retained as local-only journal data on this device, including synchronization acknowledgements, clean refreshes and guest-account migration. They are not a new synced database field.

## Validation and limits

- Focused route/hook tests cover preview before save, edited proposal plus original persistence, failed save, failed formatting with unchanged save, review restoration, last dictated words, duplicate clicks and stale unmounted requests.
- Capture limit, HTTP response validation, snapshot refresh and sync receipt retention have focused regressions. Existing journal/persistence suites were exercised.
- Edge: 11 tests pass across recall and formatting; isolated function typecheck passes. Auth, journal scope, input/output bounds and admission remain enforced. Formatting shares the bounded recall budget, with no automatic provider fallback/retry.
- App/test TypeScript checks pass. Focused lint has no errors; existing effect warnings remain.
- Final committed affected-test preflight is required before push under current AGENTS.md.
- Motorola connected as `192.168.1.176:40435`; current Expo UI exposed “Valider mon récit”. No real formatting response or journal save was exercised: production deployment was rejected by automatic approval review pending explicit authorization. The user was using the device, so no draft or personal entry was overwritten.

## Prepared deployment

Target only `capture-recall` on project `usuyppgsmmowzizhaoqj`. Live snapshot is v4. Candidate changes four files: entrypoint, journal route allowlist, three-question limit, new formatting route; preserves fourteen other deployed files. Existing custom user/guest guards and `verify_jwt=false` configuration remain unchanged. No database migration or broader API/image deployment.

The deployment was not applied. It needs explicit user approval before retrying. After approval, compare the live version again, deploy the reviewed candidate, verify the remote source and authenticated device journey. Local tests do not establish real model fidelity or device persistence.


## Authorized deployment and Moto verification

The user explicitly authorized deployment on 17 September. First deployment hit a stale inherited import-map path; setting the existing `deno.json` path explicitly resolved it. Version 5 became active, then version 6 refined the formatting instruction after real-device inspection showed conversational corrections were being copied literally. The refinement explicitly applies corrections and resolves short answers against their established referents, without guessing missing content.

Final active version: **6**, SHA `c4929eab08631f75f5d9af397592394977a7027bcb19f8209834aa6c53b26a25`. A fresh source retrieval matched all eighteen candidate files exactly. Unauthenticated formatting still returns HTTP 401.

On the physical Motorola, the previous unavailable alert was dismissed, “Valider mon récit” was invoked and an editable “Relis ton récit” proposal appeared without the assistant question labels. The unchanged first proposal was returned to its original exchanges and formatted again; no journal save was pressed. The draft UI confirms local preservation. Model wording remained conservative in the inspected sample, including conversational repair phrasing; this is not proof that the model always resolves corrections correctly. The editable review remains necessary. Raw user content and screenshots stay outside Git.

The frontend pre-push check previously passed on `e71385e59608594a2d5410c26d32a7c507e0dadc`: 211 suites, 2,550 tests, one skipped. The final prompt delta retains 11 passing Edge tests; the new committed head will receive the mandatory pre-push check before publication. Journal persistence is covered locally, but the final save of this personal dream was intentionally not exercised on hardware.
