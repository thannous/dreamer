# Bolt's Journal - Critical Learnings Only

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

## 2025-01-20 - Scroll State in List Items
**Learning:** Passing frequent `isScrolling` state updates to `FlashList` items (via props/extraData) triggers massive re-renders on scroll start/stop, outweighing any micro-optimization benefits (like disabling transitions).
**Action:** Avoid passing scroll state to list items. Use static configurations for list items or `useRef` if logic (like prefetching) needs to know scroll state without UI updates.
