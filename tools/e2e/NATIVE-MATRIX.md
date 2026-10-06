# Native qualification matrix

The current exact verdict is the immutable run manifest identified in the
[current delivery report](../../doc_web_interne/docs/qa/native-retro-qualification-20261006.md). This matrix describes source selection and invariants, not a pass count.
Each selected test starts with `app.open()`, uses one worker on one disposable
owned target, and performs exact assertions on an identified installed Release.

| App | Platform | Profile | Invariants / runnable bodies | Explicit limits |
| --- | --- | --- | --- | --- |
| Dreamer | Android | production-apk, story OFF | Capture onboarding/empty save/mode draft, French + themes + restart, language row, drawer bounds/backdrop/settings, account destination, Plus offer closure (6) | Store error is environmental; no purchase/provider/backend proof |
| Dreamer | Android + iOS Simulator | mock-persistent, story ON | Same six invariants plus feature-story Capture→Explorer (7 per platform) | Synthetic account/catalogue, local storage; no real entitlement |
| Dreamer | Android + iOS Simulator | mock-persistent, 30000ms categorization opt-in | Metadata draft and transcript draft survive same-entry background completion, exact save/Journal round-trip, another entry receives its own draft (2 per platform) | Real mock update witnessed pending before edits; no production timing claim |
| Lucid | Android | lucid-mock | Both intention/experience required; local plan activation + restart + tabs (2) | No real cloud/account sync or native full historical browser parity |
| Lucid | iOS Simulator | lucid-mock, signed | Same two invariants with SecureStore restart (2) | Local ad hoc signature and existing entitlements; no fallback or Store profile |
| Meditation | Android + iOS Simulator | meditation-local | Onboarding/restart/all tabs, breathing start/pause/resume/exit, language immediate/restart, bundled session play/seek15s/resume (4 per platform) | Bundled audio/local storage; no purchase, entitlement or physical audio proof |
| All | Physical Android + iOS | unavailable until protocol ready | No selected journey and no claimed pass | Inventory is read-only; pairing alone is insufficient |

The historical browser campaign additionally checks responsive geometry, layouts,
subscription mock scenarios, Explorer/reflection/symbols, detailed Lucid programs,
Journal account isolation, quotas and other browser-specific cases. Those invariants
remain covered in their relevant web/native suites; a native gap does not block an
unrelated feature or framework adoption. Revise an obsolete expectation with its
current product reason and preserve its historical result. Keep required CI and
still-relevant assertions until their reviewed replacement passes. A platform/profile
skip is a declared gap, not equivalent coverage. Screen
pixels, timing on physical hardware, real providers, feedback and purchases need
their own authorized work packages.

## Target and build prerequisites

Use the existing device protocol to inventory read-only (`adb devices -l`, bounded
`xcrun devicectl list devices --timeout 10`). Native automation accepts only a named
emulator or available Simulator through the repository runner. A real phone also
needs a live connection, unlocked/trusted state, Developer Mode, app-specific data
ownership, matching signed build/profile and explicit acquisition under that
protocol. Do not install, erase or take a private phone from an inventory result.

If no compatible project exists, requested native implementation/QA includes the
necessary generation in its isolated worktree, after SDK/profile checks, preferably
with `prebuild --no-install`. Do not regenerate the primary or another task's project
or request the same permission again. Existing isolated Lucid Android/iOS and
Meditation iOS generation provenance stays with their native inputs. Dependency check, Java17
for Android, Xcode/Pods for iOS, embedded JS/OTA identity, actual signing where
SecureStore is required, and a successful canonical `release.json` precede install.
An invalid build/profile/device refuses before SDK. By owner decision2026-10-06,
installation/hash failures become diagnostics and SDK continues on the owned QA
target; the final application verdict remains nonqualifying. This wrapper
releases its own lock after process completion even if cleanup is unproven,
retaining diagnostics without taking or killing an unknown resource.
