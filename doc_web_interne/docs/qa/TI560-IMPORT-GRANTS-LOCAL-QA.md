# TI-560 — real local Journal import-grant qualification

## Result and environment

**PASS** for `20260909020000_journal_import_grants.sql`, applied in one transaction to the already scoped, disposable TI-528 database on loopback port 55322. The harness uses the accepted auxiliary GoTrue **v2.189.0** pattern, real authorization-code PKCE/S256 and refreshed JWTs, independently validated by Auth and the existing Data API. The original Auth container/configuration remains unchanged.

Two synthetic users each receive Journal, Lucid, unknown-client and a second registered Lucid-client token. This tests both product identity and exact destination-client binding; merely using another valid Lucid client does not grant access.

```sh
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json node scripts/ti560/qualify-import-local.cjs
```

The migration must already be applied to the guarded disposable database. No migration is automatically applied by the harness. Keep the credential status file private.

## Observed behavior

- **0 dreams:** a Journal grant can be created; its Lucid page is empty and terminal.
- **1 dream:** grant creation and page execution succeed with exactly the owned row.
- **2,501 dreams:** all pages complete, with exactly 2,501 unique IDs and at most 200 items per initial page. No truncation at 1,000 or 2,500.
- A dream inserted after grant creation is excluded by the watermark. Another user's dream is excluded.
- An explicit two-ID selection returns exactly those two rows. Selecting another user's ID is denied.
- Payload keys are limited to `id`, `clientRequestId`, `revision`, `createdAt`, `transcript`; seeded private titles, interpretations and quotes are absent.
- Journal, unknown-client, legacy and the other user's Lucid tokens cannot read a grant. A different registered Lucid client belonging to the same user is also denied.
- Lucid, unknown and legacy tokens cannot create grants. Other users and non-Journal tokens cannot revoke them.
- An absent cursor is denied. Expiring a grant denies replay of an already processed cursor. Revoking a grant denies both an already read cursor and the next unread page.
- Replay preserves the bounded selected row IDs and the same next cursor, even if the caller supplies a smaller limit. It returns current transcript/revision and omits rows deleted since the first read, rather than replaying stored personal content.
- Five concurrent first reads of one fresh cursor return the same next cursor and create exactly one next-cursor row. Five concurrent replays also return the same next cursor.
- A deleted ID is backfilled after the first 200-row page. Replay still returns exactly the original 200 selected IDs and excludes the late backfill; it cannot exceed its initial page size.
- A separate database transaction holds a cursor lock for three seconds while its grant expires after two. The request demonstrably waits on the lock and is then denied, proving expiry is checked again after lock acquisition.
- Anonymous and authenticated roles cannot select the private grant/cursor tables.

## Cleanup and evidence limits

After the independent review fixes, only the new `selected_row_ids` column and exact updated read function were applied locally; the complete migration was not repeated. The expanded real harness passed.

Cleanup uses independent attempts for each fixture and container removal in `finally`; the harness was rerun successfully after this review hardening. After the final successful run, the auxiliary container, four synthetic clients, two users and their dreams, mappings, grants, cursors and private temporary environment file were removed. Explicit database verification found **zero fixture users, grants, cursors and mappings**, with **2,501 original dreams preserved**. The migration remains on the disposable local database only.

The SQL additions do not replace the older product guards; no additional canonical legacy rerun was needed after this additive migration. Their latest post-fix result remains 55 contracts and 6 behavior tests passed, documented in `TI560-SCOPED-AUTHORIZATION-LOCAL-QA.md`.

This proves local server transport behavior, not mobile consent UI, session handoff, deployment, production OAuth registration, or retirement of legacy tokens. Revocation cannot retract a page already received by a client. No provider, production or device operation was performed.
