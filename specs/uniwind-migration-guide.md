# Uniwind + motion — migration guide (app `dreamer`)

Working agreement for porting Noctalia's screens from `StyleSheet` to Uniwind
`className`, and for the motion that comes with it. Decision context:
[ADR-001](adr-001-nativewind-vs-uniwind.md). Token vocabulary:
[noctalia-meditation.md §5](noctalia-meditation.md).

---

## 1. What is already in place

| Piece | Where |
|---|---|
| Tokens, both themes | [`global.css`](../global.css) |
| Metro integration | [`metro.config.js`](../metro.config.js) — `withUniwindConfig` is outermost |
| CSS entry import | first line of [`app/_layout.tsx`](../app/_layout.tsx) |
| Theme sync | [`context/ThemeContext.tsx`](../context/ThemeContext.tsx) → `Uniwind.setTheme` |
| Generated types | `uniwind-types.d.ts` (`npm run uniwind:types`) |
| Jest stubs | `tests/uniwind-stub.tsx`, `tests/css-stub.js` |
| Motion primitives | [`components/motion/`](../components/motion) |

**Uniwind and StyleSheet coexist.** Nothing forces a big bang. Migrate a component
completely or not at all — a component half in `className` and half in `StyleSheet` is
where contrast and spacing regressions hide.

---

### A trap in source scanning

Tailwind v4 auto-detects sources from `global.css`'s directory — the repo root — *in
addition* to the `@source` rules. Unchecked, it compiles utilities out of Markdown prose,
generated marketing HTML and Maestro flows. This is not merely wasteful: a class quoted in
documentation as **an example of a mistake** becomes a real rule in the bundle (that is
exactly how `.border-[hairlineWidth()]{border-color:1px}` once shipped). `global.css`
therefore carries an explicit `@source not` list. Add to it when a top-level directory
appears.

## 2. Colour vocabulary

Three families. `ink` is the night, `ivory` is what's written on it, `champagne` is the
gold. Every name below exists as `bg-*`, `text-*` and `border-*`.

| Class | Was | Use for |
|---|---|---|
| `ink` | `colors.backgroundDark` | screen ground |
| `ink-panel` | `backgroundSecondary` | panels, inputs |
| `ink-card` | `surface.base` | cards (translucent at night) |
| `ink-raised` | `surface.raised` | a card on a card |
| `ink-active` | `surface.active` | pressed / selected surface |
| `ink-soft` | `surface.soft` | the faintest wash |
| `ink-solid` | `backgroundCard` | when translucency would smear text |
| `ink-overlay` | `surface.overlay` | scrims behind modals |
| `ink-nav` | `navbarBg` | tab bar |
| `ivory` | `textPrimary` | titles, body |
| `ivory-muted` | `textSecondary` | secondary copy |
| `ivory-faint` | `textTertiary` | labels, inactive |
| `ivory-disabled` | `action.disabledText` | disabled copy |
| `champagne` | `accent` | **fills and rules only** |
| `champagne-on` | `accentText` | **accented text and icons** |
| `champagne-deep` | `accentDark` | pressed states, strong borders |
| `champagne-soft` | `accentLight` | hairlines, highlights |
| `champagne-dim` | `action.disabled` | disabled gold fill |
| `on-champagne` | `textOnAccentSurface` | text sitting on a gold surface |
| `line` / `line-strong` / `line-nav` | `divider` | hairlines |
| `nav-active` / `nav-inactive` | navbar text | tab labels |
| `danger` `success` `warning` (+ `-line` `-on` `-icon`) | `status.*` | status blocks |
| `tag-surreal` `tag-mystical` `tag-calm` `tag-noir` | `tags.*` | dream tags |
| `particle` `star` `veil` `orbit` `horizon` | `atmosphere.*` | background scenery |

> **The one rule that is not negotiable.** `champagne` (`#D4A574`) is never a text
> colour. It fails AA on cream. Accented copy is `text-champagne-on`, which resolves to
> `#9A6332` in light and `#EAD4B4` in dark. If you catch yourself writing
> `text-champagne`, you want `text-champagne-on`.

### Typography

