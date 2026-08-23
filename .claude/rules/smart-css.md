---
description: Use smart CSS to reduce code while preserving existing styles. Verify changes with Playwright MCP.
glob: "*.css"
---

# Smart CSS Optimization

Reduce CSS code by consolidating redundant rules, using modern features, and leveraging Tailwind utility patterns — without breaking existing visual styles.

## Principles

1. **Preserve visual output** — never change the rendered appearance
2. **Reduce duplication** — merge identical rules, extract shared patterns
3. **Use modern CSS** — nesting, `:has()`, `color-mix()`, `oklch()`, custom properties
4. **Leverage Tailwind** — replace custom CSS with Tailwind utilities where equivalent
5. **Verify with Playwright** — visually confirm no regressions after changes

## Optimization Techniques

### Consolidate duplicate selectors

```css
/* BEFORE */
.btn-primary { padding: 0.5rem 1rem; border-radius: 0.375rem; }
.btn-secondary { padding: 0.5rem 1rem; border-radius: 0.375rem; }

/* AFTER */
.btn { padding: 0.5rem 1rem; border-radius: 0.375rem; }
```

### Use CSS nesting

```css
/* BEFORE */
.card {}
.card .title {}
.card .description {}

/* AFTER */
.card {
  .title {}
  .description {}
}
```

### Replace with Tailwind utilities

```css
/* BEFORE */
.center-flex {
  display: flex;
  align-items: center;
  justify-content: center;
}

/* AFTER — use class="flex items-center justify-center" directly */
```

### Use CSS custom properties for repetition

```css
/* BEFORE */
.header { --spacing: 1rem; padding: var(--spacing); }
.footer { --spacing: 1rem; padding: var(--spacing); }

/* AFTER */
:root { --spacing: 1rem; }
```

## Verify with Playwright MCP

After every CSS change, verify visual correctness using Playwright MCP:

1. Navigate to the affected page
2. Take a snapshot or screenshot
3. Compare against the expected appearance
4. If styles are broken, revert the change immediately

```
# Example verification steps
1. playwright_browser_navigate → affected page URL
2. playwright_browser_snapshot → capture current state
3. playwright_browser_take_screenshot → visual reference
4. Confirm no style regressions
```

## What NOT to Do

1. **Do NOT** remove CSS that affects layout or spacing
2. **Do NOT** change colors or font sizes
3. **Do NOT** remove responsive breakpoints
4. **Do NOT** remove dark mode overrides
5. **Do NOT** optimize CSS you don't fully understand — verify first
