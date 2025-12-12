# Bolt's Journal - Critical Learnings Only

## 2025-12-10 - Thumbnail URL Normalization Pattern
**Learning:** The `normalizeDreamImages()` function in this codebase is called on EVERY dream operation (load, add, update, sync). Functions that derive data from stored fields should check if the derived value already exists before recomputing.

**Action:** When normalizing data in hooks/utils, always check `dream.thumbnailUrl || getThumbnailUrl(...)` pattern - preserve existing derived values rather than regenerating them.

## 2025-12-12 - FlashList Type Definitions
**Learning:** The `@shopify/flash-list` library is missing the `estimatedItemSize` property in its TypeScript definitions, despite it being a required prop for performance.
**Action:** Always use `// @ts-expect-error` when adding `estimatedItemSize` to `FlashList` components.
