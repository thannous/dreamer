# Journal sync recovery — 2026-09-17

## Incident qualification

- Physical Motorola Edge 60 Fusion, Wi-Fi ADB, base package `com.tanuki75.noctalia`, development build 3.1.0 (54). No install, uninstall or data clearing.
- At 18:17 Europe/Paris the saved dream was durable in the device SQLite cache. Its create and two updates remained `pending`, with retryCount 0 and no lastAttemptAt or error.
- A manual retry at 18:21 still made no network attempt. Android reported a validated Wi-Fi network.
- Supabase management logs for 16:15–16:24 UTC show zero `sync_dream_mutations` requests before the 16:22:49 reload and three after. SQL receipts confirm one create and two update acknowledgements, and the row exists.
- Reloading the development runtime recovered the original queue before the functional patch. The pre-reload runtime had no gate diagnostics: the exact gate that blocked that session cannot be asserted retrospectively. A stale app connectivity snapshot is a candidate, not a proven original root cause.
- The old UI showed an activity indicator for every pending dream, independently of whether a request was running. This misleading spinner is confirmed in code and on the device.

## Confirmed defects and changes

1. The automatic replay effect depended only on commands. Late queue hydration with stable account/network did not retrigger it. A regression test fails on the original code (zero creates expected one) and passes with hydration dependencies.
2. Manual retry previously trusted the same cached connectivity flag that could have suppressed the original replay. Explicit retry and foreground recovery now query native connectivity, with a five-second probe deadline, then bind that attempt to the fresh result. A save with a cached offline state also checks again. Actual offline state preserves the queue and manual retry displays a translated failure message.
3. Manual retry could overwrite a concurrent server acknowledgement using a dream captured before an await. Retry now updates the latest cache state and preserves a received remote ID/revision and clean state. The existing delayed-cache-read/deletion regression now controls the automatic in-flight create and asserts identity preservation.
4. Account activation now detaches the old account's in-flight promise. Its late completion remains excluded by scope/token guards. A new account can replay without waiting for an unresolved old request.
5. Pending copy says waiting, without a perpetual spinner; the manual retry spinner only lasts for the attempt. All six locales updated. Deferred replay logs contain only reason/count, not dream content or identifiers.

## Validation

- Focused hook, engine and route tests: 174 passed.
- App and test TypeScript checks passed. Focused lint: zero errors; seven existing warnings in unchanged portions of the large journal screen/hook.
- `npm run test:prepush` passed on clean code commit `500b43fa5df799b11887ad1fa8a8346a074d7620`: 111 suites / 1,104 tests, app/test types; fresh base `214c6e845e73599f0ee61cfa535303e2cfa73717`.
- Self-review covered scope changes during replay, stale network decisions, retry/ack ordering, queue retention, observer cleanup, and UI error visibility.
- Motorola loaded the correction through isolated Metro port 8082 with the existing teststore profile. A synthetic `QA SYNC 20260917` dream was created through the real Write UI at 18:36. Automatic create acknowledgement completed in 1,371 ms; subsequent updates were acknowledged; sync card disappeared. SQL independently confirmed the row and receipts.
- The synthetic dream was deleted through its own UI confirmation, then its absence was verified in SQLite and Supabase. Original dream remained in Supabase, queue empty, no pending flag/error; its transcript exactly matched the original device copy. The device was returned to the original dream, visibly without the sync card.
- Device screenshots and private diagnostic snapshots remain in local temporary storage, excluded from Git. Shared-workspace Markdown/config/test changes were preserved. The sync patch is also applied to the original Metro workspace without overwriting those changes.

## Boundaries

This qualifies the code and the installed development runtime, not a new Release/Play binary. No backend deployment, schema change, Store submission or production publication was performed. Delayed hydration, stale connectivity, genuine offline retry and account-switch interleavings are deterministic test evidence; the fresh online save and cloud persistence are physical-device evidence. Full original-session causality remains limited by missing pre-reload gate telemetry.
