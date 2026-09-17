# Capture adjustment — approved minimal mockup

The approved design keeps assistant questions read-only and edits only the narrator's initial account and answers. The capture pencil now opens “Ajuster ton récit” inside the capture screen, without switching to the generic Écrire textarea. Questions use subdued sans-serif text; narrative and answer inputs use borderless Lora text separated by thin rules. No per-exchange trash, numbering or outlined form controls. Tabs and bottom navigation are hidden while editing. Close and Android Back return to capture with edits autosaved. Validation prepares the existing editable review before journal saving.

Stored plain-text drafts are parsed using their six historical language label pairs. Exact question prefixes, line breaks and untouched narrative content round-trip unchanged. Incomplete/unrecognized content is preserved. Editing updates the same durable draft storage; recognition is stopped before opening so final words are included. Empty narrator fields cannot be validated merely because question text remains.

The right screen follows the approved mockup: shorter helper, originals disclosure with title, device-local subtitle and chevron, no return-to-exchanges action.

## Evidence

- Focused development checks: 102 tests passed (parser round-trip and locale compatibility; read-only question component; capture/edit/close/reopen/formatting; final dictation words; saved journal route).
- App/test TypeScript passed. Focused lint has no errors; the existing two recording effect warnings remain.
- Physical Motorola `192.168.1.176:40435`, existing Expo session: the editor showed four editable narrator sections, no editable question text, no tabs/trash. Long responses occupied multiple lines without clipping in the inspected keyboard-closed view. The review was also visible with its updated disclosure.
- No text was entered or journal save triggered by the agent. The user was also interacting with the device; the attempted keyboard inspection instead observed the review screen. Therefore keyboard-open editing and hardware-back behavior are covered locally but not claimed as device-qualified.
- Screenshots/XML containing the personal draft remain only in `/private/tmp` and are excluded from Git.
- Final committed pre-push validation runs before pushing this functional change. No backend deployment or native reinstall is required.
