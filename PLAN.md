# Chithi Frontend Conformance Plan — shadcn-svelte Deep Research + Reference Comparison

## shadcn-svelte Research Summary

Deep research of the shadcn-svelte registry (`https://www.shadcn-svelte.com/llms.txt`) and forms documentation revealed the full component ecosystem, exact usage patterns, and conformance gaps.

### Key Findings

1. **shadcn-svelte is a code distribution system** — not a component library. Components are cloned into the project via CLI, giving full ownership.
2. **Built on Bits UI** for ARIA + keyboard navigation, **Tailwind CSS v4** with OKLCH color space, **tailwind-variants** (`tv()`) for variant styling, and **Svelte 5 runes**.
3. **Compositional components** (Card, Dialog, DropdownMenu, Form, Tooltip, Select, Sidebar, Sheet) use `import * as X` namespace imports.
4. **Single components** (Button, Input, Badge, Progress) use named imports `import { X }`.
5. **DropdownMenu.Trigger** uses `{#snippet child({ props })}` — NOT `{#snippet children({ props })}`.
6. **Dialog.Trigger** and **Dialog.Close** use `buttonVariants()` — NOT `<Button>` directly.
7. **Form.Control** wraps inputs with `{#snippet children({ props })}` and spreads `{...props}` to the input for form integration.
8. **Dark mode** via `mode-watcher` package with `.dark` class — not media queries.
9. **OKLCH color space** used throughout for better perceptual uniformity.
10. **100+ components available** in the registry; 42 currently installed.

---

## Reference Frontend Comparison (D:\Programming\frontend vs D:\Programming\chithi\src\frontend)

### Architecture — Identical Stack

| Aspect | Reference | Chithi | Verdict |
|---|---|---|---|
| Framework | SvelteKit 2.58 + Svelte 5 runes | Same | Identical |
| UI Library | shadcn-svelte via bits-ui | Same | Identical |
| Styling | Tailwind CSS v4.3 + OKLCH | Same | Identical |
| State | TanStack Svelte Query | Same | Identical |
| Forms | formsnap + sveltekit-superforms + Zod | Same | Identical |
| Database | IndexedDB (raw) | IndexedDB (raw, split modules) | Chithi more modular |
| Routing | File-based layout groups | Same | Identical |
| Adapter | adapter-node | Same | Identical |
| WASM | None | chithi_wasm (Rust crypto) | Chithi-specific feature |

### UI Component Inventory

| Category | Reference | Chithi |
|---|---|---|
| Total shadcn components | 29 | 42 |
| Extra in chithi | — | alert, alert-dialog, aspect-ratio, checkbox, collapsible, command, data-table, drawer, input-group, kbd, toggle |
| Custom components | CodeViewer, FancyGrid, FileViewerOverlay, QRCode | Same + CommandPalette, InfoCard, StatusBadge, CommitLink |

Chithi has **more** components, which is not a weakness — it covers more use cases. The reference is leaner but lacks features like the command palette and WASM crypto.

### Code Style Differences

| Area | Reference Approach | Chithi Approach | Recommendation |
|---|---|---|---|
| **Import extensions** | No `.js` (`from '$lib/components/ui/button'`) | `.js` everywhere (`from '$lib/components/ui/button/index.js'`) | **Keep chithi** — explicit extensions are Svelte 5 / modernAst recommended |
| **Query file formatting** | Expanded, readable, one operation per line | Compressed one-liners, dense | **Adopt reference** — expand for readability |
| **Error handling** | Multi-line if/throw with messages | Ternary one-liners | **Adopt reference** — better stack traces |
| **Database layer** | Single file, `Date.now()` | Split modules, `Temporal.Now` | **Keep chithi** — better modularity |
| **Fetch utilities** | Repeated per file | Centralized `fetch-utils.ts` | **Keep chithi** — better DRY |
| **Type safety** | Partial typing, some `any` | Full interfaces (`InstanceInformation`, etc.) | **Keep chithi** — better types |
| **Layout files** | Well-spaced, clear | Compressed, inline async | **Adopt reference** — reformatted for readability |
| **Info pages** | Inline in `+page.svelte` | Extracted `InfoCard`, `StatusBadge`, `CommitLink` | **Keep chithi** — better DRY |

### What Chithi Should Adopt from Reference

