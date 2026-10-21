# Full TesterArmy migration — 2026-10-21

Scope: unify all active E2E commands on TesterArmy and include the owner's saved
ChatGPT Pro login in one repeatable web campaign. No deployment, EAS/Store build,
purchase, production write or new inference provider is part of this package.

The primary checkout and its unrelated WIP are preserved. Implementation starts
from `dfc458a11a0173a6db5148e4fa28499c3e4284df` in an isolated checkout. The earlier
audit on `beba289f` describes an older candidate; current master already contains
the corrected 3/3 allowance and the supported ChatGPT persona integration.

## Migration and coverage

`test:e2e:web`, `test:e2e:backend` and `test:e2e:branch` now use the same guarded
TesterArmy runner as the existing Dreamer/Lucid/Meditation/site/native commands.
The old Playwright configs and duplicate `e2e/{web,backend,branch}` suites are
retired. `playwright/test` is retained as a matcher/type library, and the SDK's
public browser surface retains geometry, accessibility and timer checks.

The old web collection contained 68 tests. The existing Army collection retained
61 titles verbatim. Six renamed cases follow the already intentional current
behavior: capture chat ends in its saved moment; the two theme variants of the
onboarding cross ask before leaving; Escape keeps the story open; the three
chapters end through their door; consent refusal/retry retains the original story.
The unique direct Plus offer from free reflection is explicitly migrated with
its no-intermediate-chat and return-to-reflection assertions. No unique live
security, backend or concurrency control is removed.

| Product | Main and secondary protection |
| --- | --- |
| Dreamer | Guest/free/Plus capture, journal search/edit/delete/favourites, drafts, consent refusal/retry, reading/reflection/chat, entitlement failure/recovery, onboarding, settings, symbols, responsive/a11y checks. Four locale/feature contexts are collected as a union. |
| Local backend | Eight cases retain real Auth/PG/PostgREST, fresh-browser durability, edits/deletion, other-user/anonymous isolation, free/Plus server quotas, offline save exactly once, legacy/precise themes and private Apple tokens. |
| Lucid | Existing sleep/onboarding safeguards, ambience retry, morning journal and signs/Atlas, lab pause/resume. Added complete stabilization practice with exact single completion/progress after two restarts. |
| Meditation | Existing onboarding/navigation/editorial/history/settings. Added favourite add/reopen/remove after restart; playback, pause, exact 15-second seek, restart/resume, natural completion, one history record and one-day streak after two restarts. |
| Site | Existing multilingual pages, navigation, Atlas interaction, responsive images/layout and motion checks. |
| ChatGPT Pro | Four existing personas, one worker, real `chatgpt()` calls via saved OpenAI login, bounded goals with exact outcomes; no replay or alternate provider. |

The full entry point is `mise exec -- npm run test:testerarmy:all`. It records a
compact report under `tools/e2e/.e2e/full/`, referencing unchanged per-run evidence.
Failures, missing calls/login, incomplete coverage union and source changes fail
the full result. Exact steps do not invoke a model.

## Validation

The canonical full campaign passed on the clean revision
`0d7b6b1a200e2e61cdfb9c2d53e18aa1a2b490f9`: all 12 command stages exited zero,
the before/after source snapshot is stable, and no child result is reused from
the earlier interrupted development campaigns.

| Fresh E2E result | Passed cases |
| --- | ---: |
| Dreamer, union of EN/FR/DE and feature on/off contexts | 133/133 |
| Lucid | 8/8 |
| Meditation | 3/3 |
| Site | 97/97 |
| ChatGPT Pro personas | 4/4 |
| Local backend | 8/8 |
| Total, excluding preflights and duplicate union accounting | **253/253** |

The four Pro personas completed seven `agent.act()` goals through
`chatgpt.responses` / `gpt-6.1-sol`, with **23 actual model calls** through the
saved OpenAI login. Provider prompt-cache accounting does not represent a replay:
all seven goals executed fresh, with the SDK replay cache disabled. The backend
wrapper exited zero after its owned-stack cleanup.

Canonical receipt:
`tools/e2e/.e2e/full/full-1792574567661-123ea861-2e32-4d62-a091-0c07b46515df/report.json`.
It references each child report, exact commands/environment and tested revision.
Rerun from the repository root: `mise exec -- npm run test:testerarmy:all`.
The subsequent update to this evidence document changes no application or test
input; the campaign remains evidence for the revision named above.

`mise exec -- npm run verify:pr` passed on that revision: nine checks freshly run,
six reused on identical inputs, three out of scope. The PR records the final
committed head and its own verification proof. Additional focused checks passed:
Army test types, 49 SDK/runner guards, 36 backend/auth guards (including four
process-ownership cases), and four light/dark journal counterexamples. The
guarded hosted-branch collection refused its empty allowlist before network
access, as required; it is not included in the passed-case total.

Independent review identified an interruption defect: killing the synchronous
backend wrapper could skip its finally and leave its descendant and owned stack
active. The wrapper now relays SIGINT/SIGTERM asynchronously, waits for child
closure, then destroys only its stack. Four real process tests cover both
signals, failed-child cleanup and handler removal. This isolation control avoids
leaking a live database just to reproduce process ownership. The reviewer closed
this correction and the report-selection correction after focused delta review.

The full campaign reproduced a pre-existing web drawer defect: closed quick
settings widened the document by 366px at a 390px viewport. Browser focus/scroll
could then expose the inert drawer over the journal (dark case failed in the
full pass and in a focused repeat). The exact width counterexample is retained
in `dreamer-journal-margin.web.e2e.ts`; the web-only overlay now clips its
off-screen drawer with `overflow: clip`. A diagnostic confirmed that `hidden`
created a scroll container with `scrollLeft=366`, so it could still reveal the
closed panel during focus restoration. The non-scrollable clipping boundary
preserves the drawer’s internal vertical scrolling. See [CSS overflow](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/overflow). Native rendering is unchanged by that conditional style.
Baseline measurement artifact:
`tools/e2e/.e2e/dreamer-web/1792574261492-98317-0b0a386f-8a89-469b-8a7e-2cc7bb77cba7/`.

## Remaining qualification boundaries

Native suites already use Army but this tooling migration does not qualify new
Android/iOS binaries, OS permission dialogs, microphone/background behavior or
Store transactions. Those require identified Release/device evidence. Mock UI
does not prove hosted AI quality or production behavior. The persistent branch's
empty allowlist still refuses all hosted sessions before network access; it is
excluded from the full command and never counted as a passed case.

No suite can guarantee the absence of every future regression. This campaign
protects its exact observed outcomes; specialized security/race/backend/native
controls and release gates remain enforced.
