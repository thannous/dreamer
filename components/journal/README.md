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
- In an expanded native window (the open iPhone Duo held as a book, `getJournalSpread`)
  the dream lies open on two facing pages bound at the display's fold: the plate (or the
  illustration's place), the name and the quote as an epigraph on the left; the running
  head, seal, reading, story, actions and dock on the right. Each page keeps a margin at
  the binding (`SPREAD_GUTTER`), editing and notices stay on the right-hand page, and a
  turn lifts a leaf about the binding (`JournalSpreadLeaf`). Folding or unfolding keeps
  the same tree and the reader's place. The web and compact or upright windows keep the
  single page. The capture seal's hand-off is still laid out for the single page.
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
