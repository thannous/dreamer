# Worklets Android lifecycle backport

Backport of https://github.com/software-mansion/react-native-reanimated/pull/10196 (merged commit 22498ac2c44878bfa97952569c24e61fe175e8e5) to the Expo-pinned Worklets 0.10.1, in both networking variants.

It registers the lifecycle listener, unregisters on invalidation, and protects pause/resume against invalidation. It does not change the foreground UI-runtime loop: maintainers intentionally retain it to process Shared Value microtasks (https://github.com/software-mansion/react-native-reanimated/pull/8900). React Native's separate foreground callbacks are tracked in https://github.com/react/react-native/issues/58367 and remain outside this patch.

With an already prepared Android project:

```sh
cd android
./gradlew -p "$PWD" --init-script ../tests/android/worklets-lifecycle/init.gradle :react-native-worklets:testReleaseUnitTest --tests '*WorkletsLifecycleTest'
```

The actual module and frame queue are tested. Robolectric substitutes JNI scheduler construction, and the device choreographer is mocked. Tests cover lifecycle registration/removal, disarming/rearming queued frames, and late resume after invalidation. Phone pause/resume qualification remains separate.