1. **Readability in query files** — expand one-liners, use `queryClient` instead of `qc`, add inline comments
2. **Multi-line error handling** — explicit if/throw for better debugging
3. **Layout file formatting** — expand compressed async init logic
4. **Remove unused deps** — `postcss-import` not needed with Tailwind v4
5. **Add local font assets** — copy `Geist.woff2` and `JetBrainsMono.woff2` for faster TTFB

### What Chithi Does Better (Keep)

1. **Centralized fetch utilities** — `fetch-utils.ts` eliminates boilerplate
2. **Dedicated Spinner** — proper shadcn component vs icon hack
3. **Field component** — better accessibility than bare Label
4. **CommandPalette** — quality-of-life feature the reference lacks
5. **Typed interfaces** — full type safety on query results
6. **WASM crypto** — more performant than Web Crypto for large files
7. **Explicit import extensions** — Svelte 5 recommended pattern

---

## Conformance Gaps (Before → After)

| Area | Before | After | Status |
|---|---|---|---|
| Raw `<input type="checkbox">` for password | Stage 2 | `<Switch.Root>` | DONE |
| Manual empty state div | Stage 2 | `<Empty.Root>` | DONE |
| ButtonGroup buttons not in Triggers | Stage 3 | `ButtonGroup.Trigger` + snippets | DONE |
| QR code no aspect ratio | Stage 3 | `<AspectRatio>` wrapper | DONE |
| Invalid Tailwind `-translate-y/2` | Stage 2 | `top-1` | DONE |
| Missing shadcn components | 7 components | Installed via CLI | DONE |
| Spinner for loading states | Custom spinners | `<Spinner>` component | DONE |
| badgeVariants for links | Raw `<a>` tags | `badgeVariants()` | DONE |
| Form.Control missing snippet pattern | Login form | `{#snippet children}` + `{...props}` | DONE |
| Alert for upload errors | None | `<Alert.Root>` inline | DONE |
| Kbd for paste shortcut | None | `<Kbd.Root>` hint | DONE |

---

## CSS Optimization Findings

### High Priority

| # | File | Issue | Fix |
|---|---|---|---|
| 1 | `FancyGrid.svelte:21`, `+error.svelte:27` | Duplicate grid gradient (~180 char class string) | Extract to `--grid-gradient` CSS custom property |
| 2 | `tailwind.css:47-79` | `oklch(14.479% 0.00002 271.152)` repeated 7x in `.dark` | Define `--dark-surface`, `--dark-text` intermediate vars |
| 3 | `tailwind.css:8-79` | Mixed oklch decimal vs percentage notation | Standardize to one notation |

### Medium Priority

| # | File | Issue | Fix |
|---|---|---|---|
| 4 | FancyGrid, +error | Hardcoded `#00000008`/`#ffffff08` hex | `color-mix(in srgb, var(--color-foreground) 5%, transparent)` |
| 5 | `upload_showcase.svelte:235-261` | Hardcoded `rgba(255,255,255,...)` stripes | `color-mix(in srgb, var(--foreground) 20%, transparent)` |

### Low Priority

| # | File | Issue | Fix |
|---|---|---|---|
| 6 | 6+ files | Repeated icon-badge class `flex h-8 w-8 items-center justify-center rounded-full bg-primary/10` | Shared `<IconBadge>` component |

---

## Phases

### Phase 1: Component Inventory & Installation — DONE

- [x] Audit installed components vs registry
- [x] Install missing components: checkbox, alert, drawer, collapsible, kbd, aspect-ratio, toggle
- [x] Verify `components.json` config
- [x] Verify `@custom-variant dark` in CSS
- [x] Verify OKLCH color space throughout

**Completed:** All 7 missing components installed. CSS confirmed OKLCH + dark variant.

### Phase 2: Component Replacements — DONE

- [x] Replace raw checkbox with Switch for password protection
- [x] Replace manual empty state with Empty component
- [x] Fix ButtonGroup structure (ButtonGroup.Trigger + child snippets)
- [x] Add AspectRatio wrapper for QR code
- [x] Fix invalid Tailwind class `-translate-y/2`
- [x] Fix file size text color (`text-foreground` → `text-muted-foreground`)

**Completed:** All replacements applied and committed (`feb5361`).

### Phase 3: Advanced Component Integration — DONE

