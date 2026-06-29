# Chithi Frontend Conformance Plan

> shadcn-svelte Deep Research + Reference Frontend Comparison + Forward Work Plan
> Research date: 2026-06-28
> shadcn-svelte docs source: `https://www.shadcn-svelte.com/llms.txt` + individual component docs

---

## Part 1: shadcn-svelte Deep Research Summary

### What shadcn-svelte Actually Is

shadcn-svelte is a **code distribution system**, not a component library. Components are cloned into the project via CLI (`npx shadcn-svelte add`), giving full ownership of source code. Built on:

- **Bits UI** — headless accessible primitives (ARIA + keyboard navigation)
- **Tailwind CSS v4** with OKLCH color space
- **tailwind-variants** (`tv()`) for variant/size styling
- **Svelte 5 runes** (`$state`, `$derived`, `$props()`, `$bindable`, `{#snippet}`)

### Registry: 60+ Components Across Categories

| Category | Components |
|---|---|
| **Form & Input** | Button, Button Group, Calendar, Checkbox, Combobox, Date Picker, Field, Input, Input Group, Input OTP, Label, Native Select, Radio Group, Select, Slider, Switch, Textarea |
| **Layout & Navigation** | Accordion, Breadcrumb, Navigation Menu, Resizable, Scroll Area, Separator, Sidebar, Tabs |
| **Overlays & Dialogs** | Alert Dialog, Command, Context Menu, Dialog, Drawer, Dropdown Menu, Hover Card, Menubar, Popover, Sheet, Tooltip |
| **Feedback & Status** | Alert, Badge, Empty, Progress, Skeleton, Sonner, Spinner |
| **Display & Media** | Aspect Ratio, Avatar, Card, Carousel, Chart, Data Table, Item, Kbd, Table, Typography |
| **Misc** | Collapsible, Pagination, Range Calendar, Toggle, Toggle Group |

### EXACT Docs Patterns (Verified from shadcn-svelte.com)

#### Card — EXACT from docs

```svelte
<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
</script>

<Card.Root class="w-full max-w-sm">
  <Card.Header>
    <Card.Title>Card Title</Card.Title>
    <Card.Description>Card Description</Card.Description>
  </Card.Header>
  <Card.Content>
    <p>Card Content</p>
  </Card.Content>
  <Card.Footer>
    <p>Card Footer</p>
  </Card.Footer>
</Card.Root>
```

**Parts**: `Card.Root`, `Card.Header`, `Card.Content`, `Card.Footer`, `Card.Title`, `Card.Description`, `Card.Action`

**Import rule**: Always `import * as Card` — namespace import.

#### Dialog — EXACT from docs

```svelte
<script lang="ts">
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
</script>

<Dialog.Root>
  <form>
    <Dialog.Trigger type="button" class={buttonVariants({ variant: "outline" })}>
      Open Dialog
    </Dialog.Trigger>
    <Dialog.Content class="sm:max-w-[425px]">
      <Dialog.Header>
        <Dialog.Title>Edit profile</Dialog.Title>
        <Dialog.Description>Make changes to your profile here.</Dialog.Description>
      </Dialog.Header>
      <div class="grid gap-4">
        <Input name="name" defaultValue="Pedro Duarte" />
      </div>
      <Dialog.Footer>
        <Dialog.Close type="button" class={buttonVariants({ variant: "outline" })}>Cancel</Dialog.Close>
        <Button type="submit">Save changes</Button>
      </Dialog.Footer>
    </Dialog.Content>
  </form>
</Dialog.Root>
```

**Critical**: `Dialog.Trigger` and `Dialog.Close` use `buttonVariants()` — NOT `<Button>` directly.

#### DropdownMenu — EXACT from docs

```svelte
<script lang="ts">
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import { Button } from "$lib/components/ui/button/index.js";
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}
      <Button {...props} variant="outline">Open</Button>
    {/snippet}
  </DropdownMenu.Trigger>
  <DropdownMenu.Content class="w-56" align="start">
    <DropdownMenu.Label>My Account</DropdownMenu.Label>
    <DropdownMenu.Group>
      <DropdownMenu.Item>Profile</DropdownMenu.Item>
      <DropdownMenu.Item>Billing</DropdownMenu.Item>
    </DropdownMenu.Group>
    <DropdownMenu.Separator />
    <DropdownMenu.Item>Log out</DropdownMenu.Item>
  </DropdownMenu.Content>
</DropdownMenu.Root>
```

