/**
 * The Noctalia type scale for StyleSheets, mirroring the `--text-*` tokens in
 * global.css (spec §5.3). Meditation keeps the same values in its own
 * constants/typography.ts; `npm run brand:check` fails if any of them drift.
 * className code uses the Uniwind classes (`text-body`, `text-caption`…) instead.
 */
export const TypeScale = {
  hero: { fontSize: 40, lineHeight: 46 },
  display: { fontSize: 34, lineHeight: 40 },
  h1: { fontSize: 28, lineHeight: 34 },
  h2: { fontSize: 22, lineHeight: 28 },
  h3: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 16, lineHeight: 24 },
  bodySm: { fontSize: 14, lineHeight: 20 },
  caption: { fontSize: 12, lineHeight: 16 },
  overline: { fontSize: 11, lineHeight: 14, letterSpacing: 1.3 },
} as const;

export type TypeScaleStep = keyof typeof TypeScale;
