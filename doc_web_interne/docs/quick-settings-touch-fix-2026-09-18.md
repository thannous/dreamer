# Android quick-settings touch routing — 2026-09-18

## Problem and correction

On the Motorola Edge 60 Fusion, tapping **Tous les paramètres** shortly after
opening the quick-settings drawer could close it without navigating. Temporary
handler instrumentation confirmed that the close handler ran without the settings
button handler. A settled drawer could navigate normally.

The Android build enabled Reanimated's `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`.
This fast path applies animated transforms without the normal shadow-tree commit;
Reanimated documents its effect on touch detection. Disable this opt-in Android
flag so touch hit testing stays aligned with the transformed drawer. Other flags
and iOS are unchanged. The drawer's navigation and animation code are unchanged.

Reference: https://docs.swmansion.com/react-native-reanimated/docs/guides/performance/#low-fps-when-running-multiple-animations-at-once

A native rebuild is required; JavaScript refresh alone cannot apply this flag.
The tradeoff is giving up the Android synchronous UI-prop optimization. This is
functional debug-device evidence, not a release performance qualification.

## Device evidence

- Base source: master `d4121314b`; package `com.tanuki75.noctalia`, debug 3.3.0 (68).
- Physical device: Motorola Edge 60 Fusion, Wi-Fi ADB; Metro 8084.
- Before: reproduced a drawer close with no settings-handler call, including
  an app-open-to-button delay of one second.
- After: rebuilt arm64 debug APK successfully; CMake configuration explicitly
  contains `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS:false`.
- Installed with `adb install -r` after a readable private-data backup; no
  uninstall or data clearing for this fix.
- Five consecutive drawer-to-settings cycles passed, tapping the button 350 ms
  after opening. Each cycle checked `screen.settings` in the physical UI tree,
  with `quick-settings.drawer` absent; returned to the originating screen between
  cycles. The final screen is Settings.
- Temporary tracing removed. No transcripts, account details, private backups,
  or device screenshots are committed.
