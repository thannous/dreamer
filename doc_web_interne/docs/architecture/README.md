# Architecture Remediation Specs

This folder contains implementation specs for the top architecture failure modes identified from the repo.

## Specs

- [01-api-chokepoint-and-async-ai.md](./01-api-chokepoint-and-async-ai.md)
- [02-durable-sync-and-convergence.md](./02-durable-sync-and-convergence.md)
- [03-subscription-entitlement-convergence.md](./03-subscription-entitlement-convergence.md)
- [04-database-contract-and-schema-drift.md](./04-database-contract-and-schema-drift.md)
- [05-guest-session-and-quota-hardening.md](./05-guest-session-and-quota-hardening.md)

## Scope

These specs are based on confirmed repo evidence in:

- `hooks/useDreamJournal.ts`
- `hooks/useDreamPersistence.ts`
- `hooks/useOfflineSyncQueue.ts`
- `services/geminiServiceReal.ts`
- `services/subscriptionSyncService.ts`
- `services/quota/RemoteGuestQuotaProvider.ts`
- `services/quota/SupabaseQuotaProvider.ts`
- `supabase/functions/api/*`
- `supabase/functions/revenuecat-webhook/index.ts`
- `supabase/migrations/*`

They are written as internal implementation docs, not user-facing product documentation.
