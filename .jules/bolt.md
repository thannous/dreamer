# Bolt's Journal - Critical Learnings Only

## 2025-12-10 - Thumbnail URL Normalization Pattern
**Learning:** The `normalizeDreamImages()` function in this codebase is called on EVERY dream operation (load, add, update, sync). Functions that derive data from stored fields should check if the derived value already exists before recomputing.

**Action:** When normalizing data in hooks/utils, always check `dream.thumbnailUrl || getThumbnailUrl(...)` pattern - preserve existing derived values rather than regenerating them.

## 2025-12-10 - FlashList Prop Stability
**Learning:** In `JournalListScreen`, `DreamCard` props (`badges` array, `onPress` callback) were recreated on every render, defeating `React.memo` and causing `FlashList` items to re-render unnecessarily on scroll/filter updates.

**Action:** Move derived UI state (like badges) inside the list item component (`DreamCard`) and pass stable callbacks (ids instead of closures) to ensure props remain referentially stable.
