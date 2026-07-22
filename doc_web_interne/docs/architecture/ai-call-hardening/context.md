# AI Call Hardening Evidence Context

This is working context for the 2026-07-22 architecture and abuse-control review.

- Source root: `/Users/tanuki/Documents/dreamer`
- Git revision: `5a675e0d2d6ff164e3b43f6c28216fa602c14c8b`
- Evidence collection SHA-256: `b00837e3c7968f3bf46eca3353eecda08aa2db4c5612a153f9bf7dc7028c1c6c`
- Source drift: present, limited at audit start to user-owned changes in `hooks/useRecordingSession.ts`, `hooks/__tests__/useRecordingSession.test.ts`, and `services/nativeSpeechRecognition.ts`
- Constraint: preserve those voice-path changes and keep native speech recognition as the primary path

## Evidence Inventory

| Evidence | Title | Source |
| --- | --- | --- |
| `E-SAVE` | AI categorization blocks durable save | `app/recording.tsx`, `hooks/useDreamSaving.ts` |
| `E-ORCH` | Client owns analysis state and multiple sync round trips | `hooks/useDreamJournal.ts` |
| `E-PROMPT` | Analysis image prompt is discarded and regenerated | `supabase/functions/api/routes/dreams.ts`, `hooks/useDreamJournal.ts`, `supabase/functions/api/services/imagePipeline.ts` |
| `E-QUEUE` | Durable and idempotent image job boundary already exists | `supabase/migrations/20260316120000_create_ai_jobs.sql`, `supabase/functions/image-job-worker/index.ts` |
| `E-POLL` | Fixed polling ends with a full journal reload | `hooks/useDreamJournal.ts`, `services/supabaseDreamService.ts` |
| `E-QUOTA` | Authenticated quota status fans out across several reads | `services/quota/SupabaseQuotaProvider.ts` |
| `E-RETRY` | Paid routes have inconsistent idempotency and retry behavior | `lib/networkPolicy.ts`, `services/geminiServiceReal.ts` |
| `E-INPUT` | Server input bounds are uneven across costly routes | `supabase/functions/api/routes/dreams.ts`, `imageJobs.ts`, `chat.ts`, `transcribe.ts` |
| `E-CHAT` | Chat rewrites the whole JSON history before and after generation | `supabase/functions/api/routes/chat.ts` |
| `E-GUEST` | Costly guest access is bound to a signed guest session and server quotas | `supabase/functions/api/lib/guards.ts`, `guestToken.ts`, quota migrations |

The collection digest was computed from the listed implementation and migration files. No production latency, cost, queue-depth, or abuse telemetry was available in the repository, so performance and abuse-volume conclusions remain source-derived or hypothetical until measured.
