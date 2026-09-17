# Safe exit from capture review — 17 September 2026

The review header has one close icon. It opens the existing standard bottom sheet with “Garder pour plus tard”, “Abandonner ce récit” and “Continuer la relecture”. Abandonment opens a second, destructive confirmation; cancelling it returns to the options. Android Back follows the same path, after dismissing an open keyboard. Backdrop/pan dismissal preserves the review.

Keep and confirmed discard wait for durable draft storage before navigating home. The draft write uses the existing serialized queue and retry behavior, invalidates older autosaves and waits for a persistence barrier. Failure keeps the review visible; a failed discard restores the original draft as the next lifecycle-flush target. Neither path invokes journal creation, categorization or interpretation. Review text and original exchanges are kept/deleted together in the existing draft envelope.

## Evidence

- 117 focused route/draft tests passed. New coverage checks pending-write ordering, no resurrection after discard, failed discard recovery, explicit confirmation, continuing, awaited keep, and Android Back wiring.
- App and test TypeScript passed. Focused lint has no errors; the existing two recording effect warnings remain.
- Physical Motorola `192.168.1.176:40435`, current Expo build: close icon opens the three choices; Android Back closes and reopens the options; discard confirmation displays both destructive and cancel controls. The confirmation was cancelled without deletion.
- “Garder pour plus tard” returned to home. Reopening Capturer restored “Relis ton récit” with the exact same textarea content (UI-tree comparison). No journal save was invoked and no personal draft was deleted.
- Actual deletion is covered by local tests, not exercised on the user's personal hardware draft. Device artifacts containing dream text stay only in `/private/tmp`.
- Final committed pre-push validation is run before pushing. No native reinstall, database migration or backend deployment is needed.
