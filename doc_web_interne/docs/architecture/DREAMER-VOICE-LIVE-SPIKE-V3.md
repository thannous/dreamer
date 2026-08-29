# Dreamer Voice Live Spike V3 (TI-428)

Internal prototype kernel for an optional live voice loop after a persisted
original dream. This ticket is local and read-only of TI-427: it reuses persist
ids, hashes, closed recall intents, and the add -> persist -> request contract.
It does not modify `lib/dreamRecallAssistant.ts`, UI, backend, Linear, or device
proof. Device evidence stays on TI-429.

## Goal

Decide whether Prototype A can host a barge-in voice loop without speaking or
thinking before the last user segment is confirmed persisted.

## Non-goals

- UI host, Expo speech session, or native STT wiring
- Backend, quota RPCs, chat routes, or Gemini calls
- Linear issue mutation
- Device or Motorola proof (TI-429)
- Shipping Option B

## Prototype A (only candidate now)

Native STT -> confirmed persist -> text AI -> `expo-speech`.

| Gate | p95 / budget |
|---|---|
| End of speech to persist ack | 1_200 ms |
| Persist ack to first AI token | 2_500 ms |
| First token to audible TTS | 700 ms |
| Barge-in to speech stop | 250 ms |
| Cost / 5-turn session | USD 0.05 |
| Privacy | audio retention off by default; original transcript never enters AI turns |
| Quota | remaining quota and max AI turns must block `request_ai` / `speak` |

Option B (realtime audio in and out) is documented only as a fallback. It is
eligible after a Prototype A **no-go that is latency-only**. Invariant, cost,
privacy, or quota failures are a hard no-go, not a reason to start B.

## Kernel

Pure persistable module: [`lib/voiceLiveSpike.ts`](../../../lib/voiceLiveSpike.ts).

Statuses: `idle`, `listening`, `await_persist`, `thinking`, `speaking`,
`interrupted`, `paused`, `offline`.

The prototype stays behind `dreamer.voiceLiveSpike.v3`, off by default
(`VOICE_LIVE_SPIKE_FEATURE_ENABLED_DEFAULT = false`). Start without an explicit
`eligibility.featureEnabled: true` stays idle and returns
`ineligible / feature_disabled`.

Commands are host instructions, never I/O:

- `listen`, `await_persist`, `request_ai`, `speak` (`tts: 'expo-speech'`)
- `stop_speech`, `queue_offline`, `paused`, `offline`, `interrupted`, `flag`
- `ineligible` with a closed reason

`request_ai` reuses the TI-427 shape: `intent`, `dreamId`,
`originalTranscriptHash`, `originalPersistedSegmentId`, optional
`originalTranscriptRef`, `turnIndex`, `persistedSegmentId`. It never carries
`originalTranscript`. Recall uses `recall_question`. Analysis and chat use
`analysis_turn` / `chat_turn`.

## Invariants

1. Never emit `request_ai` or `speak` before the latest user segment is
   persisted. Unpersisted capture stays on `await_persist`.
   `commandForVoiceLive` must not emit `speak` without a persisted anchor,
   including hydrated or forged `status=speaking` snapshots. Hydration rejects
   those snapshots as `invalid_state`.
2. The original dream transcript is a separate lane. Recall, analysis, and chat
   turns must not copy it. Commands point at persisted ids / hashes only.
3. Audio retention is `off` unless the caller explicitly opts in.
4. Offline capture may persist and queue. It must not answer, think, or speak.
5. Barge-in from `thinking` or `speaking` stops speech, keeps the last
   persisted segment, and lands on `interrupted`. Reprise returns to listening
   (or offline) without inventing a new AI turn.
6. Pause stores a resume target. Resume never skips persist confirmation.
7. Eligibility and budgets (`remainingQuota`, `maxAiTurns`, session duration,
   microphone / speech availability) can only produce `ineligible`, never a
   silent AI/TTS command.

## Happy path (Prototype A)

1. Original narration is already persisted (TI-427). Spike starts from that id.
2. Recall / analysis may request the first AI turn from
   `originalPersistedSegmentId`. Chat waits for a user segment.
3. User speech becomes an unpersisted pending segment (`await_persist`).
4. Host confirms persist. Kernel moves to `thinking` and may emit `request_ai`.
5. Host appends a bounded utterance. Kernel moves to `speaking` / `speak`.
6. User barge-in issues `stop_speech`, preserves the last persisted segment,
   and waits for reprise.
7. Offline: persist if needed, `queue_offline`, no response.

## Follow-ups (not created)

| Ticket / work | Status |
|---|---|
| TI-429 | Device proofs: barge-in, persist-before-AI, offline queue, audio retention off, Motorola / TalkBack |
| UI host over this kernel, still no Option B | Not created. Do not invent a Linear id. |
| Option B only if TI-428/429 record a latency-only A no-go | Not created. Do not invent a Linear id. |

## Proof split

| Layer | This ticket |
|---|---|
| Local kernel / Jest / typecheck / lint | TI-428 |
| Public HTTP, Play, EAS, backend | out of scope |
| Human / device | TI-429, currently unproven |

## Verification

```bash
npm run test:file -- lib/__tests__/voiceLiveSpike.test.ts
npm run typecheck:app
npx expo lint lib/voiceLiveSpike.ts lib/__tests__/voiceLiveSpike.test.ts
git diff --check -- lib/voiceLiveSpike.ts lib/__tests__/voiceLiveSpike.test.ts doc_web_interne/docs/architecture/DREAMER-VOICE-LIVE-SPIKE-V3.md
```
