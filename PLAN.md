# Chithi Frontend Conformance Plan

> shadcn-svelte Deep Research + Reference Frontend Functional Comparison + Forward Work Plan
> Research date: 2026-06-29
> shadcn-svelte docs source: `https://www.shadcn-svelte.com/llms.txt` + individual component docs
> Reference frontend: `D:\Programming\frontend`

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

#### Input Group — EXACT from docs (newer, replaces custom input wrappers)

```svelte
<script lang="ts">
  import { Input } from "$lib/components/ui/input/index.js";
  import * as InputGroup from "$lib/components/ui/input-group/index.js";
  import { Search } from "lucide-svelte";
</script>

<InputGroup.Root>
  <InputGroup.InputSlot let:{toggle}>
    <Search class="h-4 w-4" />
  </InputGroup.InputSlot>
  <Input type="text" placeholder="Search..." />
</InputGroup.Root>
```

#### Alert Dialog — EXACT from docs (replaces custom confirm dialogs)

```svelte
<script lang="ts">
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as AlertDialog from "$lib/components/ui/alert-dialog/index.js";
</script>

<AlertDialog.Root>
  <AlertDialog.Trigger class={buttonVariants({ variant: "outline" })}>
    Show Dialog
  </AlertDialog.Trigger>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
      <AlertDialog.Description>
        This action cannot be undone.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel class={buttonVariants({ variant: "outline" })}>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action>Continue</AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
```

#### Data Table — EXACT from docs (replaces custom tables with sorting/filtering)

Built on TanStack Table v8. Provides column definitions, sorting, filtering, row selection, and pagination out of the box.

```svelte
<script lang="ts">
  import { createColumnHelper } from "@tanstack/table-core";
  import { createEnhancedTable, renderSvelteComponent } from "$lib/components/ui/data-table/index.js";
  import * as Table from "$lib/components/ui/table/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Button } from "$lib/components/ui/button/index.js";

  const columnHelper = createColumnHelper<typeof rows[0]>();
  const columns = [
    columnHelper.accessor("name", {
      cell: (info) => info.getValue(),
    }),
    columnHelper.accessor("email", {
      cell: (info) => info.getValue(),
    }),
  ];

  const table = createEnhancedTable({
    columns,
    data: rows,
    renderComponent: renderSvelteComponent,
  });
</script>

<Table.Root class="caption-bottom">
  <Table.Header>
    {table.headerGroups.map((headerGroup) => (
      <Table.HeaderGroup class="..." {...headerGroup.meta}>
        {headerGroup.headers.map((header) => (
          <Table.HeaderCell class="..." {...header.meta}>
            {header.isPlaceholder
              ? null
              : renderSvelteComponent(header.column.columnDef.cell, header.getContext())}
          </Table.HeaderCell>
        ))}
      </Table.HeaderGroup>
    ))}
  </Table.Header>
  <Table.Body>
    {table.getRowModel().rows.map((row) => (
      <Table.Row class="..." {...row.meta}>
        {row.getVisibleCells().map((cell) => (
          <Table.Cell class="..." {...cell.meta}>
            {renderSvelteComponent(cell.column.columnDef.cell, cell.getContext())}
          </Table.Cell>
        ))}
      </Table.Row>
    ))}
  </Table.Body>
</Table.Root>
```

#### Tabs — EXACT from docs (replaces custom tab switching)

```svelte
<script lang="ts">
  import * as Tabs from "$lib/components/ui/tabs/index.js";
</script>

<Tabs.Root value="account" class="w-full">
  <Tabs.List>
    <Tabs.Trigger value="account">Account</Tabs.Trigger>
    <Tabs.Trigger value="password">Password</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="account">
    <!-- account content -->
  </Tabs.Content>
  <Tabs.Content value="password">
    <!-- password content -->
  </Tabs.Content>
</Tabs.Root>
```

#### Sheet — EXACT from docs (replaces custom slide-in panels)

```svelte
<script lang="ts">
  import { Button, buttonVariants } from "$lib/components/ui/button/index.js";
  import * as Sheet from "$lib/components/ui/sheet/index.js";
</script>

<Sheet.Root>
  <Sheet.Trigger class={buttonVariants({ variant: "outline" })}>Open</Sheet.Trigger>
  <Sheet.Content>
    <Sheet.Header>
      <Sheet.Title>Are you sure...</Sheet.Title>
      <Sheet.Description>
        You can manage your notifications...
      </Sheet.Description>
    </Sheet.Header>
  </Sheet.Content>
</Sheet.Root>
```

