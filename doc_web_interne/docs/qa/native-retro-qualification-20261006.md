# Native retrospective implementation — 2026-10-06

The exact local evidence contains **30 unique passed target/test/agent IDs**,
36 passed executions across nine qualifying selections and 67 verified
screenshots. Every contributing report has SDK exit0, complete cleanup,
secondaryErrors0, stable source/output snapshots and matching installed binary
hashes before and after. No model or retry was used. The initial red reports and
MCP inspections remain separate and do not contribute to the union.

Evidence archive (outside Git, under the delivery workspace):
`retro-implementation-2026-10-06/noctalia/native-final-770c9ec9/manifest.json`.
Its SHA256 is `a395cc8342c984e5642bf6da73ecc6bd901bf122f38ef8008b53d1c6de31d7a3`.
The manifest retains exact report/collection/file hashes, source/build versions,
profiles, binary/installed identities, commands and the exact passed-ID union.

## Qualifying contexts

| App / platform | Exact selection | Passed | Test source | Build source |
| --- | --- | --- | --- | --- |
| Dreamer Android | mock ON, seven base bodies | 7/7 | e79ec012 | 1554db8e |
| Dreamer Android | production OFF, seven selected including one declared story skip | 6/6 executed | 1e243689 | 3ad97dab |
| Dreamer Android | two Journal concurrency invariants | 2/2 | 3ad97dab | 1554db8e |
| Dreamer iOS Simulator | mock ON, seven base bodies | 7/7 | 3ad97dab | 1554db8e |
| Dreamer iOS Simulator | two Journal concurrency invariants | 2/2 | 770c9ec9 | 1554db8e |
| Lucid Android / signed iOS Simulator | local onboarding/activation/restart/tabs | 2/2 each | 1e243689 | 1554db8e |
| Meditation Android | onboarding, breathing, language, bundled session | 4/4 | 2a875da4 | 530abcd9 |
| Meditation iOS Simulator | same four bodies | 4/4 | 2a875da4 | 855ebcb8 |

The whole Lucid and Meditation test files are byte-identical at the final test
source. The retained Dreamer selections have unchanged executed paths: later
Plus/sign-in readiness is Android-only, and UIKit transcript selection affects
only the separately qualified iOS Journal body. App/native/binary equivalence
was independently rechecked using the canonical Release guard before archival.
The archive does not relabel an older SDK report with a newer commit.

Targets were the owned Pixel_9_API_37 / emulator-5588 and the dedicated
Noctalia_Native_QA Simulator. One worker/device and `app.open()` at each test start.
The metadata locale slot is not a forced native locale; the native language body
asserts its actual language transitions. Browser EN/FR/DE ON and EN OFF remain
separate CI partitions with their own union and app.log per run.

## Applied changes and preserved decisions

The canonical runner verifies the complete public SDK report, every executed
step passed, secondary errors, cleanup, requested media and actual artifact bytes.
It archives the binary before writing the Release receipt, records the installed
APK or whole Simulator app hash, compares start/end source inputs, and distinguishes
the site's explicitly generated outputs. Runtime pins and existing dependency,
prebuild, ownership and CI mechanisms are reused.

By owner decision2026-10-06, installation/hash failures are collected independently
and SDK continues on an already approved owned QA target. They cannot produce an
application-qualified verdict. A missing/invalid known build receipt, incompatible
profile or foreign target remains a prerequisite refusal. After process completion
only the wrapper's own lock is released even when resource cleanup is unproven;
that cleanup remains a red diagnostic. Foreign sessions/recorders are untouched.

Journal's native journeys witness the real categorization pending state before
editing, then its completion while the exact draft stays in the same editor,
save/reopen through Journal and isolation from another entry. The bounded30s
categorization delay applies only to the explicitly identified persistent mock
profile. The iOS editor gained bounded keyboard layout and a real localized Done
control. Long multiline replacement uses the observed UIKit Select All/Cut menu
(with at most one real next-page action), asserts empty, then fills the original
exact value. No coordinates, arbitrary sleeps or test retries were added.

A real pre-Journal launch failure contained an embedded Lucid marker in Dreamer's
bundle. Metro's public cacheVersion now includes deterministic profile input
hashes while preserving the upstream seed. New Dreamer/Lucid Release bundles were
rebuilt and their compiled variant markers checked. The initial crashes, failed
fill suffix and menu pagination errors remain archived. Android drawer taps gained
visible/enabled synchronization; the first no-op tap's animation/loading cause
remains unproven.

## Limits retained

No physical target was usable: Android inventory contained only emulators and
the paired iPhone's tunnel was unavailable. A physical work package still needs
connection/unlock/trust/data ownership and matching signed profile; no phone was
installed, erased or taken. SDK0.18 screenrecord ownership failures remain open;
these selections qualify screenshots/UI without claiming stable video recording.

Dreamer mock services/persistence are explicit, Lucid's local mock profile retains
signed iOS entitlements for encrypted storage, and Meditation uses bundled audio.
Android production Store-unavailable UI is distinct from real transactions.
There is no claim for pixel parity, physical performance/audio/microphone,
production authentication Keychain, cloud synchronization, real providers,
purchases/restore/entitlements, push/background or HealthKit. Existing browser,
Playwright/Maestro/backend required coverage remains until native equivalence.

Final CI (all four Dreamer partitions, Lucid, Meditation, site, legacy/backend and
quality) and exact merged-main production READY/alias verification are separate
orchestrator checks. A PR report or old deployment is not that proof.
