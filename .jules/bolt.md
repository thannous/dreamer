## 2025-12-10 - Missing Required Props in Performance Components
**Learning:** The codebase contained comments claiming to use `estimatedItemSize` for `FlashList` optimization, but the prop was missing from the JSX. This suggests a disconnect between intent and implementation.
**Action:** When auditing for performance, verify that "implemented" optimizations are actually present in the code, not just in the comments.
