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
