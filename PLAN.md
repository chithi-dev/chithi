# Chithi Frontend Conformance Plan — shadcn-svelte Deep Research

## Research Summary

Deep research of the shadcn-svelte registry (`https://www.shadcn-svelte.com/llms.txt`) revealed the full component ecosystem, exact usage patterns, and conformance gaps in the current codebase.

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
10. **100+ components available** in the registry; only ~30 currently installed.

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

### Phase 3: Advanced Component Integration — TODO

These components are now available but not yet used in the app:

- [ ] **Alert** — Use for upload error states, size limit warnings
- [ ] **Collapsible** — Use for advanced upload options (expiry, password)
- [ ] **Drawer** — Use for mobile upload settings panel
- [ ] **Kbd** — Use for keyboard shortcut hints (Ctrl+V paste)
- [ ] **Toggle** — Use for theme toggle, view mode switches
- [ ] **Checkbox** — Use for multi-select file operations

**Priority:** Alert (error states), Collapsible (advanced options), Kbd (shortcuts)

### Phase 4: CSS Optimization — TODO

- [ ] Consolidate duplicate gradient rules in FancyGrid
- [ ] Replace hardcoded hex colors with CSS custom properties where possible
- [ ] Use `color-mix()` for opacity variants instead of hardcoded alpha
- [ ] Verify dark mode contrast ratios
- [ ] Audit Tailwind utility vs custom CSS overlap

### Phase 5: Form Conformance — TODO

- [ ] Fix login form `Form.Control` to use `{#snippet children({ props })}` pattern
- [ ] Add `{...props}` spread to Input for proper form control integration
- [ ] Replace raw `<button>` password toggle with proper pattern
- [ ] Add `Form.Description` for helper text

### Phase 6: Missing Components to Install — TODO

Components from the registry that are relevant but not yet installed:

- [ ] **command** (search/command palette)
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

**Priority:** textarea, radio-group, slider, popover, command

### Phase 7: Verification — TODO

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

1. **Phase 3** — Integrate Alert, Collapsible, Kbd into upload flow
2. **Phase 4** — CSS optimization pass
3. **Phase 5** — Form conformance fixes
4. **Phase 6** — Install remaining high-priority components
5. **Phase 7** — Playwright verification
