# Noctalia Lucid Trainer — architecture

**Status:** implemented in the shared worktree; release and device gates remain separate.

**Audience:** product, mobile, backend, privacy, QA, and release reviewers.

**Release runbook:** see `LUCID_TRAINER_RELEASE.md`.

**Shared identity decision:** see `LUCID_TRAINER_SHARED_IDENTITY_ADR.md`.

## Product boundary

Lucid Trainer is a wellness and skills-training companion. It helps people build daytime awareness, prepare before sleep, optionally use cautious night cues, reflect after waking, and adjust a weekly routine. It does not diagnose, treat, or guarantee lucid dreams.

Noctalia remains the journal and interpretation product. Lucid Trainer stores only training data: program progress, exercise completions, optional experience ratings, preferences, and sync metadata. Sending anything to Noctalia is an explicit action and uses a minimal summary; dream narratives never move automatically.

## Architecture decision

The first release candidate is implemented as an isolated product domain inside the existing Expo application:

- `app/lucid/`: product routes and its navigation shell.
- `components/lucid/`: native responsive UI.
- `context/LucidTrainerContext.tsx`: hydrated local state and commands.
- `lib/lucid/`: typed model, embedded content, progression, coaching, analytics policy, deep links, and cue planning.
- `services/lucidTrainer*`: storage, synchronization, notifications, and exports.

This keeps the feature testable with Noctalia's established providers while avoiding coupling it to the dream journal. A separately published companion requires both `NOCTALIA_APP_VARIANT=lucid` and `EXPO_PUBLIC_APP_VARIANT=lucid`, its own identifiers, and its own universal-link host. Store publication, signing, and provider configuration are separate release steps.

### Runtime map

```text
app/lucid/**
  -> LucidTrainerContext
       -> services/lucidTrainerStorage      local authoritative snapshot
       -> services/lucidTrainerSync         optional queued Supabase sync
       -> services/lucidTrainerNotifications owned notification family
  -> lib/lucid/content                      embedded FR/EN/ES/DE/IT copy
  -> lib/lucid/{progress,reminders,audio}   deterministic domain rules

app/ritual/[id].tsx (Noctalia lucid ritual)
  -> /lucid                                 explicit navigation only

Lucid morning handoff (explicit consent)
  -> noctalia://recording?...               installed-app path
  -> https://dream.noctalia.app/?...        public Noctalia-home fallback
```

The Noctalia ritual bridge does not copy the journal, create an experiment, or transfer dream text. It only navigates to Trainer. The reverse handoff is separately consented and carries a bounded categorical payload: technique, outcome, lucidity band, and recall band.

### Navigation and UI

`app/lucid/_layout.tsx` owns onboarding gating and the stack. `app/lucid/(tabs)/_layout.tsx` owns Today, Programs, Night, Progress, and Settings. Secondary screens are stack routes, while reality check and morning review are modal routes.

