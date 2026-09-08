# TI522 real reader + engine QA

**PASS after the UUID revision correction.** Exact TypeScript reader and engine were compiled with the installed esbuild into temporary CommonJS bundles. Runtime imports use the worktree alias mapping; no tracked files in PR146 were modified. This is transpilation, not a separate typecheck.

Source SHA256 at successful run:
- services/lucidJournalImportReader.ts: 2e0162b6bc3b1f23b0b5149bc2221bc5835edcd817f0ab07e15d90fa36d13e20
- lib/lucid/journalImport.ts: be2a1659091dc99775dc996ac706a95a72fe384ac27913015692bb11dcbf8b33

Temporary harness: `/private/tmp/ti522-real-reader-engine.cjs`.

Command:
```sh
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json node /private/tmp/ti522-real-reader-engine.cjs
```

The harness uses the accepted auxiliary loopback GoTrue v2.189.0 pattern, real PKCE-issued/refreshed OAuth tokens, and the existing local Data API/import-grant RPC. It does not restart the original Auth service.

Observed:
- 0 dreams: terminal empty checkpoint.
- 1 dream: exactly one minimal local copy.
- 2501 dreams: exactly 2501 local copies, 13 real server pages and 13 successful storage writes, completed checkpoint.
- Copies preserve source account/product/id/revision, transcript and dates; no interpretation or media is copied.
- Revoked and server-expired grants throw instead of becoming empty journals; zero storage writes.
- Another registered Lucid client, another user and a legacy token are denied by the server; reader/engine propagate failure with zero storage writes.

The initial real run found decimal revision validation incompatible with the actual UUID SQL column. The author fixed reader/engine/shared validation and provided a stable checkpoint before this rerun. `dreams.client_request_id` was independently verified as UUID NOT NULL as well.

Storage is an in-memory implementation with the engine's active-scope save guard. This proves actual server-to-reader-to-engine compatibility, **not device persistence, native UI, activation, deployment or production OAuth registration**.

Cleanup after success: original 2501 dreams preserved; zero synthetic users, import grants, cursors and product mappings remain. Temporary credential environment and auxiliary Auth container were removed. No provider or production operation.
