---
name: Design system token rules
description: Which CSS variables to use instead of hardcoded rgba/hex values in Food4Love.
---

## Token Map (hardcoded → variable)

| Hardcoded                                                                            | Correct token                                     |
| ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| `#E85A2A`, `rgba(232,90,42,…)`, `rgba(232,116,40,…)`, `#E8390E`, `rgba(232,57,14,…)` | `var(--accent)` (pepper red — buyer/match)        |
| `rgba(…, 0.06–0.15)` soft pepper bg                                                  | `var(--accent-soft)`                              |
| `#F59E0B`, `rgba(245,158,11,…)`                                                      | `var(--accent-alt)` (ember amber — stars, flames) |
| `rgba(214,69,69,…)` danger red                                                       | `var(--danger)`                                   |
| `rgba(255,217,102,…)` warning yellow                                                 | `var(--warning)`                                  |
| `rgba(255,255,255,0.04–0.08)` surface muted                                          | `var(--surface-muted)` or `var(--divider)`        |
| `rgba(255,255,255,0.85)` light button bg                                             | `var(--card)`                                     |
| `var(--app-text)`                                                                    | prefer `var(--text-1)`                            |
| `var(--app-text-muted)`                                                              | prefer `var(--text-3)`                            |

## Transparency pattern

Use `color-mix(in srgb, var(--TOKEN) NN%, transparent)` instead of hardcoded rgba for semantic colours at low opacity. This way the value tracks theme changes automatically.

**Why:** The Shell component applies `theme-cook` / `theme-buyer` class to the root which swaps `--accent` and related vars. Hardcoded hex values bypass this and break theme switching.

**How to apply:** Any time you write a border, background, or shadow using a colour from the palette, look it up in this table and use the CSS variable instead.
