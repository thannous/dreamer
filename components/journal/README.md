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
- The title, date and classification lead the detail screen on an opaque theme surface.
  The illustration adapts to the remaining reading viewport and opens full screen on
  demand. The header is transparent while artwork passes behind it, then opaque over
  reading content; native iOS scroll-edge blur is disabled on this route. The primary
  action appears when the story enters the viewport and hides during editing.
  White borders baked into a generated illustration are image content, not theme surfaces.
- The page is set as a book (`JournalBook.tsx`): Lora body text at a book's measure
  (centred, at most `BOOK_MEASURE` wide on large screens), sections opened by a
  mark in spaced capitals between hairlines, the story opening on a raised initial (its
  words unchanged, for reading and copying), and the actions as a colophon under an
  ornament. The name keeps its place and alignment: the capture seal lands on it.
- Navigation, decorative headings, list previews and control labels use bounded
  explicit font metrics. Readonly text uses matching drawing and layout sizes to
  avoid stale native measurements during live Dynamic Type changes. Search and
  dream editor instances remain stable so queries, selections and drafts survive
  resizing. Dream prose and its editable field retain native font scaling.
- After a palette change run `npm run uniwind:types` (includes CSS generation).
  `npm run theme:check` rejects generated CSS drift; `npm run brand:check` independently
  verifies CSS/runtime contracts without executing native theme code.

`noctaliaPalette.test.ts` verifies CSS/native parity, `themeContrast.test.ts` checks
foreground/action/status contrast, and route tests cover reading order and actions.
Real UI checks remain necessary for dialogs, native presentation and responsive layout.

## Images du journal

[Le service média](../../services/dreamMediaService.ts) résout les images ;
[les utilitaires](../../lib/imageUtils.ts) définissent thumbnails, cache et versions.
Préserver les contrôles de propriété, la durée des URL signées et l'identité du
cache lors d'un remplacement d'illustration. Vérifier miniature, image complète,
remplacement, réouverture et échec réseau sur le build concerné.