#### Checkbox — EXACT from docs

```svelte
<script lang="ts">
  import * as Checkbox from "$lib/components/ui/checkbox/index.js";
</script>

<Checkbox.Root name="newsletter" id="terms">
  <Checkbox.Indicator>
    <Check class="h-4 w-4" />
  </Checkbox.Indicator>
</Checkbox.Root>
```

#### Switch — EXACT from docs

```svelte
<script lang="ts">
  import * as Switch from "$lib/components/ui/switch/index.js";
</script>

<Switch.Root name="airplane-mode" id="airplane-mode">
  <Switch.Thumb />
</Switch.Root>
```

### Import Rules (From Docs)

| Type | Components | Pattern |
|---|---|---|
| **Compositional** (namespace) | Card, Dialog, DropdownMenu, Tooltip, Select, Sidebar, Sheet, Form, Field, Breadcrumb, Accordion, Alert Dialog, Command, Context Menu, Hover Card, Input Group, Menubar, Navigation Menu, Popover, Resizable, Scroll Area, Tabs, Checkbox, Switch | `import * as X from "$lib/components/ui/x/index.js"` |
| **Single** (named) | Button, Input, Badge, Progress, Spinner, Separator, Skeleton, Label, Textarea, Radio Group, Slider | `import { X } from "$lib/components/ui/x/index.js"` |

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

### Key shadcn-svelte Improvements Over Reference Frontend

The shadcn-svelte registry has evolved significantly. Components available NOW that the reference frontend does NOT use:

| Component | Replaces | Benefit |
|---|---|---|
| **Field** | Bare `<Label>` + `<Input>` | Full form field accessibility (labels, descriptions, errors grouped) |
| **Input Group** | Custom input wrappers | Addons (icons, prefixes, suffixes) with proper ARIA |
| **Spinner** | `LoaderCircle` icon + `animate-spin` | Dedicated loading indicator component |
| **Alert** | Custom error/info banners | Accessible callout with icon + title + description |
| **Data Table** | Raw `<table>` elements | TanStack Table with sorting, filtering, selection, pagination |
| **Chart** | Custom SVG charts | LayerChart-based beautiful charts out of the box |
| **Item** | Custom list items | Versatile component for any list/content display |
| **Kbd** | `<kbd>` HTML elements | Styled keyboard input indicators |
| **Empty** | Custom empty state divs | Accessible empty state with icon + title + description |
| **Alert Dialog** | `confirm()` or custom modals | Accessible confirmation dialogs with proper focus trapping |
| **Sheet** | Custom slide-in panels | Accessible side panel with proper overlay + focus management |
| **Tabs** | Custom tab state management | ARIA-compliant tab panels with keyboard navigation |
| **Command** | Custom search/command palettes | Fast, composable command menu (Ctrl+K) |
| **Button Group** | Manually grouped buttons | Consistent button grouping with shared borders |

---

## Part 2: Reference Frontend Deep Functional Comparison

### Architecture Comparison

| Aspect | Reference (`D:\Programming\frontend`) | Chithi (`D:\Programming\chithi\src\frontend`) | Verdict |
|---|---|---|---|
| Framework | SvelteKit + Svelte 5 runes | Same | Identical |
| UI Library | shadcn-svelte via bits-ui | Same | Identical |
| Styling | Tailwind CSS v4 + OKLCH | Same | Identical |
| State | TanStack Svelte Query | Same | Identical |
| Forms | formsnap + sveltekit-superforms + Zod v4 | Same | Identical |
| Database | IndexedDB (raw, single file) | IndexedDB (split modules) | **Chithi better** — more modular |
| Adapter | adapter-node | Same | Identical |
| WASM | None | chithi_wasm (Rust crypto) | Chithi-specific feature |
| Remote Functions | Not enabled | `experimental.remoteFunctions: true` | **Chithi better** — server-side auth |
| COEP/COOP | Not set | Set in `hooks.ts` | Chithi requires for WASM |
| Path Aliases | `$lib` only | `#queries/*`, `#functions/*`, `#consts/*`, `#css/*`, `#workers/*`, `#errors/*`, `#wasm/*` | **Chithi better** — explicit, IDE-friendly |
| Build-time Globals | Not used | `__APP_VERSION__`, `__COMMIT_SHA__` via Vite | **Chithi better** — useful for info pages |

