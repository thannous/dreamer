# Bolt's Journal - Critical Learnings Only

## 2026-05-16 - Shared Locale Formatting Cache
**Learning:** Several screens format many dates and numbers through `useLocaleFormatting()` (statistics, journal detail, subscription/paywall). Creating fresh `Intl.DateTimeFormat` / `Intl.NumberFormat` instances per label is much slower than reusing cached formatters.

**Action:** Route repeated locale formatting through `lib/dateUtils.ts` cached helpers before adding screen-local formatters. Keep custom option objects finite and stable so cache keys stay bounded.

## 2026-05-16 - Sorted Dreams Can Skip Streak Sorts
**Learning:** Statistics consumes the same newest-first `dreams` array produced by `useDreamPersistence`, so streak calculations on that screen can skip the defensive copy/sort while preserving the existing streak semantics.

**Action:** Use `calculateStreaks(..., { sortedDescending: true })` only at call sites backed by persistence-sorted dreams. Keep the generic default sorted defensively for arbitrary test/util callers.

## 2026-05-16 - Journal Filters Preserve Persistence Order
**Learning:** `useDreamPersistence` normalizes and stores `dreams` newest-first before the journal screen receives them. `applyFilters()` preserves array order, so sorting again in the journal screen is redundant JS-thread work and allocation during search/filter updates.

**Action:** In journal list hot paths, treat `dreams` as already newest-first unless a new data source bypasses `useDreamPersistence`. Prefer early returns for inactive filters and avoid post-filter sorts that only recreate the same order.

## 2025-12-10 - Thumbnail URL Normalization Pattern
**Learning:** The `normalizeDreamImages()` function in this codebase is called on EVERY dream operation (load, add, update, sync). Functions that derive data from stored fields should check if the derived value already exists before recomputing.

**Action:** When normalizing data in hooks/utils, always check `dream.thumbnailUrl || getThumbnailUrl(...)` pattern - preserve existing derived values rather than regenerating them.

## 2025-12-16 - List Item Memoization
**Learning:** For FlashList performance, stable props are crucial. Inline functions (like `onPress`) and derived arrays (like `badges`) passed as props break `React.memo`.
**Action:** Move derived UI state (badges) inside the item component and use stable callbacks for interactions.

## 2025-12-21 - Viewability Callback Allocations
**Learning:** High-frequency list callbacks (e.g., `onViewableItemsChanged`) should avoid allocating temporary objects on every call; allocating a new `Set` per callback caused extra JS-thread GC during fast Journal scrolling. Reusing a single `Set` reduced Android `dumpsys gfxinfo` legacy jank from 23.61% (280/1186) to 19.87% (240/1208) in the same 30-swipe scenario.
**Action:** When optimizing scrolling, reuse scratch data structures inside viewability/scroll handlers and validate with a repeatable `dumpsys gfxinfo` swipe script before/after.

## 2025-12-24 - Gate Markdown Stripping In Streaming
**Learning:** `stripMarkdownForHandwriting()` was running on every assistant render even when handwriting mode was inactive, doing multiple full-string regex passes during streaming updates.

**Action:** When a derived value is only used in a specific UI mode (handwriting, animations, etc.), guard the computation behind the mode flag so streaming updates don't pay the cost unnecessarily.

## 2025-12-30 - Skip Joined-Text Search For Single Tokens
**Learning:** `matchesSearch()` in `lib/dreamFilters.ts` built a joined/`toLowerCase()` string for every dream even for single-token queries where cross-field phrase matching is impossible (fields are joined with spaces). This showed up as ~38ms avg filtering time over 20k dreams with long transcripts.

**Action:** In search filters, only run cross-field “joined text” matching when the normalized query contains whitespace, and lazily compute localized label fields to avoid extra work on early matches. Keep a perf test (`tests/perf/filterBySearch.perf.test.ts`) to catch regressions.
