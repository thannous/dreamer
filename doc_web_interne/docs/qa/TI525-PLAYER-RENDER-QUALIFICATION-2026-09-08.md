# TI-525 — Player subscriptions, 8 September 2026

## Controlled host comparison

Baseline: `89b856293dfb6b766a2770b9c8861e81db864b3b`, original
`apps/meditation/context/PlayerContext.tsx`. Candidate: the context split in this
change set. Both ran under the same Meditation Jest/Expo preset, React 19.2.3,
and the same fake `audioService` fixture. The baseline was loaded from an exact
`git show` copy; its Library hook import was adapted to the command-only mock,
and aliases for the three probes all called the original `usePlayer`. Temporary
baseline source/test files were removed after the comparison.

After opening `sleep-descent` and one warm-up playing update, the fixture emits
120 native status updates spaced by 0.5 seconds of reported position, with stable
status and duration. Each update is a separate React `act`. Counters exclude
mount, opening, and warm-up. Probe components subscribe to commands, general
state, progress, or the compatibility facade and return `null`.

| Subscription | Baseline renders | Candidate renders |
| --- | ---: | ---: |
| Commands | 120 | 0 |
| General state | 120 | 0 |
| Progress | 120 | 120 |
| Compatibility `usePlayer` | 120 | 120 |

React Profiler `actualDuration` was collected on every probe. This Jest preset
reported **0 ms for all probes in both runs**; these durations are unusable for
CPU/frame-time conclusions. The observed benefit is eliminated context-induced
renders, not a measured Android performance or battery improvement. Native
render/CPU profiling remains a separate qualification layer.

The permanent regression scenario is `isolates 120 half-second ticks from command
and general-state consumers` in `tests/context/PlayerContext.test.tsx`. Its
optional diagnostic output can be reproduced from `apps/meditation` with:

```sh
TI525_RENDER_BENCHMARK=1 npm test -- --runInBand --watchman=false tests/context/PlayerContext.test.tsx --testNamePattern='isolates 120'
```

## Behavior coverage

The existing player tests retain completion, native focus changes, seek settling
and recovery, fade replacement/cancellation, and transport behavior. New tests
cover saved command identities using the latest position; persistence before a
session switch; ignored detached native callbacks; unmount during source
resolution; listener/handle disposal; and no command/state invalidation on
position ticks. Fade expiry now explicitly persists the paused position.

`MiniPlayer` reads general state and commands. The breathing route reads only
status and commands from the player. Neither subscribes to listening progress.