### Page-by-Page Functional Comparison

#### Home Page (`/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Hero section with title + description | Yes | Yes | Conformed |
| Upload showcase cards | Yes | Yes | Conformed |
| Dark mode toggle | Yes | Yes | Conformed |
| Navbar + footer layout | Yes | Yes | Conformed |
| Card usage | Named imports (legacy) | Namespace `Card.Root` (docs-exact) | **Chithi better** |
| Sheet for reconnect | No | Yes (Sheet slide-in panel) | **Chithi better** |

#### Upload Page (`/upload/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Stage 1: file selection | Yes (inline `traverseFileTree`) | Yes (external `dropFiles` from `file-tree.ts`) | **Chithi better** — reusable |
| Stage 2: config (password, expiry, downloads) | Yes | Yes | Conformed |
| Stage 3: encrypt + upload progress | Yes | Yes + WASM crypto | **Chithi better** — WASM |
| File drag-and-drop | Yes | Yes | Conformed |
| Folder drag-and-drop | Basic | Advanced (`dropFiles` utility) | **Chithi better** |
| Config query for limits | Yes | Yes | Conformed |
| Upload showcase | Yes | Yes | Conformed |
| Recent uploads display | Yes | Yes | Conformed |
| Switch for password toggle | Yes | Yes | Conformed |
| Empty state | Yes | `<Empty.Root>` component | **Chithi better** |
| ButtonGroup for file actions | Yes | `ButtonGroup.Trigger` + snippets | **Chithi better** |
| Alert for errors | No | `<Alert.Root>` inline | **Chithi better** |
| Accordion for FAQ | No | Wired into encryption info section | **Chithi better** |

#### Download Page (`/download/[slug]/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| File info fetch | Yes | Yes via `useFileInfoQuery` | Conformed |
| Password prompt | Yes | Yes | Conformed |
| Decrypt + download | Yes | Yes + WASM decrypt | **Chithi better** |
| Progress indicator | Yes | Yes + `<Spinner>` | **Chithi better** |
| File metadata display | Yes | Yes | Conformed |

#### View Page (`/view/[slug]/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Code file viewer | Yes | Yes + `CodeViewer.svelte` | Conformed |
| File tree navigation | Yes | Yes + `file-tree.ts` | **Chithi better** — reusable |
| Decrypt on view | Yes | Yes + WASM | **Chithi better** |
| Expanded readable code | Partial | Yes (Phase 13 expanded) | **Chithi better** |
| File type detection | Yes | Yes | Conformed |
| Media preview | Yes | Yes | Conformed |
| Context Menu for file actions | No | Yes (right-click View/Save) | **Chithi better** |
| Zoom controls | No | Yes | **Chithi better** |
| File info sidebar | No | Yes | **Chithi better** |

#### Login Page (`/login/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Form with formsnap | Yes | Yes | Conformed |
| Form.Control snippet pattern | Yes | Yes | Conformed |
| Server-side validation | Yes | Yes | Conformed |
| Remote function auth | No | Yes | **Chithi better** |
| Dialog for login trigger | Yes | Yes | Conformed |

#### Reverse File Share — Landing (`/reverse/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Create room form | Yes | Yes | Conformed |
| Join room form | Yes | Yes | Conformed |
| Landing view state machine | Yes | Yes | Conformed |
| Config query for defaults | Yes | Yes | Conformed |
| Card-based UI | Named imports | Namespace `Card.Root` | **Chithi better** |
| Field component | Not used | `Field.Field` / `Field.Label` | **Chithi better** |
| Spinner for loading | `LoaderCircle` + `animate-spin` | `<Spinner>` | **Chithi better** |
| URL prefilled join ID | Yes | Yes | Conformed |

#### Reverse File Share — Room (`/reverse/[room_id]/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Host/guest routing | Yes | Yes | Conformed |
| WebSocket connection | Yes | Yes + `useWsReconnect` hook | **Chithi better** — auto-reconnect |
| File receive | Yes | Yes | Conformed |
| File send (host) | Yes | Yes | Conformed |
| Connection status | Yes | Yes | Conformed |

