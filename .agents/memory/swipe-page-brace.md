---
name: Swipe page brace bug
description: handleSwipe was missing its closing brace, causing downstream functions to be scoped inside it and producing a TS1005 (brace expected) at EOF.
---

## Rule
`src/app/(app)/swipe/page.tsx` — `handleSwipe` was missing its closing `}` after the `setTimeout(..., 300)` call (line ~114). `applyFilters`, `clearFilters`, and `toggleCuisine` were defined inside `handleSwipe` as a result, and the component's own `}` at line 456 left the overall function unclosed.

**Why:** The original author likely deleted the closing brace during a refactor. The app ran fine in dev (Turbopack skips strict TS checking at runtime), so the bug was invisible until `tsc --noEmit` was run.

**How to apply:** If you ever see `TS1005: '}' expected` at the EOF of swipe/page.tsx, check that `handleSwipe` is properly closed before `applyFilters`.
