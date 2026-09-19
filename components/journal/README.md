# Dream detail appearance

Dream details use the **common application theme**, including missing dreams and dialogs.
There is no feature-specific palette or appearance provider.

- Colour values live in `constants/noctaliaPalette.ts`. Runtime `ThemeColors`, semantic
  design tokens and generated CSS all derive from that source.
- Use semantic Uniwind classes (`bg-ink`, `bg-ink-raised`, `text-ivory`,
  `text-champagne-on`, status colours), or `useTheme()` / `getNoctaliaDesignTokens()`
  for props and StyleSheet consumers. `hasIllustratedCover` controls layout only.
- Native and web sheet chrome use the same opaque `backgroundCard` surface as the
  content. Ordinary React Native modals inherit the global CSS theme on web.
- Image geometry stays in `lib/dreamCoverLayout.ts`. White borders baked into a generated
  illustration are image content, not theme surfaces.
- After a palette change run `npm run uniwind:types` (includes CSS generation).
  `npm run theme:check` rejects generated CSS drift; `npm run brand:check` independently
  verifies CSS/runtime contracts without executing native theme code.

`noctaliaPalette.test.ts` verifies CSS/native parity, `themeContrast.test.ts` checks
foreground/action/status contrast, and route tests cover reading order and actions.
Real UI checks remain necessary for dialogs, native presentation and responsive layout.