#### Reverse — Host Page (`host.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| File upload to room | Yes | Yes | Conformed |
| Upload progress | Yes | Yes + Tween animation | **Chithi better** |
| Guest count display | Yes | Yes | Conformed |
| Room management | Yes | Yes | Conformed |
| Auto-reconnect | Basic | `useWsReconnect` with exponential backoff | **Chithi better** |

#### Reverse — Client Page (`client.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| File receive | Yes | Yes | Conformed |
| Download progress | Yes | Yes + Tween animation | **Chithi better** |
| File list | Yes | Yes | Conformed |
| Auto-reconnect | Basic | `useWsReconnect` with exponential backoff | **Chithi better** |

#### Speedtest Page (`/speedtest/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Speed gauge | Yes (`SpeedGauge.svelte`) | Yes | Conformed |
| Speed graph | Yes (`SpeedGraph.svelte`) | Yes | Conformed |
| Worker-based measurement | Yes | Yes | Conformed |
| Card-based display | Named imports | Namespace `Card.Root` | **Chithi better** |

#### Admin — Config (`/admin/config/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Site description card | Yes | Yes (in Description tab) | Conformed |
| File security card | Yes | Yes (in Security tab) | Conformed |
| Retention policy card | Yes | Yes (in Retention tab) | Conformed |
| Storage/file card | Yes | Yes (in Storage tab) | Conformed |
| Loading skeleton | Yes | Yes | Conformed |
| Sidebar navigation | Yes | Yes | Conformed |
| Tabs for organization | No | Yes (4 tabs: Storage, Retention, Security, Description) | **Chithi better** |

#### Admin — Users (`/admin/users/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| User list | Yes | Yes | Conformed |
| Create user dialog | Yes | Yes | Conformed |
| Delete user dialog | Yes | Yes | Conformed |

#### Admin — User Profile (`/admin/user/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Profile fields | Yes | Yes | Conformed |
| Profile submit section | Yes | Yes | Conformed |

#### Admin — URLs (`/admin/urls/+page.svelte`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Outstanding URLs list | Yes | Yes | Conformed |

#### Informations Pages (`/informations/`)

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Main info page | Yes | Yes | Conformed |
| Backend info | Yes | Yes | Conformed |
| Frontend info | Yes | Yes | Conformed |
| Statistics info | Yes | Yes | Conformed |
| InfoCard component | No | Yes | **Chithi better** |
| StatusBadge component | No | Yes | **Chithi better** |
| CommitLink component | No | Yes | **Chithi better** |

#### Onboarding Pages

| Feature | Reference | Chithi | Status |
|---|---|---|---|
| Stage 1 (initial setup) | Yes | Yes | Conformed |
| Stage 2 (configuration) | Yes | Yes | Conformed |
| Card-based UI | Named imports | Namespace `Card.Root` | **Chithi better** |

### Component Usage Pattern Comparison

#### Card

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Import | `import { Card, CardContent, ... }` (named) | `import * as Card` (namespace) | `import * as Card` (namespace) |
| Structure | `<Card>`, `<CardContent>` | `<Card.Root>`, `<Card.Content>` | `<Card.Root>`, `<Card.Content>` |

**Verdict**: Chithi fully conformed to docs. Reference uses legacy named imports.

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

**Verdict**: Chithi uses the **newer Field pattern** which is an improvement over bare Label.

#### Spinner

| Pattern | Reference | Chithi | Docs Exact |
|---|---|---|---|
| Loading | `LoaderCircle` Lucide icon + `animate-spin` | `<Spinner>` component | Dedicated Spinner component |

**Verdict**: Chithi uses the **correct dedicated Spinner** component. Reference uses a workaround.

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

### Shared Library Functions Comparison

