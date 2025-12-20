# Bolt's Journal - Critical Learnings Only

## 2025-12-10 - Thumbnail URL Normalization Pattern
**Learning:** The `normalizeDreamImages()` function in this codebase is called on EVERY dream operation (load, add, update, sync). Functions that derive data from stored fields should check if the derived value already exists before recomputing.

**Action:** When normalizing data in hooks/utils, always check `dream.thumbnailUrl || getThumbnailUrl(...)` pattern - preserve existing derived values rather than regenerating them.

## 2025-12-16 - List Item Memoization
**Learning:** For FlashList performance, stable props are crucial. Inline functions (like `onPress`) and derived arrays (like `badges`) passed as props break `React.memo`.
**Action:** Move derived UI state (badges) inside the item component and use stable callbacks for interactions.

## 2025-12-17 - Single Pass Filtering
**Learning:** Chaining `.filter()` methods creates intermediate arrays and iterates the list multiple times (O(N*K)). For lists with expensive filter predicates (like text search), this overhead is significant.
**Action:** Combine all filter predicates into a single `filter()` callback, ordering cheap checks (booleans, enums) before expensive ones (string manipulation/search).
