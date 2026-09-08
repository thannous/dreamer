# TI522 real reader + engine QA

**PASS after UUID revision and nullable source-date corrections.** Exact TypeScript reader and engine were compiled with the installed esbuild into temporary CommonJS bundles. Runtime imports use the worktree alias mapping; no tracked files in PR146 were modified. This is transpilation, not a separate typecheck.

Source SHA256 at successful run:
- services/lucidJournalImportReader.ts: a03e7e4b22f6177c0efe4bc58623736deb26f82aea4957ef01edb58a7f9b9c46
- lib/lucid/journalImport.ts: 150301d2649733e9b02ddfd2de3f01b6ebad8e77b3b0b83eeba9b99fb2e80fc0

Temporary harness: `/private/tmp/ti522-real-reader-engine.cjs`.

Command:
```sh
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json node /private/tmp/ti522-real-reader-engine.cjs
```

The harness uses the accepted auxiliary loopback GoTrue v2.189.0 pattern, real PKCE-issued/refreshed OAuth tokens, and the existing local Data API/import-grant RPC. It does not restart the original Auth service.

Observed:
- 0 dreams: terminal empty checkpoint.
- 1 dream with SQL created_at=NULL: exactly one minimal local copy, createdAt remains null without inventing a date.
- 2501 dreams: exactly 2501 local copies, 13 real server pages and 13 successful storage writes, completed checkpoint. Exactly one source-null date remains null in the full result.
- Copies preserve source account/product/id/revision, transcript and dates; no interpretation or media is copied.
- Revoked and server-expired grants throw instead of becoming empty journals; zero storage writes.
- Another registered Lucid client, another user and a legacy token are denied by the server; reader/engine propagate failure with zero storage writes.

The initial real run found decimal revision validation incompatible with the actual UUID SQL column. The author fixed reader/engine/shared validation and provided a stable checkpoint before this rerun. `dreams.client_request_id` was independently verified as UUID NOT NULL as well.

Storage is an in-memory implementation with the engine's active-scope save guard. This proves actual server-to-reader-to-engine compatibility, **not device persistence, native UI, activation, deployment or production OAuth registration**.

Cleanup after success: original 2501 dreams preserved; zero synthetic users, import grants, cursors and product mappings remain. Temporary credential environment and auxiliary Auth container were removed. No provider or production operation.

Actual PostgreSQL projection metadata verified without reading personal content: id bigint NOT NULL; created_at timestamptz NULLABLE (default now()); transcript text NOT NULL; client_request_id UUID NOT NULL; revision_id UUID NOT NULL.

Only the two newly reviewed FK indexes were applied locally and verified through pg_indexes: journal_import_grants_owner_idx(owner_uid), journal_import_cursors_grant_idx(grant_id). No full migration replay. The complete real reader/engine suite above then passed.

## Subsequent local-write reconciliation

After the real run above, updateCopy was changed to reread and confirm the exact intended durable snapshot when an atomic write acknowledgement fails. The page reader/import loop and SQL contract are unchanged; the engine file hash above identifies the real-run source, not this later full file. Independent review and 50 focused tests cover committed delete/conflict decisions, unapplied writes, retry and account changes. No additional database run is claimed for that local-only correction.
