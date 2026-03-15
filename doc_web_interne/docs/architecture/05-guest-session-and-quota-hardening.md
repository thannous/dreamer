# Spec 05: Harden Guest Session Issuance and Make Guest Quota Failure Modes Explicit

## Verification Snapshot (2026-03-15)

### Confirmed

- `lib/guestSession.ts` is still the client bootstrap point for guest-session creation and refresh.
- `supabase/functions/api/routes/guestSession.ts` still enforces platform-specific guest-session issuance rules.
- `supabase/functions/api/lib/guards.ts` still rejects missing or invalid guest tokens on protected guest routes.
- Guest AI/chat/image access is still server-authoritative through `/guest/session`, `/quota/status`, and per-route guest token verification.

### Inferred

- The app still supports a local-only guest recording path independent of server guest bootstrap.

### Wrong / stale

- The old permissive fallback described in this spec is no longer the current client behavior for costly guest actions.
- `services/quota/RemoteGuestQuotaProvider.ts` now fails closed into explicit degraded guest mode when guest bootstrap or remote quota is unavailable, while keeping local recording available.
- `hooks/useQuota.ts` now surfaces degraded bootstrap state into guest gating, so guest analysis/exploration no longer default to optimistic availability when bootstrap is already unhealthy.
- Platform support is currently narrower than a generic "guest mode" description suggests: web remains local-only because the client does not bootstrap guest sessions there, and non-Android native platforms depend on the backend allowing insecure guest session issuance.

## Problem

Guest access depends on a fragile chain:

- device fingerprint generation
- Play Integrity preparation and token minting on Android
- guest token issuance by `/guest/session`
- guest token verification on every protected backend route
- server-side guest quota RPCs
- client-side fallback quota logic when remote checks fail

Confirmed evidence:

- `lib/guestSession.ts` creates and refreshes guest headers
- `supabase/functions/api/routes/guestSession.ts` can disable guest sessions per platform
- `supabase/functions/api/lib/guards.ts` rejects missing or invalid guest tokens
- `services/quota/RemoteGuestQuotaProvider.ts` falls back to local guest quota state when the endpoint is unavailable

This creates inconsistent behavior: the app may believe a guest action is allowed while the server later rejects it, or expensive guest actions may fail with generic auth errors.

## Goals

- make guest capability explicit by platform and backend state
- reduce false positives where the UI says an action is allowed but the server rejects it
- keep server-side quota authoritative for expensive guest actions
- provide a clear degraded mode instead of silent fallback

## Non-goals

- removing guest mode entirely
- requiring authentication for basic local dream recording

## Target Architecture

## 1. Define a guest capability matrix

Document and encode per-platform support:

- local recording allowed without server
- guest analysis requires valid guest session plus server quota
- guest chat requires valid guest session plus server quota
- guest image generation requires valid guest session plus server quota

If guest session bootstrap is unavailable, the app should switch to `guest-local-only` mode, not pretend full guest AI features are available.

## 2. Add explicit guest bootstrap state

At app start, resolve:

- `guestBootstrapStatus = 'ready' | 'degraded' | 'disabled'`

Rules:

- `ready`: guest token and remote quota endpoint available
- `degraded`: local recording allowed, AI/chat/image disabled
- `disabled`: guest mode hidden entirely for this platform/build

Expose this state to quota and feature gating instead of letting each call discover failure independently.

## 3. Remove permissive fallback for costly guest actions

Current remote guest quota fallback is too optimistic for AI actions. When remote guest auth or quota is unavailable:

- allow local dream recording only
- block analysis/chat/image with a specific degraded-mode error

Do not silently rely on local counters for actions whose cost is enforced server-side.

## 4. Strengthen session refresh semantics

Add:

- dedicated error codes for `guest_session_unavailable`, `guest_session_expired`, `guest_platform_unsupported`
- jittered refresh with a small retry budget before surfacing degraded mode
- telemetry for session creation success rate and invalid-session rejection rate

## 5. Cache the last known remote guest quota conservatively

Cache remote guest quota for UX hints only, not authorization.

UI may display last-known usage, but the app must still require fresh guest session readiness before attempting expensive actions.

## Implementation Plan

## Phase 1

- add `guestBootstrapStatus` to app state
- change feature gates to use it

## Phase 2

- remove permissive local fallback for analysis/chat/image
- keep local-only recording path for degraded mode

## Phase 3

- add telemetry and platform-specific diagnostics for Play Integrity and guest token issuance

## Observability

Track:

- `/guest/session` success rate by platform
- invalid guest session responses by route
- percentage of users in degraded guest mode
- mismatch rate between quota precheck and server rejection

Alert when:

- Android guest session success rate drops below 98%
- degraded guest mode exceeds baseline by more than 5x

## Acceptance Criteria

- if guest bootstrap fails, the UI clearly disables analysis/chat/image instead of failing later with generic 401/403s
- quota precheck and server-side authorization no longer disagree for guest AI features
- support/debug logs can distinguish Play Integrity failures from general backend outages

## Risks

- degraded-mode gating is a product change and may reduce guest conversion if messaging is poor
- platform-specific integrity issues may need separate handling on Android vs web/native dev builds

## Open Questions

- whether iOS and web should support guest AI at all in production
- whether guest session health should be precomputed once per launch or refreshed continuously
