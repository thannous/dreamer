# TI522 — independent real OAuth service QA

Result: PASS on 2026-09-09. Source `/private/tmp/noctalia-product-session/services/productOAuthSession.ts`, SHA256 `75dd7c9b5b966f3c737a8b98bebad2408047e4f7998c18e2e78488311b95a704`. Source was compiled with the installed TypeScript transpiler into CommonJS; no source changes and no Git mutations.

## Actual topology and evidence limits

Existing disposable API55321 / DB55322 remained unchanged. Auxiliary GoTrue v2.189.0 on55329 used the same local DB/network with OAuth enabled. Its signed issuer is `http://127.0.0.1:55321/auth/v1`, matching the application's configured origin exactly. The transport fetch adapter routed only OAuth token exchange/refresh URLs to the auxiliary GoTrue because OAuth is disabled on original Auth; `/user`, product RPC, and logout used the original gateway. No issuer validation was disabled or altered. This is a local test routing adapter, not proof OAuth is enabled in production.

Service behavior tested with genuinely issued PKCE codes/tokens and real server verification/mapping:

- `begin` -> consent -> `complete` for Journal and Lucid, same owner, distinct registered client/product mappings.
- `restore`, refresh and concurrent refresh calls (same resulting token).
- Owner mismatch through a real other-owner consent/token rejected and storage cleared.
- Client mismatch rejected using an explicitly fault-injected verified-identity adapter; not claimed as a naturally issued wrong-client code.
- Real refresh result delayed while owner generation changes: late response rejected, authority and storage cleared.
- `logout` clears dedicated session and preserves the original legacy bearer (`/user` remains200); other product restore succeeds.

A virtual application clock drives refresh threshold only; server tokens and verification are real. Storage is an in-memory atomic adapter; SecureStore/device persistence not covered. Issuer/origin mismatch did not occur.

The OAuth authorization-details endpoint may directly return `redirect_url` when prior consent already exists. The first harness attempts incorrectly submitted consent again and received400; harness corrected to use the server's completed redirect. This was harness behavior, not a source defect.

## Commands/artifacts

`TI528_LOCAL_STATUS=/private/tmp/ti528-local-status.json node /private/tmp/ti522-real-qa.cjs`

Harness: `/private/tmp/ti522-real-qa.cjs`; compiled source `/private/tmp/ti522-product-session.cjs`; aggregate log `/private/tmp/ti522-real-qa.log`. None contains printed JWTs. Status file remained private.

Final process exit0. Cleanup verified: no auxiliary `ti560-auth-*` containers remain, zero synthetic `ti560-*` users remain, original total dream count2501 preserved. Original containers/configuration unchanged. No production, device, deployment or database-policy modifications.
