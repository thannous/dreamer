# Recording save: Android Fabric crash

## Reproduction and cause

- Physical Motorola Edge 60 Fusion, base package `com.tanuki75.noctalia`, development build 3.1.0 (54), existing Metro checkout at `2a6fd2ddc`.
- Reproduced on 2026-09-16 at 22:14 Paris: Raconter → Écrire ma réponse → enter a synthetic QA story → Continuer → Terminer et enregistrer.
- Native failure: `addViewAt: failed to insert view [728] into parent [736] at index 1`; the icon's previous parent was a 214 × 214 pixel ReactViewGroup, matching the 76 dp microphone circle. The original user failure had the same structure with tags 770/772/778.
- Saving toggles the circle's opacity through disabled state. React Native's `ViewShadowNode::initialize` changes `FormsStackingContext` when opacity returns to 1. Fabric attempted to reparent the icon while it was still attached to the circle during screen replacement.

## Fix

Set `collapsable={false}` on the microphone circle so its native parent/stacking context stays stable across loading, permission preparation and persistence. No changes to persistence, dictation, navigation or appearance.

## Verification

- Repeated the same physical-device journey with the patch: journal detail opened and displayed the complete synthetic QA transcript.
- No `addViewAt` or fatal exception in the device log after the patched reload at 22:15.
- `npm run test:file -- components/recording/__tests__/RecordingConversation.test.tsx tests/app-routes/recordingScreen.test.tsx --watchman=false`: 60 tests passed.
- `npx expo lint components/recording/RecordingConversation.tsx`: passed.
- `npm run typecheck:app`: passed.
- `git diff --check`: passed.
- This is physical Android development-build evidence. No release build, Store publication, installation or production deployment was performed. Speech recognition accuracy was not under test; the regression is reproduced with a typed answer in the voice conversation.

Screenshots retained locally under `doc_web_interne/docs/qa/recording-save-fabric-2026-09-16/` (before.png, after.png); not included in this commit.

## Approved compact layout follow-up

- Removed the Noctalia title and decorative speaker row from the voice conversation.
- The central microphone now starts/resumes or mutes listening. A separate checkmark button finishes the answer, waiting for final dictation text before requesting a follow-up question.
- The pencil opens the shared compact answer editor; the entire full-width story card opens the existing manual transcript editor. The story is no longer truncated to four lines, and the save footer retains “Terminer et enregistrer”.
- Physical Motorola with Expo: verified the compact layout, tapped the story body to open the complete editable transcript, and verified the central microphone changes from “Couper le micro” while listening back to “Répondre” after muting.
- 66 focused tests passed across RecordingConversation and recordingScreen, including final dictation words before submission, mute without advancing, typed draft preservation, and tappable story editing. App and test typechecks passed. Focused lint passed; app/recording.tsx retains its two pre-existing set-state-in-effect warnings.
- Personal transcript screenshots remain local and are not committed. No native reinstallation, release build, Store submission or production deployment.

## Shared voice/keyboard answer (2026-09-17)

- A controlled current-answer field now receives both speech previews/final words and keyboard edits. Keyboard corrections replace the same answer; resumed dictation appends to it without duplicating earlier words.
- “Ton récit” displays the earlier answers while the current answer remains editable above it. The combined draft is still persisted immediately, including unfinished input, and is still included when saving the dream directly.
- Native speech ending no longer submits the answer automatically. Only “Terminer ma réponse” advances the conversation, for both input methods.
- The voice screen no longer scrolls to the bottom of the full story when the keyboard opens, which could hide the active answer field.
- 68 focused component/route tests passed; app/test typechecks passed; lint has only the two existing recording.tsx effect warnings.
- Physical Motorola Expo: current-answer field visible with keyboard; synthetic typed answer preserved through starting dictation and returning to the keyboard. Synthetic input was then cleared without saving a dream. Recognizer partial/final editing and duplicate prevention are covered by focused tests; no new spoken transcription accuracy claim.
