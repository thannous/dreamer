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