`font-display*` (Fraunces — titles, statistics, anything that should feel written),
`font-sans*` (Space Grotesk — body, buttons, navigation), `font-serif*` (Lora — quotes,
ambient copy). Weight is part of the family name, because that is how React Native
resolves it: `font-sans-medium`, `font-display-bold`, and so on. Do **not** pair these
with `font-bold` — a `fontWeight` on top of a named family is either ignored or produces
a synthetic bold.

Sizes carry their line height: `text-display` `text-h1` `text-h2` `text-h3` `text-body`
`text-body-sm` `text-caption`. `overline` is a composite (size + tracking + uppercase).

### Shape and spacing

`rounded-sm|md|lg|xl|artwork|full` — cards are `rounded-xl` (24). `gutter` is the
standard screen padding; `card` is the standard card (ground + hairline + radius) —
prefer it over rebuilding those three classes each time.

### A separate `tone` from `variant`

When a component takes a typography variant, that variant must not carry colour. Two
competing `text-*` classes on one element resolve by **last one in the string**, which is
the intuitive Tailwind behaviour and precisely why Uniwind was chosen — but a variant
that smuggles a colour still makes the caller's override invisible at the call site.
Keep `variant` = font + size, `tone` = colour.

---

## 3. What stays in TypeScript

`className` cannot reach props that take a colour *value* rather than a style. Keep using
`useTheme()` / `getNoctaliaDesignTokens()` for:

- `LinearGradient` `colors={...}`
- icon `color=` props (`@expo/vector-icons`, `IconSymbol`)
- `react-native-gifted-charts` colour props
- `ActivityIndicator` `color=`, `RefreshControl` `tintColor=`
- anything passed to a native module

This is expected and permanent, not debt. The values are the same on both sides because
`global.css` and `constants/journalTheme.ts` are kept in step by hand — **if you change a
colour, change both.**

---

## 3b. Known limits — what `className` cannot do here

Found the hard way; don't rediscover them.

| Limit | What to do instead |
|---|---|
| **Shadows.** React Native spreads a shadow over `shadowColor/Offset/Opacity/Radius` plus Android `elevation`. Tailwind's single `box-shadow` does not map onto that without changing Android rendering. | Keep a named `ViewStyle` constant next to the component, or `style={shadows.md}` from `useTheme()`. |
| **Transforms.** Tailwind v4 emits `translate` through CSS variables (`translate: var(--tw-translate-x) var(--tw-translate-y)`) and Uniwind resolves that declaration by splitting the string, so the variable form does not survive. | Keep load-bearing transforms in `style`. Verify on device before converting one. |
| **`text-caption` bundles a line height.** With `adjustsFontSizeToFit`, a fixed `lineHeight` is a known iOS clipping hazard. | Use a bare arbitrary size — `text-[12px]` — wherever `adjustsFontSizeToFit` is set. |
| **No `hover:` variant.** Uniwind has `active:`, `focus:`, `disabled:`, but mobile has no hover and the web sidebar needs one. | Keep hover as React state. |
| **Third-party components** (`expo-image`, gifted-charts, RevenueCat UI) do not accept `className`. | `withUniwind(Component)` once if it is used widely, otherwise leave the `style` prop. |
| **Measured or computed geometry** (safe-area insets, `getTabBarHorizontalLayout`, window-width branches) cannot be a class. | Keep it in `style`. Uniwind applies `className` first and `style` second, so they do not fight. |
| **A JS constant and a class cannot share a number.** `SIDEBAR_WIDTH = 240` and `w-[240px]` must be kept in step by hand. | Comment both sides. |

### Things that DO work — verified, don't work around them

- **`tabular-nums`** — Uniwind maps `font-variant-numeric` to RN's `fontVariant`
  (`src/bundler/css-processor/rn.ts`). Use the class; don't hand-roll a `fontVariant` style.
- **`border-continuous`** — a real Uniwind utility (`uniwind.css`) for
  `borderCurve: 'continuous'`. No style constant needed for iOS squircle corners.
- **`hairlineWidth()`** — a Uniwind runtime function, usable in an arbitrary value. **The
  `length:` hint is mandatory:** `border-[length:hairlineWidth()]` is a width, while
  `border-[hairlineWidth()]` is parsed as a *colour* and silently produces a border with
  no width at all.
- **`className` on `Animated.View`** and on Reanimated-wrapped components — Reanimated
  builds on RN core components, which Uniwind patches, so the prop resolves without
  `withUniwind`.