**Critical**: `DropdownMenu.Trigger` uses `{#snippet child({ props })}` — singular `child`, NOT `children`.

#### Field — EXACT from docs (newer form pattern)

```svelte
<script lang="ts">
  import * as Field from "$lib/components/ui/field/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
</script>

<Field.Set>
  <Field.Legend>Profile</Field.Legend>
  <Field.Description>This appears on invoices and emails.</Field.Description>
  <Field.Group>
    <Field.Field>
      <Field.Label for="name">Full name</Field.Label>
      <Input id="name" placeholder="Evil Rabbit" />
    </Field.Field>
  </Field.Group>
</Field.Set>
```

**Anatomy**: `Field.Set` > `Field.Legend` + `Field.Description` > `Field.Group` > `Field.Field` > `Field.Label` + input + `Field.Description` + `Field.Error`

#### Form (Formsnap) — EXACT from docs

```svelte
<script lang="ts">
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  const form = superForm(initialForm, { validators: zod4Client(formSchema) });
  const { form: formData, enhance } = form;
</script>

<form method="POST" use:enhance>
  <Form.Field {form} name="username">
    <Form.Control>
      {#snippet children({ props })}
        <Form.Label>Username</Form.Label>
        <Input {...props} bind:value={$formData.username} />
      {/snippet}
    </Form.Control>
    <Form.Description>This is your public display name.</Form.Description>
    <Form.FieldErrors />
  </Form.Field>
  <Form.Button>Submit</Form.Button>
</form>
```

**Critical**: `Form.Control` uses `{#snippet children({ props })}` (plural `children`) and spreads `{...props}` to the input.

#### Tooltip — EXACT from docs

```svelte
<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
</script>

<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger><Button>Hover</Button></Tooltip.Trigger>
    <Tooltip.Content><p>Tooltip text</p></Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```

#### Select — EXACT from docs

```svelte
<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  let value = $state('');
</script>

<Select.Root type="single" bind:value={value}>
  <Select.Trigger>{value}</Select.Trigger>
  <Select.Content>
    <Select.Item value="option1">Option 1</Select.Item>
  </Select.Content>
</Select.Root>
```

### Import Rules (From Docs)

| Type | Components | Pattern |
|---|---|---|
| **Compositional** (namespace) | Card, Dialog, DropdownMenu, Tooltip, Select, Sidebar, Sheet, Form, Field, Breadcrumb, Accordion, Alert Dialog, Command, Context Menu, Hover Card, Menubar, Navigation Menu, Popover, Resizable, Scroll Area, Tabs | `import * as X from "$lib/components/ui/x/index.js"` |
| **Single** (named) | Button, Input, Badge, Progress, Spinner, Separator, Skeleton, Label, Textarea, Checkbox, Switch, Slider, Radio Group | `import { X } from "$lib/components/ui/x/index.js"` |

### Dark Mode — EXACT from docs

```svelte
<script lang="ts">
  import { ModeWatcher } from "mode-watcher";
  let { children } = $props();
</script>
<ModeWatcher />
{@render children?.()}
```

Toggle: `<Button onclick={toggleMode} variant="outline" size="icon">`

### Theming — CSS Custom Properties + OKLCH

```css
:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --primary: oklch(0.205 0 0);
}
```

Custom colors via `@theme inline { --color-warning: var(--warning); }`.

---

## Part 2: Reference Frontend Deep Comparison

### Architecture Comparison

| Aspect | Reference (`D:\Programming\frontend`) | Chithi (`D:\Programming\chithi\src\frontend`) | Verdict |
|---|---|---|---|
| Framework | SvelteKit + Svelte 5 runes | Same | Identical |
| UI Library | shadcn-svelte via bits-ui | Same | Identical |
| Styling | Tailwind CSS v4 + OKLCH | Same | Identical |
| State | TanStack Svelte Query | Same | Identical |
| Forms | formsnap + sveltekit-superforms + Zod v4 | Same | Identical |
| Database | IndexedDB (raw, single file) | IndexedDB (split modules) | Chithi more modular |
| Adapter | adapter-node | Same | Identical |
| WASM | None | chithi_wasm (Rust crypto) | Chithi-specific feature |
| Remote Functions | Not enabled | `experimental.remoteFunctions: true` | Chithi more advanced |
| COEP/COOP | Not set | Set in `hooks.ts` | Chithi requires for WASM |

