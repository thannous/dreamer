# Component composition audit (boolean prop proliferation)

This repo generally has good composition patterns already (notably in chat), but a few UI components still show "boolean prop proliferation" or prefixed prop-group APIs that tend to scale poorly.

This audit is based on the `vercel-composition-patterns` rules:

- `architecture-avoid-boolean-props`
- `patterns-explicit-variants`
- `architecture-compound-components`
- `patterns-children-over-render-props`

## How to regenerate

Run:

```bash
node scripts/audit-components-composition.js
```

For JSON:

```bash
node scripts/audit-components-composition.js --json
```

## Refactors applied

### `components/inspiration/GlassCard.tsx`

Change:
- Removed `enableAnimation`/`disableShadow` boolean props.
- Added explicit variant export `FlatGlassCard` for shadowless cards.

### `components/inspiration/PageHeader.tsx`

Change:
- Replaced `wrapInContainer` with an explicit variant export `PageHeaderContent`.
- Replaced `showAnimations` with `animationSeed` to replay entrance animation without a boolean mode.

### `components/ui/BottomSheetActions.tsx`

Change:
- Replaced prefixed prop groups with explicit action components:
  - `BottomSheetActions`
  - `BottomSheetPrimaryAction` / `BottomSheetSecondaryAction` / `BottomSheetLinkAction`

### `components/auth/EmailAuthCard.tsx`

Smell:
- `isCompact?: boolean` implies multiple layout/UX modes inside one component.

Suggested direction:
- Prefer explicit variants:
  - `EmailAuthCard` and `CompactEmailAuthCard`
- If shared internals are needed, extract composed subcomponents:
  - `EmailAuthCard.Frame`, `EmailAuthCard.EmailField`, `EmailAuthCard.Actions`, etc.

## Review candidates (probably OK, but watch for growth)

- `components/auth/EmailAuthCard.tsx` (`isCompact` still implies multiple layout modes; consider explicit variants if it grows)

## Usually OK (context/state booleans)

Some boolean props are typically fine and shouldn’t be aggressively refactored, especially when they represent:

- Visibility / disabled / loading state (`visible`, `disabled`, `loading`)
- Performance toggles (e.g. list scroll optimization flags)
- “isX/hasX/canX/shouldX” state derived from higher-level state

Examples in this repo where booleans are likely justified:

- `components/ui/BottomSheet.tsx` (`visible`, `dismissBehavior`)
- `components/subscription/PricingOption.tsx` (`state`)
- `components/recording/MicButton.tsx` (`status`, `interaction`)