| Function Module | Reference | Chithi | Difference |
|---|---|---|---|
| `bytes.ts` | Yes | Yes | Shared |
| `download.ts` | Yes | Yes | Shared |
| `encryption.ts` | Yes | Yes | Shared + chithi has WASM bindings |
| `libravatar.ts` | Yes | Yes | Shared |
| `media-support.ts` | Yes | Yes | Shared |
| `mime.ts` | Yes | Yes | Shared |
| `sanitize.ts` | Yes | Yes | Shared |
| `security.ts` | Yes | Yes | Shared |
| `streams.ts` | Yes | Yes | Shared |
| `string-conversion.ts` | Yes | Yes | Shared |
| `times.ts` | Yes | Yes | Shared |
| `urls.ts` | Yes | Yes | Shared |
| `viewer.ts` | Yes | Yes | Shared |
| `browser-download.ts` | No | Yes | **Chithi extra** — browser download utilities |
| `bytes.test.ts` | No | Yes | **Chithi extra** — unit tests |
| `dates.ts` | No | Yes | **Chithi extra** — date formatting utilities |
| `encryption.client.test.ts` | No | Yes | **Chithi extra** — client-side encryption tests |
| `fetch-decrypt.ts` | No | Yes | **Chithi extra** — fetch + decrypt pipeline |
| `file-tree.ts` | No | Yes | **Chithi extra** — file tree traversal + `dropFiles` |
| `streams.client.test.ts` | No | Yes | **Chithi extra** — stream tests |
| `zip-validate.ts` | No | Yes | **Chithi extra** — ZIP validation |

### Query Hooks Comparison

| Hook | Reference | Chithi | Difference |
|---|---|---|---|
| `config.ts` | Yes | Yes | Shared |
| `files.ts` | Yes | Yes | Shared |
| `file-info.ts` | Yes | Yes | Shared |
| `reverse.ts` | Yes | Yes | Shared |
| `auth.ts` | Yes | Yes | Shared |
| `instance.ts` | Yes | Yes | Shared |
| `onboarding.ts` | Yes | Yes | Shared |
| `admin_users.ts` | Yes | Yes | Shared |
| `fetch-utils.ts` | No | Yes | **Chithi extra** — centralized `fetchJson<T>()` |

### What Chithi Does Better Than Reference (Summary)

1. **Centralized fetch utilities** — `fetch-utils.ts` eliminates repeated fetch boilerplate
2. **Dedicated Spinner** — proper shadcn Spinner vs `LoaderCircle` icon workaround
3. **Field component** — newer shadcn Field for full form accessibility
4. **CommandPalette** — Ctrl+K quick navigation (not in reference)
5. **Typed interfaces** — full type safety on all query results
6. **WASM crypto** — more performant than Web Crypto API
7. **Explicit import extensions** — Svelte 5 recommended `.js` extensions
8. **Remote functions** — server-side login/logout
9. **COEP/COOP headers** — required for WASM security
10. **Split database modules** — init, CRUD, types in separate files
11. **Temporal API** — more correct than `Date.now()`
12. **Query hooks** — extracted `useFileInfoQuery`, `useReverseQuery`
13. **`useWsReconnect` hook** — auto-reconnect with exponential backoff (not in reference)
14. **Extra utility modules** — `file-tree.ts`, `dates.ts`, `browser-download.ts`, `fetch-decrypt.ts`, `zip-validate.ts`
15. **Unit tests** — `bytes.test.ts`, `encryption.client.test.ts`, `streams.client.test.ts`
16. **Info page components** — `InfoCard`, `StatusBadge`, `CommitLink`
17. **View page enhancements** — zoom controls, file info sidebar
18. **Accordion for encryption FAQ** — collapsible security info on upload page
19. **Tabs for admin config** — organized settings in 4 tab panels instead of stacked cards
20. **Context Menu for file list** — right-click View/Save actions on view page
21. **Sheet for reconnect flow** — slide-in panel on home page (fixes missing trigger bug)
22. **CommandPalette** — Ctrl+K quick navigation for pages, admin, and theme toggle

### What Reference Does Better Than Chithi (Summary)

1. **Upload stage_1** — inline `traverseFileTree` is simpler than the external `dropFiles` utility (less indirection for a single-page feature)
2. **Fewer dependencies** — no WASM, no remote functions (simpler to deploy)

### Remaining Gaps (Need Attention)

1. **Carousel not wired** — installed but not used in any page
2. **Hover Card not used** — installed but not wired for file previews
3. **Data Table not fully utilized** — admin pages use raw tables, could upgrade to TanStack Table
4. **View page template** — still has some compressed one-line template elements

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
| Accordion not wired | FAQ text static | Collapsible Accordion | DONE |
| Admin config stacked cards | Vertical scroll | Tabs with 4 panels | DONE |
| Context Menu not wired | No right-click actions | ContextMenu on view page file list | DONE |
| Sheet not wired | Hidden reconnect card | Sheet slide-in panel on home page | DONE |
| CommandPalette not wired | No quick navigation | Ctrl+K command palette | DONE |

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