- **`className` through a component that spreads `{...rest}` onto a `Pressable`** — e.g.
  `PressableScale`. Uniwind's patched `Pressable` reads `props.className` and merges
  `props.style` *after* its own resolved styles, so both survive and `style` wins.

### Merge order, and the trap in it

Uniwind applies `className` **first** and `style` **second**, so `style` always wins.
That is usually what you want — measured geometry beats a class. But it means a component
whose public API is `style?: ViewStyle` (`FlatGlassCard`, `GlassCard`, `IconSymbol`,
`ReminderOptInCard`) will always beat a `className` passed by its caller. Either give such
a component a `className` passthrough, or accept that its frame is set in TypeScript and
put only the *contents* in classes.

### Prefer an exact arbitrary value over the nearest token

The type and spacing scales in `global.css` do not cover every value the app already uses,
and several existing sizes were deliberately set with no `lineHeight` while the tokens
carry one. Snapping to the nearest token silently changes layout — that is a redesign, not
a migration. Use `text-[13px]`, `leading-[18px]`, `mt-[22px]` and reserve named tokens for
exact matches. Tightening the scale is a separate, deliberate piece of work.

### Testing a migrated component

Uniwind resolves `className` in the Metro transformer, which Jest never runs — under test
`className` is an inert string (`tests/uniwind-stub.tsx`). A test that asserted resolved
style values will fail after migration. Port it to assert the class string instead: with
arbitrary values the pixels live *in* the class (`w-[64px]`), so the assertion stays
exactly as precise. See `tests/app-routes/tabLayout.test.tsx` for the pattern — its local
React Native mock exposes `data-native-class` alongside `data-native-style`.

## 4. Motion

Run the `animate-expo` skill before writing any animation. The short version:

**The gate.** Something used 100+ times a day (tab switches, keyboard, scrolling,
toggles) gets **no** animation. Tens of times a day (press, row selection) gets under
150 ms or nothing. Occasional (sheets, modals, toasts) gets a standard animation. Rare
(success, empty states, first run) is where delight is allowed. **Tabs never slide** —
they are peers, and the user pays for that transition dozens of times a session.

**The primitives.** Import from `@/components/motion`:

- `PressableScale` — the standard pressable. Answers on press-in, 120 ms, scale 0.97,
  44pt targets via `hitSlop`, opt-in `haptic`. Replaces bare `TouchableOpacity`.
- `Reveal` — a mount entrance, with automatic stagger via `index`. **Never on a
  virtualized list row** — recycled rows replay it on every scroll, and swapping a row
  between `Animated.View` and `View` to dodge that defeats recycling outright. Note that
  the usual escape hatch for reflow, `itemLayoutAnimation`, **does not exist in FlashList
  v2** (verified against its types), so on this app's lists filter changes and deletes
  reflow instantly — that is correct behaviour here, not a gap to fill.
- `DURATION`, `EASE` (CSS), `EASING` (imperative), `SPRING`, `staggerDelay`.

**The rules that get violated most:**

- `transform` and `opacity` are free. `width`, `height`, `margin`, `top`, `flex` re-run
  layout every frame. The only exception is an absolutely positioned, childless element.
- Springs when a finger was involved (they carry velocity through an interruption);
  timing curves otherwise. Never `ease-in` on UI.
- Never `setState` in a gesture or scroll handler. Shared value → `useAnimatedStyle`.
- `scheduleOnRN` from `react-native-worklets`, not the deprecated `runOnJS`, and never
  per frame — put it in `onEnd` or a threshold `useAnimatedReaction`.
- `.get()` / `.set()` on shared values, never `.value`, and never during render.
- One haptic per user action, fired in the same frame as the visual, never the only
  feedback.
- Reduced motion ships with the animation, not after it. Reduced means gentler — keep
  the fade, drop the travel.
- Don't animate `BlurView` intensity or Android `elevation`; crossfade a static layer.

---

## 5. Verifying a slice

```bash
npm run test:related -- <files you touched>
npx tsc --noEmit -p tsconfig.json
npx expo lint <paths you touched>
```

`npm run uniwind:types` regenerates `uniwind-types.d.ts` after changing `global.css`.

A visual check needs a device or the web export (`npx expo export -p web`); feel — flick,
interrupt, reverse, slowest Android — cannot be judged from a diff and must be called out
rather than claimed.