- [x] **Alert** — Inline upload error display below upload buttons
- [x] **Kbd** — Keyboard shortcut hint (Ctrl+V) for paste-to-upload
- [ ] **Collapsible** — Defer: advanced upload options (expiry/password) are better visible
- [ ] **Drawer** — Defer: mobile upload panel not needed with current layout
- [ ] **Toggle** — Available for future use (theme toggle, view switches)
- [ ] **Checkbox** — Available for future use (multi-select operations)

**Completed:** Alert + Kbd integrated and committed (`deb6667`).

### Phase 4: CSS Optimization — DONE (partial)

- [x] Extract `--grid-gradient` custom property for FancyGrid + error page
- [x] Define `--dark-surface`, `--dark-text` intermediate vars in `.dark` block
- [x] Standardize oklch notation (decimal vs percentage)
- [ ] Replace hardcoded hex grid colors with `color-mix()`
- [ ] Replace hardcoded `rgba(255,255,255,...)` stripes with `color-mix()`
- [ ] Verify dark mode contrast ratios
- [ ] Audit Tailwind utility vs custom CSS overlap

**Completed:** Grid gradients, dark mode vars, oklch standardization committed (`cdf3518`).

### Phase 5: Form Conformance — DONE

- [x] Fix login form `Form.Control` to use `{#snippet children({ props })}` pattern
- [x] Add `{...props}` spread to Input for proper form control integration
- [ ] Replace raw `<button>` password toggle with proper pattern (deferred - Button works)
- [ ] Add `Form.Description` for helper text (deferred - no helper text needed)

**Completed:** Login form conformed to shadcn-svelte docs pattern and committed (`5967640`).

### Phase 6: Code Readability — DONE (partial)

Based on reference frontend comparison, improve readability without changing behavior:

- [x] Expand query file one-liners to multi-line (auth.ts, instance.ts, files.ts)
- [x] Expand error handling to multi-line if/throw
- [x] Remove unused `postcss-import` dependency
- [x] Add hatch build system to Python SDK pyproject.toml
- [ ] Reformat `+layout.svelte` async init logic for readability
- [ ] Add local font assets (Geist.woff2, JetBrainsMono.woff2)

**Completed:** Query files expanded, postcss-import removed, hatch added committed (`2720b74`).

### Phase 7: Missing Components to Install — TODO

Components from the registry that are relevant but not yet installed:

- [ ] **context-menu** (right-click menus)
- [ ] **date-picker** (date selection)
- [ ] **hover-card** (rich hover previews)
- [ ] **menubar** (app menu bar)
- [ ] **navigation-menu** (top nav)
- [ ] **number-field** (numeric input)
- [ ] **popover** (floating panels)
- [ ] **radio-group** (radio buttons)
- [ ] **range-calendar** (date range)
- [ ] **resizable** (split panes)
- [ ] **slider** (range slider)
- [ ] **stepper** (multi-step forms)
- [ ] **tags-input** (tag entry)
- [ ] **textarea** (multi-line input)
- [ ] **toast** (notification toasts — alternative to Sonner)
- [ ] **toggle-group** (grouped toggles)

**Priority:** textarea, radio-group, slider, popover

### Phase 8: Verification — TODO

- [ ] Playwright visual verification of upload flow
- [ ] Playwright dark mode verification
- [ ] Responsive viewport testing (mobile, tablet, desktop)
- [ ] TypeScript type check (address pre-existing errors)
- [ ] Build verification

---

## shadcn-svelte Usage Rules (for reference)

### Import Patterns
- Single: `import { Button } from "$lib/components/ui/button/index.js"`
- Compositional: `import * as Card from "$lib/components/ui/card/index.js"`

### Button Variants
- `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- Sizes: `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`

### Dialog Pattern
```svelte
<Dialog.Trigger class={buttonVariants({ variant: "outline" })}>Open</Dialog.Trigger>
```

### DropdownMenu Pattern
```svelte
<DropdownMenu.Trigger>
  {#snippet child({ props })}
    <Button {...props}>Open</Button>
  {/snippet}
</DropdownMenu.Trigger>
```

### Form Pattern
```svelte
<Form.Control>
  {#snippet children({ props })}
    <Input {...props} bind:value={$formData.field} />
  {/snippet}
</Form.Control>
```

---

## Next Steps

1. **Phase 4 (remaining)** — color-mix for hardcoded hex/rgba stripes
2. **Phase 6 (remaining)** — layout file formatting, local font assets
3. **Phase 7** — Install remaining high-priority components (textarea, radio-group, slider, popover)
4. **Phase 8** — Playwright verification of upload + login flows
