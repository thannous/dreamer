# Palette Journal

Add entries only for critical UX/a11y learnings in this format:

## YYYY-MM-DD - [Title]
**Learning:** ...
**Action:** ...

## 2025-12-23 - Collapsible should announce expanded state
**Learning:** The `Collapsible` header lacked `accessibilityState.expanded` and a larger touch target, making expand/collapse less clear for screen readers and harder to tap.
**Action:** For any accordion/collapsible trigger, add `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, and a small `hitSlop` to meet comfortable tap targets.
