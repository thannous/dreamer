# Mobile Security Audit - Noctalia Expo App

Last updated: 2026-11-19

## Scope

This audit covers the Expo/React Native mobile app and the mobile-facing Supabase/RevenueCat paths:

- Expo app config, EAS build profiles, EAS Update boundaries, and public client configuration.
- Local storage for sessions, guest state, dreams, transcripts, quotas, and cached user data.
- Supabase auth, Edge Functions, RLS assumptions, guest sessions, Play Integrity, and RevenueCat webhooks.
- Android/iOS permissions, deep links/App Links, release profiles, and production logging.
- Dependency and release-artifact checks that must run before app-store submission.

The baseline is OWASP MASVS, with emphasis on `MASVS-STORAGE`, `MASVS-AUTH`, `MASVS-NETWORK`, `MASVS-PLATFORM`, `MASVS-CODE`, `MASVS-RESILIENCE`, and `MASVS-PRIVACY`.

The [system-wide threat model](#system-wide-threat-model) extends these mobile controls to
Dreamer, Lucid, Meditation, the backend, public site and delivery tooling. It records
owner-confirmed priorities and source observations, not a certification of deployed controls
or complete scan coverage.

## Quick Start

Run the local audit:

```bash
npm run security:audit:mobile
```

Run the CI/blocking variant:

```bash
npm run security:audit:mobile:strict
```

Run the broader release checks around it:

```bash
npm run lint
npm run typecheck:app
npm test -- --runInBand --watch=false --no-watchman
npm audit --omit=dev --audit-level=high
npx expo install --check
npx expo-doctor
npm run android:gates:strict
```

Use `npm run security:audit:mobile -- --json` when another tool needs machine-readable output.

## Current Security Model

### Public Client Configuration

All values exposed through `EXPO_PUBLIC_*` or `expo.extra` are readable from the client bundle. They must be treated as public values even when they look like API keys.

Expected public client values include:

- Supabase URL and anon/publishable key.
- RevenueCat public SDK keys.
- Google OAuth client IDs.
- Play Integrity cloud project number.
- API base URL.

High-risk values include anything named like `secret`, `token`, `jwt`, `private`, or `service_role`. If such a value is intentionally public, the server-side policy must be documented and verified. The current audit script flags token-like `expo.extra` values so reviewers do not accidentally treat them as secret.

### Storage

Native Supabase sessions should stay in `expo-secure-store`. AsyncStorage and SQLite/KV storage may be acceptable for non-sensitive flags and cached state, but every use must be reviewed against dream text, transcripts, account identifiers, quota state, and auth/session material.

Sensitive storage review questions:

- Is the value a token, refresh token, guest token, or credential?
- Does it contain dream content, transcript text, generated analysis, or personal metadata?
- Can it survive logout, uninstall, backup/restore, or account switching?
- Is the server the source of truth, or can a local tamper bypass quota/payment/auth?

### Network and Backend

The mobile app must use HTTPS for non-local API calls and must not attach Supabase auth headers to non-local cleartext HTTP. Backend checks must confirm:

- Supabase RLS policies enforce per-user access.
- Edge Functions validate authenticated, guest, anon, and service-role paths separately.
- Guest AI/chat/image actions require backend-issued guest sessions.
- RevenueCat webhooks require explicit authorization.
- Response bodies and backend internals are not surfaced through generic user-visible errors.

### Platform and Release

Android release expectations:

- `android.allowBackup=false`.
- Minimal permissions: microphone and audio settings only when justified.
- App Links use HTTPS and `autoVerify`.
- Release profiles do not enable mock mode.
- Production Play Integrity and RevenueCat flows are verified from Play-installed builds.

iOS release expectations:

- Microphone and speech usage descriptions are present.
- Associated Domains match `dream.noctalia.app`.
- Keychain/SecureStore behavior is understood during uninstall/reinstall.
- Universal links are tested with real associated-domain files.

### System-wide threat model

#### Scope and evidence

- System: Noctalia Dreamer, Lucid, Meditation, backend, public site and delivery tooling in [thannous/dreamer](https://github.com/thannous/dreamer).
- Scope: whole repository. No paths or attacker classes are excluded; no risks are accepted.
- Initial context inspected at revision `2d097c84666d626243e068c5302cfe27d85b7bc7`; targeted architecture/control changes reviewed at `9fd3e5325fb6d4a965180ef7f5fbd3dc0d6fcca2` on the default branch `master`. These revisions describe threat-model evidence, not proof of production state or the revision covered by a particular scan run.
- Existing owner-maintained baseline: the mobile controls above. Its documented priorities include sensitive storage, per-user authorization, guest admission, service-role secrecy, payment integrity, secure transport and privacy-preserving logs.
- Additional system contracts: [README](../../README.md), [backend entry point](../../README_BACKEND.md), [Meditation guide](../../apps/meditation/AGENTS.md) and [analytics privacy assessment](product-analytics-privacy-assessment.md).
- Deployment context exists in this repository: `supabase/config.toml`, `supabase/migrations/`, Edge Function entry points, `vercel.json`, `app.config.ts`, `eas.json`, publication scripts and site-media configuration. No separate infrastructure repository was used. Live cloud configuration, secrets, storage ACLs, deployed versions and provider contracts were not independently inspected.

#### System overview and trust boundaries

Dreamer records voice/text dreams, synchronizes a private journal and requests AI analysis, conversation and images. Lucid shares the root runtime but has product-specific identity and data flows. Meditation is a separate local-first app, not a Supabase-backed copy of Dreamer. Public editorial content is built separately.

Untrusted native/browser clients call public Supabase authentication, Data API/storage and Edge Functions. The shared API validates identity or a backend-issued guest session before privileged operations. API code, database security-definer functions and background workers cross into service-role authority. Workers and API services call external AI/transcription providers; RevenueCat and app stores form a separate purchase/entitlement boundary. Client-side flags, quota counters, request product IDs and public configuration are not authority.

Native app storage is separated from OS credential storage; browser storage, deep links and OAuth/reset callbacks are additional untrusted-input boundaries. Build/signing/publication credentials cross from developer tooling into distributed app/site artifacts. Checked-in configuration describes intended behavior, not necessarily the production deployment.

#### Stable components

Use these exact names for the finding's `Component` tag; choose the component owning the root cause, not merely the affected caller.

| Component | Code and responsibility |
| --- | --- |
| Dreamer-Lucid Client | `app/`, `routes/lucid/`, `components/`, `hooks/`, `context/`, `lib/` and `services/` excluding the identity/billing ownership below. Journal capture, local persistence, sync, imports, notifications, local voice and device integration. |
| Identity & Admission | `lib/auth*`, `lib/supabase.ts`, `lib/guestSession.ts`, `services/productOAuthNativeStorage.ts`; API `router.ts`, `lib/authHeader.ts`, `lib/productAuthorization.ts`, `lib/guards.ts`, guest-token/attestation/Turnstile helpers and guest/session/account/auth route modules. Login, recovery, product scoping, guest admission and account lifecycle. |
| Public API | `supabase/functions/api/routes/` and API libraries not otherwise assigned; `capture-recall/` and `illustration-hd/` entry points. Public AI/transcription/chat/analytics/quota endpoints, input handling and authorization at the API boundary. |
| Data Plane | `supabase/migrations/`, `supabase/legacy_migrations/`, `supabase/db-contract.manifest.json`, `supabase/types/` and `supabase/config.toml`. Postgres/RLS, grants, RPCs, storage policy, guest subjects, quota state and durable job ownership. Historical migration files are not proof of a currently exposed object. |
| AI Workers | `supabase/functions/analysis-job-worker/`, `image-job-worker/` and shared AI execution/provider/job services. Privileged durable analysis/image execution, retries, provider calls and output storage. |
| Billing | `supabase/functions/revenuecat-webhook/`, API subscription routes and subscription/RevenueCat libraries, `lib/revenuecat.ts` and client subscription/quota providers. Store/RevenueCat-to-server entitlement convergence and server-authoritative paid access. Database policy root causes remain Data Plane. |
| Meditation | All `apps/meditation/`. Separate Expo app with local AsyncStorage state, bundled audio, purchase integration and subscriptions disabled by default; no application account/backend according to its maintained guide. |
| Web & Delivery | `docs-src/`, canonical `data/`, `public/`, `widgets/`, `app-intents/`, `plugins/`, `scripts/`, `script/`, `tools/`, `fastlane/`, `release/`, app/build/OTA/hosting configuration and repository automation. Public site/media, packaging, signing and release supply chain; shared platform extensions are included here. |

#### Entry points and reachability

- Anyone on the internet can reach public app/site pages and deployed Edge Function URLs; clients can construct requests without using the official UI.
- `supabase/functions/api/routeTable.ts` defines guest-session/challenge, guest QA, analytics, account deletion, Apple token storage, subscription, quota, chat, recall, analysis, transcription, image and durable-job APIs. Reachability is not authorization: handlers distinguish guest, authenticated and privileged callers.
- `supabase/config.toml` disables platform JWT verification for the API, capture-recall, illustration-hd, both workers and RevenueCat webhook. Their application-level checks are therefore the relevant boundary.
- Supabase auth redirects, deep/universal links and password recovery callbacks process attacker-supplied URLs. Data API/RPC and object access rely on database grants, policies and verified identities, independently of the UI.
- RevenueCat sends external webhook requests; scheduled/internal job dispatch reaches publicly addressable worker functions that must enforce privileged authorization.
- Import files, dream/chat text, voice input, image prompts, analytics bodies and provider responses are untrusted. Local storage or tampered clients must not establish identity, product ownership, entitlement or quota authority.

#### Assets and sensitivity

1. **Private personal content:** dreams, transcripts, analysis, chat, images, journal metadata and Lucid reflection/voice data. Exposure, cross-account access and retention after logout/deletion matter. The README states voice recordings are used for transcription and not stored, and journal data is hosted in the EU; these are owner-stated expectations, not verified production facts.
2. **Credentials and identities:** access/refresh and Apple provider tokens, guest signing secrets, service-role/provider/webhook credentials, device attestation keys, OAuth bindings and signing/publication credentials. Public Supabase anon/publishable keys, OAuth client IDs and RevenueCat SDK keys are intentionally public, not automatically leaked secrets.
3. **Economic integrity and availability:** paid entitlements, authoritative quota balances, request/admission budgets, job receipts, replay/idempotency state and external AI spend.
4. **Deletion and privacy commitments:** per-user isolation, deletion/revocation, account switching, minimal production logs and analytics constraints. The analytics assessment prohibits journal content and free text in events, requires retention/opt-out controls, and states analytics must remain disabled until its activation conditions are satisfied.
5. **Delivery integrity:** authenticated builds/OTA, release profile identity, production configuration and trusted public content. Meditation's local preferences/progress and purchases are separate from Dreamer/Lucid accounts.

#### Attackers

The owner confirmed internet attackers, malicious users and local-device attackers are relevant. The detailed working attacker profiles are: unauthenticated internet callers/bots; malicious or compromised signed-in users targeting other users or products; guest/session replay and AI-cost abusers; webhook impersonators; malicious websites/links/imports; local-device/shared-browser attackers; and supply-chain or compromised-operator scenarios where the finding states the needed access. No class has been ruled out. Third-party services are external trust dependencies, not an excuse to discount a confirmed application-side failure.

#### Existing controls observed in source

- `lib/supabase.ts` implements native SecureStore session persistence, PKCE and explicit web callback/recovery handling, including per-flow web PKCE verifier selection and isolated recovery clients in the refreshed source. Other journal/local stores must be evaluated separately; this does not claim all personal data is encrypted.
- The API router uses Supabase user lookup and product-scoped authorization, failing authentication transport outages closed. Guest guards verify signed tokens against fingerprint, platform and product.
- Guest-session routes contain Android Play Integrity, web Turnstile and iOS App Attest challenge/assertion handling. Their production settings and device proofs are unverified.
- Database migrations implement per-user policies/grants, quota/admission controls, transcript-bound analysis receipts and durable jobs. These are controls to verify, not proof that every current path is safe.
- The refreshed source adds a service-role-only subscription reconciliation cursor and paginated user RPC (`20261111090000_subscription_reconcile_paging.sql`), a per-device daily guest-chat ceiling across dream keys (`20261111100000_guest_chat_device_ceiling.sql`), and RevenueCat webhook retry handling when required provider state is unavailable (`revenuecat-webhook/verification.ts`). These source controls are not proof of deployment or of completed scan coverage.
- Both worker request handlers check authorization against privileged service-role configuration before processing jobs. RevenueCat webhook auth requires a configured secret and compares the supplied authorization value.
- Text-provider configuration uses Claude; image configuration uses Gemini. Provider credentials are server-side dependencies; user content crossing these boundaries remains sensitive.
- Repository security/release procedures require non-local HTTPS, public-client configuration hygiene, no mock mode in production, minimal permissions and protected build/publication steps. `vercel.json` disables Git-triggered deployments. These intended gates were not executed as part of drafting this model.

#### Accepted risk and exclusions

The owner confirmed the documented priorities and explicitly stated no accepted risks. Internet attackers, malicious users and local-device attackers remain relevant; there is no directory exclusion. Meditation's lack of an app backend and intentionally public keys are documented architecture facts, not blanket dismissals of bugs. Local development, test fixtures, old migrations and disabled features need the preconditions in the scanner's note; their mere presence is neither an exploit nor automatic accepted risk. This model does not authorize remediation, live attack testing or production deployment; those require separate approval.

#### Prioritization policy

Use the scanner's severity and verified exploit preconditions as the baseline. Keep it unchanged unless an explicit owner answer or maintained security-model fact changes the relevance of that attacker, surface or asset. Author-inferred architecture alone does not justify moving severity. Do not raise hard-to-exploit or unverified findings. Do not translate the older audit's P0/P1 labels mechanically into scanner severities.

For every open finding, record likelihood (the access/preconditions the scanner identified), consequence (the asset reached), the specific owner fact causing any move, and the stable component tag. If no owner fact changes either, explain that the scanner's weighing stands. Revisit only affected findings when the owner supplies new facts, or when the scanner itself re-rates them. Leave dismissed/resolved findings alone.

#### Open questions

- Owner answers recorded: internet attackers, malicious users and local-device attackers are relevant; keep the documented priorities; no accepted risks.
- No additional tag selection was provided, so Component remains the default. Optional CVE, MASVS control and owner-team mapping can be added later if requested.
- What are the actual deployed backend revision, cloud access/storage policies, enabled analytics flags, attestation settings, provider retention/residency contracts and distributed release profiles? These remain deployment-verification gaps, not findings.

## Audit Phases

### Phase 1 - Local Static Audit

Run:

```bash
npm run security:audit:mobile
npm run lint
npm run typecheck:app
npm audit --omit=dev --audit-level=high
npx expo install --check
```

Review:

- Warnings from `security:audit:mobile`.
- All `expo.extra` and `EXPO_PUBLIC_*` values.
- AsyncStorage imports and local persistence.
- Unconditional `console.*` calls in app code.
- Dependency advisories and Expo package alignment.

### Phase 2 - Backend Policy Audit

Review Supabase migrations and functions:

- RLS enabled on user-owned tables.
- No direct client access to service-role operations.
- Guest routes reject missing, expired, replayed, or mismatched guest tokens.
- RevenueCat webhook auth fails closed.
- Quotas are server-authoritative for costly actions.

Suggested abuse tests:

- Call dream APIs with no token.
- Call with another user's token.
- Call guest routes without Play Integrity-backed guest session.
- Replay old guest/session requests.
- Attempt quota bypass by editing local storage.

### Phase 3 - Device Dynamic Audit

Run on Android emulator and a physical Play-installed build:

- Inspect app logs during auth, recording, analysis, chat, paywall, restore, logout.
- Verify no dream text, tokens, raw webhook payloads, or user identifiers leak into production logs.
- Inspect local app storage after recording, analysis, logout, account switch, and uninstall/reinstall.
- Test deep links and App Links with malformed paths and returning-guest restrictions.
- Capture network traffic where legally and technically permitted; confirm HTTPS-only non-local API calls.

Run on iOS simulator/device before TestFlight:

- Verify speech/microphone prompts and denial flows.
- Test Universal Links and OAuth redirects.
- Inspect Keychain persistence expectations after reinstall.

### Phase 4 - Release Artifact Audit

For every store candidate:

- Generate the actual APK/AAB/IPA/TestFlight build.
- Inspect AndroidManifest.xml/Info.plist permissions and URL schemes.
- Search bundled JS/native strings for unexpected credentials or debug endpoints.
- Confirm EAS channel, runtimeVersion, app version, and update branch.
- Confirm mock mode is off and production API/RevenueCat/Supabase values are selected.

## Finding Severity

Use this scale in reports:

- `P0`: exploitable secret, auth bypass, cross-user data access, payment bypass, or public service-role material.
- `P1`: sensitive local storage exposure, weak backend policy, production debug leak, insecure transport, unverified webhook auth.
- `P2`: release hardening gap, broad permission, incomplete deep-link validation, dependency advisory with plausible exploit path.
- `P3`: documentation, observability, missing manual evidence, or low-risk configuration drift.

## Deliverables

Each complete audit should produce:

- A report with finding ID, severity, evidence, affected files/routes, exploit story, and fix owner.
- A release checklist update if the issue can recur.
- Tests or an automated check for every fix that can be verified locally.
- Manual evidence for Play Console, EAS dashboard, Supabase secrets, and device-only checks.
