# TI-561 — Explicit post-route product bootstrap

## Delivered boundary

The root layout still waits for `startupDestinationCommitted`, then schedules work
with `InteractionManager.runAfterInteractions`. `lib/productBootstrap.ts` now
owns the executable selection and lazy loaders:

| Product | Shared Google sign-in setup | Guest session | Guest quota migrations |
| --- | --- | --- | --- |
| Journal | Yes | Yes | Analysis and dream recording |
| Lucid | Yes | No loader invocation | No loader invocation |

Each action runs independently. Synchronous exceptions and rejected promises are
reported with the action name, including Google setup (previously uncaught).
Cleanup cancels the queued interaction task; it does not pretend to abort work
that has already started. Navigation, provider order, splash timing, auth state,
and startup markers are unchanged.

## Verification

- Five focused bootstrap tests cover product selection, independent failures,
  deferred execution, scheduler cancellation, and already-started work.
- Existing two startup-paint tests pass.
- App and test TypeScript checks pass.
- Focused lint: zero errors; four existing root-layout `set-state-in-effect`
  warnings in unchanged effects.
- Import boundary checker passes (278 source files).

These tests prove invocation boundaries for this bootstrap, not absence of every
Journal import from a Lucid bundle, nor absence of all network traffic. No device,
startup timing, CPU, bundle-size or install measurement was performed for this
lot; no performance gain is claimed.

## Remaining composition inventory

The layout already excludes `DreamsProvider`, Journal reminder/analysis/speech
hosts, Journal analytics, and guest routing behavior for Lucid. Notification
route handling filters Lucid destinations. The common notification handler only
registers presentation behavior; it does not request permission at startup.

`SubscriptionProvider` remains shared. `useSubscriptionInternal` initializes the
subscription service for signed-in users, and `subscriptionSyncService` calls
`/subscription/refresh` without a product parameter. The Lucid service selection
uses the real service outside mock mode. This requires a separate product and
commercial-contract review before changing behavior; this extraction does not
claim that coupling is resolved. Shared auth setup remains intentional here.

Meditation already has a separate application composition and is untouched.
Build/install isolation and measured startup budgets remain separate TI-561 work.
