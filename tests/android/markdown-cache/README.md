# Android Markdown measurement regression tests

With the project's Android directory already prepared and dependencies installed:

```sh
cd android
./gradlew -p "$PWD" --init-script ../tests/android/markdown-cache/init.gradle :react-native-enriched-markdown:testReleaseUnitTest --tests '*MeasurementStoreCacheTest'
```

The Gradle init script adds host-test dependencies and test sources for this invocation only; it does not modify the library's build configuration or the app APK. Robolectric executes the actual Kotlin measurement/cache and Android text layout. Only md4c JNI parsing is replaced with a paragraph AST, because Android shared libraries cannot execute in the host JVM.

The tests cover static cache reuse with independently created equivalent props, width/text/style/font-scale changes, maximum height, explicit invalidation, disposal and text-break strategy. `style.json` contains the normalized Android defaults from react-native-enriched-markdown 1.0.2, with packed numeric colors, so the real split renderer runs instead of its fallback.

Negative control: disabling the static cache guard makes the repeated-measurement, maximum-height and unchanged-break-strategy cases fail. This is a cache correctness proof, not a phone frame-time benchmark.