### UI Component Inventory

| Category | Reference Count | Chithi Count | Extra in Chithi |
|---|---|---|---|
| **Total** | 29 | 42 | +13 components |
| Form & Input | Button, Input, Label, Select, Switch | Same + Checkbox, Radio Group, Slider, Textarea, Input Group, Field | +5 |
| Layout & Nav | Breadcrumb, Separator, Sidebar | Same | 0 |
| Overlays | Dialog, DropdownMenu, Tooltip | Same + Command, Popover | +2 |
| Feedback | Badge, Empty, Progress, Skeleton, Sonner | Same + Alert, Spinner | +2 |
| Display | Aspect Ratio, Avatar, Card, Table | Same + Chart, Data Table, Item, Kbd | +4 |
| Misc | Collapsible | Same + Toggle | +1 |

### Component Usage Pattern Comparison

#### Card

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Import | `import { Card, CardContent, ... }` (named) | `import * as Card` (namespace) | `import * as Card` (namespace) |
| Structure | `<Card>`, `<CardContent>` | `<Card.Root>`, `<Card.Content>` | `<Card.Root>`, `<Card.Content>` |

**Verdict**: Fully conformed — all 7 pages now use `import * as Card` with `<Card.Root>`, `<Card.Header>`, `<Card.Title>`, `<Card.Description>`, `<Card.Content>`, `<Card.Footer>`.

#### Dialog

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Import | `import * as Dialog` (namespace) | Same (with `.js` extension) | Namespace |
| Trigger | `buttonVariants({ variant: "outline" })` | Same | `buttonVariants()` |
| Content | `Dialog.Content class="sm:max-w-[425px]"` | Same | Matches docs |
| Close | `buttonVariants({ variant: "outline" })` | Same | `buttonVariants()` |

**Verdict**: Fully conformed in both.

#### DropdownMenu

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Trigger | `{#snippet child({ props })}` + `<Button {...props}>` | Same | Matches docs exactly |
| Content | `DropdownMenu.Content class="w-56" align="start"` | Same | Matches docs |
| Submenus | `DropdownMenu.Sub` for nested links | Same | Matches docs |

**Verdict**: Fully conformed in both.

#### Form (Formsnap)

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Form.Control | `{#snippet children({ props })}` + `{...props}` | Same | Matches docs |
| Form.FieldErrors | After Form.Control | Same | Matches docs |
| Form.Button | Submit via `Form.Button` | Same | Matches docs |

**Verdict**: Fully conformed in both.

#### Field (Newer Pattern)

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Import | Not used | `import * as Field` (namespace) | `import * as Field` |
| Structure | Not used | `<Field.Field>`, `<Field.Label>`, `<Field.Content>`, `<Field.Description>` | Matches docs |

**Verdict**: Fully conformed — all pages now use `import * as Field` with `<Field.Field>`, `<Field.Label>`, `<Field.Content>`, `<Field.Description>`. Chithi uses the **newer Field pattern** which is an improvement over bare Label.

#### Spinner

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Loading | `LoaderCircle` Lucide icon + `animate-spin` | `<Spinner>` component | Dedicated Spinner component |

**Verdict**: Chithi uses the **correct dedicated Spinner** component.

#### Select

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Usage | `type="single"` + `bind:value` | Same | Matches docs |

**Verdict**: Fully conformed.

#### Tooltip

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Provider | `Tooltip.Provider` wrapper | Same | Required |

**Verdict**: Fully conformed.

### Code Style Comparison

