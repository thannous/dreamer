# TI-560: explicit Journal import grant transport

Preparatory SQL contract only. No UI, implicit synchronization, issuer registration,
production migration or automatic import is activated. Client-side consent,
preview, destination choice, deduplication and local deletion remain separate work.

## RPC contract

- `create_journal_import_grant(p_destination_client_id text, p_selected_ids bigint[] default null)`:
  recognized Journal OAuth client, authenticated owner. Destination must be a
  registered Lucid OAuth client. Null selection means all owned dreams up to the
  creation watermark; an explicit selection must contain 1–10,000 unique owned
  IDs. The selection bound does not cap all-scope pagination. Returns grantId,
  first opaque cursor, expiresAt and scope. The server fixes lifetime at 15 minutes.
- `read_journal_import_page(p_cursor uuid, p_limit integer default 100)`:
  recognized Lucid client matching the destination and the same authenticated
  user. Limit is 1–200. Every call, including retries, checks owner, destination,
  source still registered as Journal, expiration and revocation. Returns items,
  nextCursor and done. Legacy and unknown scoped tokens are rejected.
- `revoke_journal_import_grant(p_grant_id uuid)`: only the originating recognized
  Journal client and owner. Repeating revocation is valid. Returns true.

Items expose only id, clientRequestId, revision, createdAt and transcript. IDs are decimal bigint strings;
revisions are opaque UUID strings from revision_id. Historical created_at values
may be null; createdAt preserves that unknown date rather than inventing one. There are no media URLs, audio, analysis, account
profile or health fields. Type declarations are in `scripts/ti560/import-contract.d.ts`.

## Pagination and concurrency

UUID cursors are opaque references, not authority. Cursor rows belong to a grant
and cannot be accessed directly by clients. The first call fixes that cursor's
ending ID, bounded row-ID list (at most 200), and single next cursor under a row lock. Subsequent calls keep that
row-ID list even if a different limit is supplied. Later gap inserts and late
transaction commits cannot expand a replayed page. Deleted rows are omitted; edited
rows return current text and revision. Replays do not fill gaps with later rows.
Only IDs and cursor metadata are retained privately, never copied transcripts.
Expiry is rechecked after acquiring the cursor lock and before projection, so a
request that waited past expiration is denied.

Pages use ascending ID keysets bounded by the grant watermark. This is not a
transactional snapshot across pages. A grant share lock serializes each page
against revocation; an already executing page can complete before revocation
returns. Revocation prevents later page calls. Received client copies cannot be
revoked remotely by this transport.

Grant owner foreign keys cascade on Auth user deletion; cursor rows cascade with
grants. Both referencing foreign keys are indexed to bound cascade lookup cost. Expired rows are inaccessible but retained until administrative cleanup.
A future bounded TTL cleanup should delete expired grants; no production cron is
created here. Unlimited repeated grant creation is not claimed abuse-resistant;
rate limiting and UI activation are rollout gates.

Run `node --test scripts/ti560/import-contract.test.cjs` for source assertions.
These checks do not prove SQL execution or authorization. Disposable DB QA must
cover real scoped tokens, cross-user/client/legacy rejection, expiry, revocation,
zero/one/2,501 dreams, selected ownership, page retries, edits/deletions and exact
projection before acceptance.
