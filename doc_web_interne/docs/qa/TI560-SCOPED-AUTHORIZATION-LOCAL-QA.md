# TI-560 — real local product-scope qualification

## Result and boundary

PASS against the existing disposable TI-528 database, after applying `20260909010000_scope_oauth_product_access.sql` in one transaction. The local guard checked project `noctalia-ti528-disposable` and database port 55322. No production database, configuration, provider request, app identity, or original Auth container was changed.

The harness starts a temporary **GoTrue v2.189.0** instance on loopback 55329, using the existing local signing configuration. It creates real public OAuth clients and uses authorization-code PKCE with S256, consent and refresh. Both Auth `/user` and the existing Data API independently validate the issued tokens. Token decoding alone is not the proof.

Run after applying the migration to the guarded disposable database:

```sh
TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json node scripts/ti560/qualify-scopes-local.cjs
```

The status file contains credentials and must remain private. The harness logs no tokens or credentials. The original issuer harness remains unmodified.

## Observed matrix

- Two synthetic users × Journal, Lucid and an unregistered OAuth client: real issuance and refresh retain the signed `client_id`; server mapping returns the expected product or `unknown`.
- Journal own create/read/update/delete succeeds. Lucid and unknown clients cannot read, update or delete those rows and cannot create Journal rows, even for the same user.
- User B cannot read or update user A's Journal, or read A's Lucid entities. B's attempt to create a Journal row for A is rejected with HTTP 403 / SQLSTATE 42501.
- Lucid own sync and read succeeds. Journal and unknown clients receive no Lucid entities; their sync and full-delete RPCs are denied. Lucid full-delete succeeds and preserves the user's Journal row.
- All nine exposed RPCs in the migration are exercised. Eight explicit guards reject the wrong product with 401/403. The security-invoker `get_lucid_trainer_entities` returns an empty collection through RLS. Correct Journal calls include an actually allowed chat begin and completed chat response, rather than HTTP success alone.
- Journal media upload and read succeeds. Lucid, unknown and another user's Journal tokens cannot read or overwrite that object. Denial requires HTTP 400/403/404 plus a recognized authorization/not-found error; 5xx cannot pass. PUT attempts use the same valid PNG as the positive upload.
- Forged `appId`/`x-app-id` headers do not expose Journal rows. Updating user metadata with a Journal product/client identity does not change the token's effective Lucid scope.
- The authenticated role cannot use/read the private mapping schema/table. Anonymous/authenticated TRUNCATE, REFERENCES and TRIGGER grants are absent on the six hardened tables.
- Legacy password tokens deliberately retain both products' own-data access. This is compatibility, **not** client isolation for unscoped tokens.

## Regression and cleanup

The canonical TI-528 qualification was run **after** the migration from the backend qualification worktree: **55 database contracts and 6 real behavior tests across 4 suites passed**. Log: `/private/tmp/ti560-legacy-after-scope.log` (local evidence, not committed).

After independent review, cleanup steps were separated so one failed fixture deletion cannot skip the others; container removal is in `finally`. Both real harnesses were rerun successfully after this hardening.

The auxiliary container, three synthetic clients, two synthetic users, private temporary environment file, mapping entries and media object were cleaned. Verification found zero `ti560-*@example.test` users, zero registered fixture mappings and **2,501 original dreams** remaining. The migration intentionally remains applied on the disposable database.

## Baseline error corrected and unproven layers

The first run exposed a pre-existing malformed RAISE in `get_effective_subscription_tier`, originally from `20260316154500_harden_subscription_state_rpcs.sql:20–21`. The parent corrected the new migration's definition to use `raise exception using errcode = '42501', message = ...`. Only that corrected function was reapplied on the disposable database; the full migration was not reapplied. The real scoped-token harness then passed with HTTP 403 / SQLSTATE 42501 required for the cross-user insert. The canonical legacy suite was rerun after this correction.

This qualification does **not** establish remote import consent, consent revocation, app OAuth redirect/session integration, legacy-token retirement, production issuer configuration, mobile behavior, or deployed security. Those remain separate gates. It does not authorize activation or deployment.
