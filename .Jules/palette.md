# Palette Journal

Add entries only for critical UX/a11y learnings in this format:

## YYYY-MM-DD - [Title]
**Learning:** ...
**Action:** ...

## 2025-12-23 - Collapsible should announce expanded state
**Learning:** The `Collapsible` header lacked `accessibilityState.expanded` and a larger touch target, making expand/collapse less clear for screen readers and harder to tap.
**Action:** For any accordion/collapsible trigger, add `accessibilityRole="button"`, `accessibilityState={{ expanded }}`, and a small `hitSlop` to meet comfortable tap targets.

## 2025-12-30 - Search should be easy to clear
**Learning:** The journal search input had no explicit “clear” affordance, forcing users to backspace and breaking flow—especially when they want to quickly try multiple queries.
**Action:** For search-like `TextInput`s, add a conditional trailing clear button with `accessibilityLabel`, comfortable `hitSlop`, and re-focus the input after clearing to keep typing uninterrupted.
