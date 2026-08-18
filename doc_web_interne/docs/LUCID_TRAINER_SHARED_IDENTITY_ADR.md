# ADR — Shared Noctalia identity across companion applications

**Status:** accepted for the source candidate; external provider configuration remains pending.

**Date:** 2026-08-13

## Context

Noctalia and Noctalia Lucid Trainer are separate applications from the same publisher. Users should not need to create two unrelated accounts or lose a Noctalia Plus entitlement when they move between them. At the same time, dream-journal content is more sensitive than the minimal identity record needed to sign in, and Lucid Trainer must remain useful without an account.

Sharing an identity is not the same as sharing every product record. The decision must preserve purpose limitation, explicit transfer, independent local use, deletion, and least-privilege access.

## Decision

Use the existing Noctalia Supabase Auth project as the canonical ecosystem identity provider. The immutable Supabase `auth.users.id` UUID is the cross-application account identifier and the RevenueCat App User ID after sign-in.

Keep product data separated:

- Noctalia journal data stays in the journal domain.
- Lucid Trainer writes only to `lucid_trainer_*` tables and RPCs.
- Every exposed row is owner-scoped with RLS using `auth.uid()`.
- Local training, local history, export, and deletion remain available without an account.
- Cloud synchronization, analytics, and transfer to Noctalia remain separate opt-ins.
- The Lucid application never transfers dream text, notes, or exact sleep times to Noctalia automatically.

The applications share credentials and the server-side user UUID, not an on-device session secret. Each application keeps its own SecureStore/keychain container. Do not pass refresh tokens or access tokens through custom deep links. A user may therefore need to authenticate once in each installed application.

Provider configuration stays application-specific:

- Google OAuth requires distinct Android/iOS clients and redirect configuration for `com.tanuki75.noctalia.lucid`.
- If Google is offered on iOS, the release must also satisfy Apple App Review Guideline 4.8 with an equivalent privacy-preserving login option (normally Sign in with Apple). Email/password alone should not be assumed to satisfy that review gate.
- RevenueCat should use the same project and exact Noctalia Plus entitlement, but a separate RevenueCat app and public SDK key for each store application.
- Both applications identify the signed-in customer with the same non-guessable Supabase UUID; email addresses are never RevenueCat App User IDs.

## Options considered

### One Supabase Auth project, isolated product domains — accepted

Benefits: one credential, one stable UUID, simpler account recovery and deletion, and reliable shared entitlement identity. Costs: an authentication outage or account suspension affects the constellation, and authorization boundaries must be maintained rigorously with RLS/RPC tests.

### Separate Supabase projects with identity federation — deferred

This gives stronger infrastructure isolation and independent blast radii, but introduces account linking, token exchange, deletion orchestration, duplicate identities, and entitlement reconciliation. It is disproportionate while the applications have the same controller, account policy, and support organisation.

### One shared account plus unrestricted shared product tables — rejected

This is simpler operationally but violates the intended product boundary. A valid Lucid session must not imply that journal records are part of Lucid Trainer's normal processing purpose.

## Required controls

1. Present the account as a “Noctalia account” and explain that deletion of the complete account affects the ecosystem.
2. Keep “delete Lucid Trainer data” distinct from “delete the complete Noctalia account”.
3. Maintain per-purpose consent fields; signing in is never analytics consent or consent to transfer a result.
4. Test every Lucid table/RPC with two authenticated users and unauthenticated access before release.
5. Revoke `PUBLIC`/`anon` function execution, restrict writes to validated RPCs, and keep RLS forced on Lucid tables.
6. Never authorize from user-editable `user_metadata`; subscription authority remains server-owned `app_metadata` plus RevenueCat verification.
7. Keep app-specific OAuth clients, redirect allowlists, store identifiers, and RevenueCat public SDK keys.
8. Make account-wide export/deletion cover every product domain and keep product-only deletion available.
9. Document retention and incident impact at ecosystem and product-domain levels.
10. Add and verify Sign in with Apple before enabling Google in the iOS candidate, unless a documented Guideline 4.8 exception has been accepted for this exact app.

## Consequences

The user experiences one account and one Plus identity across the Noctalia constellation. Product data does not silently merge, and each application can still be used or removed independently. Operations must treat Supabase Auth as shared critical infrastructure and must not deploy a Lucid migration or provider configuration without two-user isolation, deletion, account-switch, and entitlement tests.

## References

- [Supabase Auth architecture](https://supabase.com/docs/guides/auth/architecture)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [RevenueCat customer identification](https://www.revenuecat.com/docs/customers/identifying-customers)
- [RevenueCat entitlements across apps](https://www.revenuecat.com/docs/getting-started/entitlements)
- [EDPB data-protection principles](https://www.edpb.europa.eu/topics/key-gdpr-concepts/basic-principles_en)
- [CNIL mobile-app privacy recommendations](https://www.cnil.fr/fr/recommandations-applications-mobiles)
- [Apple App Review Guidelines, section 4.8](https://developer.apple.com/app-store/review/guidelines/)
