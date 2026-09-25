# Guest dream demo and image reading — iOS mock evidence

## Revision and environment

- Feature commit: `d88be5e3` on `codex/guest-demo-image-reading` (based on `a1c31461`, `origin/master`).
- The captured iOS journey used the same feature changes on the internal release head `78f51b29` before they were moved onto master. The final branch has passed the focused route/component tests, app/test type checks, and focused lint; the screenshots alone do not qualify the final branch as a release binary.
- iPhone 18 Pro simulator, iOS 27.0, UDID `8EFE63EB-C8DE-4240-8AC2-4E89A2AF0E19`; existing Noctalia development client `com.tanuki75.noctalia`, native version 3.4.3 (1); `.env.mock` with `EXPO_PUBLIC_MOCK_PERSISTENCE=true`. No native rebuild, EAS build, store submission, or physical-device install was performed.
- Synthetic guest dream text; no personal dream data in the captures.

## Repeat the journey

From the feature worktree, start the project with `mise exec node@24.19.0 -- npm run start:mock:dogfood -- --web --port 8093`. Open the already installed development client with:

```sh
xcrun simctl openurl 8EFE63EB-C8DE-4240-8AC2-4E89A2AF0E19 'exp+noctalia://expo-development-client/?url=http%3A%2F%2F127.0.0.1%3A8093'
```

Use a guest mock state with two analysis credits and two image credits. Complete onboarding, capture and save a new synthetic dream, then observe the journal detail and reading modal. Repeat for the second dream. The expected sequence is one automatic analysis per new saved dream, an image job queued after analysis, an animated dot field beneath the interpretation while the image is pending, and the completed image replacing it in that same position. The reference UI assertions are covered by:

```sh
mise exec node@24.19.0 -- npm run test:file -- components/analysis/__tests__/AnalysisReadingModal.test.tsx lib/__tests__/journalDreamDetailOrder.test.ts lib/__tests__/journalSavedConfirmation.test.ts tests/app-routes/journalDetailSavedConfirmation.test.tsx tests/app-routes/recordingScreen.test.tsx --watchman=false
```

## Observed result

| Assertion | Result | Evidence |
| --- | --- | --- |
| Saving each of the first two guest dreams starts analysis without another tap | Pass in the mock iOS journey | Simulator observation and route test |
| Pending image appears below interpretation with a dot field | Pass in the mock iOS journey | [Generating](evidence/guest-demo-image-reading-2026-09-25/generating.jpg) |
| The finished image replaces the pending field in the same reading slot | Pass in the mock iOS journey | [Completed](evidence/guest-demo-image-reading-2026-09-25/completed.jpg) |
| No automatic launch when guest credits are exhausted, the user is signed in, or the request is already pending | Pass in route tests | `journalDetailSavedConfirmation.test.tsx` |

The local capture video is `/private/tmp/noctalia-dots-demo.mp4` (not committed because it is 11 MB); the two committed frames above preserve the observed pending and completed states. The animation was seen in the recording; still images cannot prove motion by themselves.

## Limits

This is a mock service journey, not proof of production image generation or the iOS/Android store binaries. The app currently grants guests two analyses and two images. The final master-based revision still needs a native end-to-end run on its own binary before release qualification; the simulator text-entry automation failed to focus the input during the attempted repeat after the branch move. The reduced-motion branch is code/type checked but has not been exercised on a device with Reduce Motion enabled.