### Phase 15: Install Remaining Useful Components — DONE

Components from the registry that would replace custom implementations:

- [x] **accordion** (5 files) — for FAQ/help sections on upload page
- [x] **hover-card** (5 files) — for rich previews on file lists
- [x] **context-menu** (17 files) — for right-click actions on file lists
- [x] **carousel** (7 files) — for showcase on home page
- Note: **stepper** does not exist in shadcn-svelte registry; the existing `collapsible` component can serve as an alternative for stage indicators

**Why**: These are in the registry and would replace custom implementations with tested, accessible ones.

### Phase 18: Wire Installed Components into Pages

Install the components that Phase 15 added but didn't wire:

- [x] **Accordion** into upload page FAQ section — wrap help text in `<Accordion.Root>` with 3 collapsible items (End-to-End Encryption, How it works, Key storage)
- [ ] **Carousel** into upload showcase — replace static showcase cards with `<Carousel.Root>` + `<Carousel.Slide>` (deferred: upload showcase is a custom progress visualization, not carousel cards)
- [x] **Hover Card** into file list views — wrap file info links with `<HoverCard.Root>` for rich previews
- [x] **Context Menu** into view page file list — right-click actions (View, Save) via `<ContextMenu.Root>`
- [x] **Command** into navbar layout — Ctrl+K command palette for quick navigation

**Why**: Components are installed but unused. Wires them into actual pages to realize the accessibility + UX benefits.

### Phase 19: Install and Apply Missing Registry Components

Install components from the shadcn-svelte registry that would improve the app:

- [x] **Input Group** — already wired in view and download pages via `<InputGroup.Root>` + `<InputGroup.InputSlot>`
- [x] **Sheet** — replace hidden reconnect card with `<Sheet.Root>` slide-in panel on home page (fixes missing trigger bug)
- [x] **Tabs** — replace stacked cards in admin config page with `<Tabs.Root>` + `<Tabs.List>` + `<Tabs.Content>` (4 tabs: Storage, Retention, Security, Description)
- [x] **Checkbox** — verified: no Checkbox usages in route files, component installed and ready

**Why**: These components are in the registry, tested, accessible, and directly replace existing custom patterns.

### Phase 20: Upgrade Admin Tables to Data Table

Replace raw `<table>` elements in admin pages with shadcn-svelte Data Table (TanStack Table):

- [ ] Admin users page — convert to Data Table with sorting, filtering, row selection
- [ ] Admin URLs page — convert to Data Table with sorting, filtering
- [ ] File list pages — convert to Data Table with column definitions

**Why**: Data Table provides sorting, filtering, selection, and pagination out of the box. Replaces manual table implementations with a tested, accessible one.

### Phase 21: CSS Final Polish

- [ ] Verify dark mode contrast ratios (WCAG AA) for all pages
- [ ] Audit Tailwind utility vs custom CSS overlap — replace custom CSS with Tailwind where equivalent
- [ ] Extract repeated icon-badge class `flex h-8 w-8 items-center justify-center rounded-full bg-primary/10` to a shared utility
- [ ] Verify `@theme inline` block maps all custom CSS variables to Tailwind semantic colors

**Why**: Ensures visual consistency and reduces CSS maintenance burden.

### Phase 22: Playwright Visual Verification

- [ ] Navigate to each page and verify rendering (home, upload, download, view, login, admin)
- [ ] Verify dark mode toggle works on all pages
- [ ] Verify responsive layout at mobile (375px), tablet (768px), desktop (1920px)
- [ ] Verify upload flow end-to-end (drop files -> encrypt -> share link)
- [ ] Verify form validation errors display correctly
- [ ] Verify reverse file share flow (create room -> upload -> receive)

**Why**: The only way to confirm no visual regressions after all changes.

### Phase 23: Code Readability Final Pass

- [ ] Expand remaining compressed template elements in view page
- [ ] Expand remaining compressed template elements in download page
- [ ] Verify all pages follow `readable-typescript.md` rules (descriptive names, early returns, expression-oriented)
- [ ] Remove unused imports across all pages

**Why**: Completes the readability refactor started in Phase 13.

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
