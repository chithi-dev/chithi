---
description: Verify all visual and behavioral changes using Playwright MCP before claiming success.
glob: "*"
---

# Verify with Playwright MCP

After making any visual or behavioral change, verify it works correctly using Playwright MCP browser tools. Never claim a feature works without confirming it in a real browser.

## When to Verify

Run Playwright verification after:
- CSS/style changes
- Component rewrites
- Layout modifications
- Adding or removing UI elements
- Changing responsive behavior
- Dark mode adjustments

## Verification Steps

1. **Navigate** to the affected page using `playwright_browser_navigate`
2. **Snapshot** the page using `playwright_browser_snapshot` to verify structure
3. **Screenshot** using `playwright_browser_take_screenshot` for visual confirmation
4. **Interact** with the changed elements (click, type, hover) to confirm behavior
5. **Compare** against expected appearance — if broken, fix immediately

## Example Workflow

```
# After changing upload page styles
1. playwright_browser_navigate → http://localhost:5173/upload
2. playwright_browser_snapshot → verify component structure
3. playwright_browser_take_screenshot → visual check
4. playwright_browser_click → test interactive elements
5. Confirm no regressions
```

## Golden Path + Edge Cases

Test both:
- **Golden path**: the main happy flow (e.g., select files → upload → share)
- **Edge cases**: empty states, error states, loading states, mobile viewports

## Responsive Testing

After CSS changes, verify at multiple viewports:

```
1. playwright_browser_resize → 1920x1080 (desktop)
2. playwright_browser_resize → 768x1024 (tablet)
3. playwright_browser_resize → 375x667 (mobile)
```

## Dark Mode Testing

After style changes, toggle dark mode and verify:

```
1. playwright_browser_evaluate → toggle .dark class on <html>
2. playwright_browser_snapshot → verify dark styles
3. Confirm no broken contrast or missing overrides
```

## What NOT to Do

1. **Do NOT** claim a change works without browser verification
2. **Do NOT** skip verification for "small" CSS changes
3. **Do NOT** assume Tailwind classes work without confirming the output
4. **Do NOT** skip responsive verification after layout changes
