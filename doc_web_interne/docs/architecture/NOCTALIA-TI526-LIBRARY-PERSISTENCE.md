# TI-526 — Meditation library persistence

The public library state remains favorites, progress and practice history. AsyncStorage remains the engine. A provider owns a serialized persistence instance and supplies immutable snapshots.

## Storage and migration

- `@noctalia-med/progress`: `{version:1, progress}`.
- `@noctalia-med/favorites`: `{version:1, favorites, practiceLog}` after migration.
- Legacy combined favorites payloads are read without rewriting. On the first successful save, progress is copied first; only then is the legacy payload replaced by metadata. A failed progress copy leaves the full legacy record intact. An interruption after the copy is recovered by preferring versioned progress while restoring legacy favorites/history.
- Reads distinguish absent keys from malformed JSON, invalid shapes and storage failure. No mutation may persist before successful hydration. Unknown versions and a missing progress key after migration fail closed.
- Writes are ordered; durable caches update only after success. An unchanged failed value can be retried. Provider `persistenceError` and `retryPersistence` expose recovery; repeated unchanged position callbacks also retry without changing the timestamp or adding a completion.
- There is no cross-key transaction: a failed metadata write can leave newer progress durable while metadata remains at its last successful value. The error remains visible and retry saves the current snapshot. No claim of atomic multi-key commits is made.

## Measured fixture

The deterministic test uses 400 practice records (the existing cap), one progress record, and 120 distinct five-second progress updates after migration. ASCII fixture JSON length equals UTF-8 bytes.

| Measure | Previous combined format | Split format |
| --- | ---: | ---: |
| Storage writes | 120 | 120 |
| Serialized bytes sent to storage | 3,233,260 | 13,180 |
| History-bearing payload serializations during updates | 120 | 0 |

Metadata payload identity and serialized content are reused while favorites/history references are unchanged. Commands and metadata have selective React contexts; `useLibrary` remains compatible, while consumers needing no progress should use `useLibraryMetadata` or `useLibraryCommands`.

Tests use fresh persistence instances to verify restoration, interruption recovery, failed reads/writes, ordering and unchanged retries. These figures are fixture measurements, not Android filesystem timings or production telemetry. Device qualification is recorded separately.

## Resume and abrupt termination

The existing periodic checkpoint remains every five seconds of playback progress. Pause, seek, session switch, timer expiry, background transition and provider teardown also request a save. With successful completed storage writes, an abrupt process termination can lose the progress since the last checkpoint (normally up to five seconds, plus any in-flight write latency). Storage failure or a delayed native callback can extend that window; shutdown callbacks are not guaranteed, and zero loss is not promised. Restoring the library never starts audio by itself.