The Lucid UI reuses the application `ThemeProvider`, but keeps product tokens in `constants/lucidTheme.ts`. The Lucid preference stores `system | light | dark`; Settings writes it both to the Trainer snapshot and the shared theme preference (`system` maps to Noctalia's `auto`) so the selection has an immediate visible effect. System text scaling and screen-reader semantics remain native. The Trainer-specific reduce-motion choice is persisted in onboarding state and must be respected by every future decorative animation.

## Data ownership and offline behavior

The local snapshot is authoritative for interaction. Every write is persisted before optional synchronization. Signed-out users retain a complete local experience. Signed-in users can opt into resilient sync using the shared Supabase UUID.

Mutations carry a client request ID, entity revision, retry count, and next attempt time. Replay is idempotent. Scalar preferences use newest-revision wins; append-only completions and experiences merge by stable ID. A server conflict never discards local data: the unresolved mutation remains visible and exportable.

Settings exposes the last replay result when recovery is needed: offline state, conflicts, failed, blocked, and pending counts remain visible beside a manual retry action. The retry does not clear the local snapshot or queue.

On native platforms, the default Trainer key-value store encrypts each state and sync-queue value before it reaches SQLite. `lucidTrainerSecureStorage` uses AES-256-GCM, a device key held by Expo SecureStore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, and the complete scoped storage key as additional authenticated data (AAD). Moving ciphertext between an account state key and another account or queue therefore fails authentication. Valid legacy plaintext is migrated only after schema validation. Authenticated corruption removes only the affected key; a temporarily locked or unavailable keystore leaves ciphertext intact and surfaces a retryable load error. Web keeps its platform-storage behavior and does not inherit this native envelope.

This is application-layer protection for the local Trainer snapshot, not end-to-end encryption of Supabase or a claim that a compromised unlocked device is safe. Trainer records may contain a brief optional note. Notes remain in the encrypted native snapshot and, only when cloud sync is enabled, the private account row; they are excluded from analytics and the Noctalia handoff. Authentication tokens are not stored in Trainer records, and dream narratives do not belong to this domain.

### Settings writes

Most settings update `LucidTrainerPreferences` through `LucidTrainerContext`. Weekly target, sleep window, and accessibility are onboarding-state fields; the Settings route persists them through the same serialized storage transaction and queues the same typed `onboarding` entity when signed in with cloud sync enabled. This deliberately preserves the existing state schema instead of creating a second preference source.

Sleep-window edits validate `HH:mm` locally and expose the current IANA zone. Choosing the device zone is explicit. A successful save updates both the schedule zone and preference zone, then normal foreground reconciliation rebuilds owned reminders if the time context changed.

## Notifications and time

Schedules are stored as wall-clock intent plus an IANA time-zone snapshot. On app start and foreground, Trainer compares the zone, offset, permission, settings, and scheduled identifiers, then replaces only the `lucid-trainer` notification family when reconciliation is needed. Denied permission is a supported state with in-app fallbacks.

Reminder reconciliation never cancels the separately tagged night-cue family. The Lucid variant deliberately excludes `withDisableNotificationsBootActions` and retains the Expo Notifications integration. [Expo Notifications for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) documents that this integration adds Android `RECEIVE_BOOT_COMPLETED` to restore scheduled notifications after restart. This is source-configuration intent only: it requires a fresh native rebuild, manifest inspection, and physical-device reboot/Doze evidence before any reliability claim. Foreground reconciliation remains the recovery path for time-zone, daylight-saving, permission, and settings changes.

## Night cues

Night cues are optional, off by default, use bundled short audio, and never claim sleep-stage detection. After explicit permission and safety confirmation, eligible cues are handed to `expo-notifications` as one-off native `DATE` triggers with absolute timestamps. Delivery therefore does not require a JavaScript timer to remain active after scheduling. The cue family is independently cancellable; expired or malformed scheduled requests are discarded on restoration and are never replayed late. Android uses a channel matched to the selected sound and pre-attenuated volume band.

The plan caps requested volume, preview duration, cue duration/count, and total timer; it enforces a quiet period before timer end and blocks cues under the user's safety flags. A `DATE` trigger is not a promise of exact delivery: OS permission, focus/silent modes, battery policy, Doze, termination, reboot restoration, and vendor behavior still need rebuilt-artifact and physical-device evidence. The source configuration for bundled sounds, channels, custom-scheme visibility, and reboot restoration has no effect on an already-built native binary.

## Account, privacy, and monetization

Core training, all three programs, local history, weekly review, export, and local-only deletion do not require a subscription. Plus may add extended comparisons, additional cue presets, and cross-device sync, but never removes access to recorded local data.

For every signed-in user, full Trainer deletion is deliberately cloud-first even when the sync toggle is currently off. The authenticated `delete_lucid_trainer_data` RPC clears sync receipts, increments a per-user reset fence, and replaces every remote entity value with a revisioned tombstone; singleton onboarding/preferences tombstones force an immediate local reset. The reset generation rejects stale queued uploads from an offline device. Only after that RPC succeeds does the app cancel all owned reminders/night cues and remove the local state and queue. If cloud deletion fails or is offline, local data is preserved and the user sees an error rather than receiving a false deletion confirmation. Turning sync off merely pauses synchronization and never claims to erase a historical remote copy. Deleting the complete Noctalia account remains a distinct ecosystem action.

The companion reuses the canonical Supabase identity and its immutable user UUID, while product records remain in owner-scoped `lucid_trainer_*` tables/RPCs. This shares credentials, account recovery, account-wide deletion, and the RevenueCat App User ID; it does not share an on-device session secret or automatically expose journal content in the Lucid product flow. Each installed application retains its own secure session container.

RevenueCat should stay in the same project so the exact Noctalia Plus entitlement can span both applications, but the companion must be registered as a distinct RevenueCat app and use its own public SDK key. The Lucid Expo configuration deliberately removes inherited Noctalia RevenueCat keys. Unknown entitlement IDs never map to Plus. Purchase and restore continue through the existing accessible paywall only after a companion key is supplied.

Analytics is disabled until affirmative consent. Allowed events contain categorical product state only. Exact sleep times, free text, dream content, health data, and stable cross-app identifiers are prohibited.

Consented first-party analytics is collected on Android and iOS when the client flag is on. Ingest accepts `platform: android | ios`. Unauthenticated guest delivery remains Android-only because it is bound to Play Integrity; signed-in iOS sessions use the existing Supabase bearer. iOS guest events may queue locally and flush after sign-in, or expire with the seven-day queue TTL. App Attest for guest iOS ingest is a later release step.

## Build variants and external configuration

The default configuration remains Noctalia. A Lucid process requires two matching, non-secret variables:

- `NOCTALIA_APP_VARIANT=lucid` selects the isolated Expo/native configuration in `app.config.ts`;
- `EXPO_PUBLIC_APP_VARIANT=lucid` enables the Lucid runtime shell and Lucid-only behavior in the JavaScript bundle.

The checked-in local profiles set both. Supplying only one can produce a Lucid native identity with Noctalia runtime behavior, or the reverse, and is a release-blocking configuration error. Like every `EXPO_PUBLIC_*` value, the runtime selector is client-visible and must never contain a secret. The companion configuration declares:

- name/slug/scheme: `Noctalia Lucid Trainer`, `noctalia-lucid-trainer`, `noctalia-lucid`;
- iOS bundle: `com.tanuki75.noctalia.lucid`;
- Android package: `com.tanuki75.noctalia.lucid`;
- proposed universal-link host: `lucid.noctalia.app`;
- microphone permission disabled; background audio enabled for optional cues;
- nine short, pre-attenuated night-cue sounds registered through Expo Notifications;
- Noctalia custom-scheme visibility for iOS and Android so `canOpenURL` can choose the installed app or `https://dream.noctalia.app/` home fallback;
- Android notification boot restoration left enabled by excluding Noctalia's boot-action disabling plugin;
- no inherited EAS project or updates URL.
- no inherited Noctalia RevenueCat SDK key;
- no inherited Noctalia Google iOS URL scheme: the Google plugin is omitted until both companion web and iOS client IDs are present, and a partial OAuth configuration fails the config gate.

These values express isolation, not proof that Apple, Google, DNS, association files, RevenueCat, Supabase, signing, or store records exist. Follow the release runbook and obtain explicit authorization before any external mutation, native generation, build, deployment, or submission.

## Scientific sources and limits

Essential content cites primary or peer-reviewed sources, including the International Lucid Dream Induction Study (`10.3389/fpsyg.2020.01746`), recent systematic review (`10.1111/jsr.13786`), earlier systematic review (`10.1016/j.concog.2012.07.003`), lucid dreaming in REM sleep (PubMed `35167686`), and the AASM/SRS adult sleep-duration consensus.

Evidence remains limited, heterogeneous, and often relies on self-report and selected participants. MILD has the strongest current cognitive-technique evidence; SSILD has promising but thinner independent replication; daytime reality tests alone have inconsistent evidence. The cited studies do not establish an individual success probability, long-term benefit, frequent-use safety, or a causal interpretation of this app's personal trends. Method comparisons are descriptive within-person observations with small samples and likely confounding, never diagnosis or scientific proof.

WBTB deliberately interrupts sleep and is always optional. Native audio scheduling does not detect REM or any sleep stage. Users are told to stop if practice harms rest, mood, clarity, or daytime functioning and to seek qualified help for persistent sleep problems, severe distress, confusion between dreaming and waking, or mental-wellbeing concerns. Lucid Trainer is neither medical care nor a substitute for professional support.

The embedded structured source registry is `lib/lucid/content/references.ts`; essential localized content lives in `lib/lucid/content/{en,fr,es,de,it}.ts`. Content is bundled and does not require runtime generation or inference.

| Source | What it supports | What it does not establish |
| --- | --- | --- |
| DOI `10.3389/fpsyg.2020.01746` | Field comparison of induction combinations including MILD and SSILD | A predictable result for one person; attrition and self-report limit inference |
| DOI `10.1111/jsr.13786` | Systematic review of newer induction evidence | Equal certainty across methods or long-term safety evidence |
| DOI `10.1016/j.concog.2012.07.003` | Earlier systematic review of induction methods | A universally effective protocol |
| PubMed `35167686` | Physiological evidence that lucid dreaming occurs in activated REM sleep | That a training method will cause lucidity |
| DOI `10.5665/sleep.4716` | AASM/SRS consensus: healthy adults should regularly obtain at least seven hours | A personalized sleep prescription |

### Product claim rules

- Describe methods as practices or studied approaches, never treatments.
- Do not promise lucid dreams, dream control, sleep-stage detection, or health outcomes.
- Keep WBTB, awakenings, and night audio optional and subordinate to sleep.
- Avoid inference from a user's personal weekly sample beyond transparent, reversible coaching rules.
- Do not make core training dependent on AI, network access, or paid inference.