| Area | Reference | Chithi | Recommendation |
|---|---|---|---|
| **Import extensions** | No `.js` | `.js` everywhere | **Keep chithi** — explicit extensions are Svelte 5 / modernAst recommended |
| **Query formatting** | Expanded, `queryClient` | Was compressed, now expanded | **DONE** — already expanded |
| **Error handling** | Multi-line if/throw | Multi-line | Conformed |
| **Database** | Single file, `Date.now()` | Split modules, `Temporal.Now` | **Keep chithi** — better modularity |
| **Fetch utilities** | Repeated boilerplate | Centralized `fetchJson<T>()` | **Keep chithi** — better DRY |
| **Type safety** | Partial typing | Full interfaces | **Keep chithi** — stricter |
| **Page formatting** | Well-spaced, readable | Was compressed, being expanded | **In progress** — view page expanded |
| **Worker management** | Separate encrypt/decrypt workers | Unified `chithi.worker.ts` + WASM | **Keep chithi** — single worker pool |
| **Path aliases** | `$lib` only | `#queries/*`, `#functions/*`, `#consts/*`, `#css/*`, `#workers/*`, `#errors/*`, `#wasm/*` | **Keep chithi** — explicit, IDE-friendly |
| **Build-time globals** | Not used | `__APP_VERSION__`, `__COMMIT_SHA__` via Vite | **Keep chithi** — useful for info pages |
| **Variable naming** | Descriptive (`isPasswordEmpty`, `downloadProgress`) | Was abbreviated (`pwEmpty`, `prog`) | **Keep chithi** — already descriptive |

### What Chithi Does Better Than Reference

1. **Centralized fetch utilities** — `fetch-utils.ts` eliminates boilerplate
2. **Dedicated Spinner** — proper shadcn Spinner vs icon workaround
3. **Field component** — newer shadcn Field for accessibility
4. **CommandPalette** — Ctrl+K quick navigation
5. **Typed interfaces** — full type safety on all query results
6. **WASM crypto** — more performant than Web Crypto API
7. **Explicit import extensions** — Svelte 5 recommended
8. **Remote functions** — server-side login/logout
9. **COEP/COOP headers** — required for WASM
10. **Split database modules** — init, CRUD, types in separate files
11. **Temporal API** — more correct than `Date.now()`
12. **Query hooks** — extracted `useFileInfoQuery`, `useReverseQuery`

### Remaining Gaps (Need Attention)

1. **View page template** — still has some compressed one-line template elements (done for functions, template in progress).

---

## Part 3: Conformance Gaps Already Fixed

| Area | Before | After | Status |
|---|---|---|---|
| Raw `<input type="checkbox">` for password | Stage 2 | `<Switch.Root>` | DONE |
| Manual empty state div | Stage 2 | `<Empty.Root>` | DONE |
| ButtonGroup not in Triggers | Stage 3 | `ButtonGroup.Trigger` + snippets | DONE |
| QR code no aspect ratio | Stage 3 | `<AspectRatio>` wrapper | DONE |
| Invalid Tailwind `-translate-y/2` | Stage 2 | `top-1` | DONE |
| Missing shadcn components | 7 components | Installed via CLI | DONE |
| Spinner for loading states | Custom spinners | `<Spinner>` component | DONE |
| badgeVariants for links | Raw `<a>` tags | `badgeVariants()` | DONE |
| Form.Control missing snippet | Login form | `{#snippet children}` + `{...props}` | DONE |
| Alert for upload errors | None | `<Alert.Root>` inline | DONE |
| Kbd for paste shortcut | None | `<Kbd.Root>` hint | DONE |
| WASM worker signatures | Wrong arg counts | Aligned with wasm-bindgen | DONE |
| Temporal.Instant type errors | Raw numbers | String conversion | DONE |
| ReadableStream destructuring | `{ stream }` pattern | Direct return | DONE |
| BlobPart type errors | Uint8Array[] | Proper cast | DONE |
| Stale test imports | getChunkIv removed | Test cleaned | DONE |
| SvelteKit action implicit any | Untyped | Explicit types | DONE |
| Query file readability | Compressed one-liners | Expanded, `queryClient` | DONE |
| View page compressed functions | One-liners | Expanded functions | DONE |
| Reverse client compressed code | One-liners | Expanded functions | DONE |
| Card/Field import inconsistency | Named imports | Namespace imports | DONE |

---

## Part 4: Forward Work Plan

### Phase 14: Fix Card Import Consistency — DONE

