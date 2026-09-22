# Native dependency patches

`npm install` / `npm ci` run patch-package with errors treated as build failures. Patch files are native runtime inputs: Expo fingerprint includes this directory and the release planner routes them to the root Noctalia/Lucid package. The separate Meditation package is unaffected.

## react-native-enriched-markdown 1.0.2

Android GitHub-flavor measurement previously reused dimensions only for streaming text, despite storing dimensions for static text too. The patch enables the same content/style/font-scale/width cache check for static text. Break-strategy changes invalidate the view entry. Existing image-geometry invalidation, font-scale reset and disposal remain in the library.

Regression tests and their invocation are in `tests/android/markdown-cache/README.md`. They use real Kotlin measurement and Robolectric Android text layout with only JNI parsing substituted. Recheck these contracts when upgrading the library; do not discard a failed patch automatically.
