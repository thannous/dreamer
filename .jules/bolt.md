# Bolt's Journal - Critical Learnings Only

## 2025-12-10 - Thumbnail URL Normalization Pattern
**Learning:** The `normalizeDreamImages()` function in this codebase is called on EVERY dream operation (load, add, update, sync). Functions that derive data from stored fields should check if the derived value already exists before recomputing.

**Action:** When normalizing data in hooks/utils, always check `dream.thumbnailUrl || getThumbnailUrl(...)` pattern - preserve existing derived values rather than regenerating them.
