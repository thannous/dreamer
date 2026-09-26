# Landing: ten dream-to-symbol steps — 2026-09-26

## Changes

- Replace the disproportionately long first account followed by nine short slots
  with ten equal slots (90svh each), keeping the gallery/analysis scroll distance.
- Reserve the final 20% of each slot for reading the completed account/map.
- Add labelled 44px Previous/Next buttons alongside the existing localized counter.
  Pointer navigation scrolls through the flight; keyboard navigation lands directly.
  Scrolling remains native/free, reversible and is never intercepted or locked.
- Each mapped symbol now has an explicit marked source in the account text in all
  six languages. Reuse the existing word comet, trail and arrival effect for all ten.
- Keep previously discovered stars when a recurring symbol flies in; reconcile the
  map on reverse scroll. Hide offstage comets and release them on fallback cleanup.
- Preserve reduced-motion rendering and the existing intro/sky/card animations.

## Verification

The browser check asserts account selection, comet visibility, reverse navigation,
and exact symbol/word coverage across 60 localized accounts.
Chrome DevTools MCP: mobile 390×844 DPR3 touch, CPU 4×; ten forward steps and reverse
9→3→1 showed the expected account and comets, exactly one accessible active account,
no horizontal overflow. Previous/Next keyboard and pointer activation reached the
expected step. Returning to the hero left no visible comet/trail/arrival elements.
No JavaScript errors. No screenshots taken or physical-device feel/FPS claim.

The same MCP checks passed at desktop 1440×900 in English, including all ten
flights, reverse navigation and both button activation modes.

## Repeatable E2E artifact

Prerequisites: the built landing is served on port 8015; Node 24 and
chrome-devtools-mcp are available. Only public example accounts are used.
Run from this worktree:

```sh
node ../mobile-performance/verify-starmap-mcp.cjs
```

Set `BASE_URL=https://noctalia.app` to repeat against the deployment. The runner
exits nonzero on failed assertions and saves the evaluated JSON result and console
messages under `/tmp/noctalia-mcp-starmap-steps/`. It uses an isolated browser,
not the user's tabs. The script is kept in the task's `work/mobile-performance/`
artifact directory. Build/revision and final outcome are recorded there alongside
its production report. This E2E coverage replaces the initial isolated tests in
accordance with the updated repository testing policy integrated from master.

## Approved pacing follow-up

Previous/Next pointer activation now opens the selected account at its beginning
and advances linearly for six seconds to the reading plateau. This replaces the
1.1-second eased scroll that rushed words and comets. Keyboard/reduced-motion
activation remains immediate; wheel input interrupts playback.

The local browser check at 430×932 DPR3, CPU ×4 passed: 10/25 words at 1.1s,
word comets visible at 3.4s, settled account/map at 6.4s, slow Previous replay,
wheel interruption and immediate keyboard activation. Rerun the artifact with
`node ../mobile-performance/verify-step-pace-mcp.cjs`; its machine-readable output
is `/tmp/noctalia-mcp-step-pace/pace.json`. The source is unchanged from that
approved local preview. No screenshot or physical-device performance claim.