Align all Card usages to the exact shadcn-svelte docs pattern:

- [x] Change home page (`+page.svelte`) from named imports to namespace import with `<Card.Root>`, `<Card.Content>`, etc.
- [x] Change host page (`host.svelte`) from named imports to namespace import
- [x] Change client page (`client.svelte`) from named imports to namespace import
- [x] Change speedtest page from named imports to namespace import
- [x] Change reverse landing page from named imports to namespace import
- [x] Change onboarding stage_1 and stage_2 from named imports to namespace import
- [x] Apply same treatment to Field component across all 7 files (`Field.Field`, `Field.Label`, `Field.Content`, `Field.Description`)

**Why**: The shadcn-svelte docs show `import * as Card` and `import * as Field` as the canonical pattern. Named imports work but are not the documented standard and may break if the component registry changes export structure.

### Phase 15: Install Remaining Useful Components

Components from the registry that would replace custom implementations:

- [ ] **accordion** — for FAQ/help sections on upload page
- [ ] **hover-card** — for rich previews on file lists
- [ ] **context-menu** — for right-click actions on file lists
- [ ] **carousel** — for showcase on home page
- [ ] **stepper** — for the 3-stage upload flow (replaces manual stage management)

**Why**: These are in the registry and would replace custom implementations with tested, accessible ones.

### Phase 16: CSS Final Polish

- [ ] Verify dark mode contrast ratios (WCAG AA) for all pages
- [ ] Audit Tailwind utility vs custom CSS overlap — replace custom CSS with Tailwind where equivalent
- [ ] Extract repeated icon-badge class `flex h-8 w-8 items-center justify-center rounded-full bg-primary/10` to a shared utility
- [ ] Verify `@theme inline` block maps all custom CSS variables to Tailwind semantic colors

**Why**: Ensures visual consistency and reduces CSS maintenance burden.

### Phase 17: Playwright Visual Verification

- [ ] Navigate to each page and verify rendering (home, upload, download, view, login, admin)
- [ ] Verify dark mode toggle works on all pages
- [ ] Verify responsive layout at mobile (375px), tablet (768px), desktop (1920px)
- [ ] Verify upload flow end-to-end (drop files -> encrypt -> share link)
- [ ] Verify form validation errors display correctly

**Why**: The only way to confirm no visual regressions after all changes.

---

## Part 5: shadcn-svelte Usage Rules (Quick Reference)

### Import Patterns
- **Single**: `import { Button } from "$lib/components/ui/button/index.js"`
- **Compositional**: `import * as Card from "$lib/components/ui/card/index.js"`

### Button Variants
- Variants: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
- Sizes: `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`

### Dialog Pattern
```svelte
<Dialog.Trigger type="button" class={buttonVariants({ variant: "outline" })}>Open</Dialog.Trigger>
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

### Field Pattern (Newer)
```svelte
<Field.Set>
  <Field.Legend>Title</Field.Legend>
  <Field.Group>
    <Field.Field>
      <Field.Label for="id">Label</Field.Label>
      <Input id="id" />
      <Field.Description>Helper text.</Field.Description>
      <Field.Error>Error message.</Field.Error>
    </Field.Field>
  </Field.Group>
</Field.Set>
```

### What NOT to Do
1. Do NOT manually copy component source — use CLI (`npx shadcn-svelte add`)
2. Do NOT use `<Button>` inside `Dialog.Trigger` — use `buttonVariants()`
3. Do NOT use `import Card from` for compositional components — always `import * as Card`
4. Do NOT add margin classes to icons inside buttons — spacing is automatic
5. Do NOT use media queries for dark mode — use `.dark` class + `mode-watcher`
6. Do NOT change component class names directly — change CSS variables
7. Do NOT invent your own component patterns — follow the docs exactly

---

## TypeScript Status

- All substantive TS errors resolved (WASM worker signatures, Temporal, ReadableStream, BlobPart, test imports, action handler types)
- Remaining TS2614 errors are in shadcn-svelte `index.ts` barrel files — known false positives where Svelte type export detection conflicts with TypeScript module resolution. Do not affect runtime or build.
- Build: `npm run build` succeeds with no errors
- Dev server: starts and serves all pages (200 OK)
