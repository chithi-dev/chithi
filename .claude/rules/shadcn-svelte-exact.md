---
description: Enforce exact shadcn-svelte documentation patterns for all Svelte component code. Never deviate from the official docs.
glob: "*.svelte"
---

# shadcn-svelte: Follow Docs Exactly

Every shadcn-svelte component usage in this project **must match the official documentation exactly**. Never invent your own patterns. Never guess. Always follow the docs verbatim.

## Source of Truth

The official registry documentation is the only reference:
- **LLM docs**: `https://www.shadcn-svelte.com/llms.txt`
- **Main docs**: `https://www.shadcn-svelte.com/docs`
- **GitHub**: `https://github.com/huntabyte/shadcn-svelte`

Before writing any shadcn-svelte component code, check the docs for the exact example. If unsure, look it up.

---

## Core Principles

shadcn-svelte is **not a component library** — it's a code distribution system. Components are cloned into the project via CLI, giving full ownership. Built on:
- **Bits UI** (headless accessible primitives) for ARIA + keyboard navigation
- **Tailwind CSS v4** with OKLCH color space
- **tailwind-variants** (`tv()`) for variant/size styling
- **Svelte 5 runes** (`$state`, `$derived`, `$props()`, `$bindable`, `{#snippet}`)

---

## Import Patterns — EXACT

### Single Components (named imports)

```svelte
<script lang="ts">
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { Badge } from "$lib/components/ui/badge/index.js";
  import { Progress } from "$lib/components/ui/progress/index.js";
</script>
```

### Compositional Components (namespace imports)

```svelte
<script lang="ts">
  import * as Card from "$lib/components/ui/card/index.js";
  import * as Dialog from "$lib/components/ui/dialog/index.js";
  import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js";
  import * as Select from "$lib/components/ui/select/index.js";
  import * as Form from "$lib/components/ui/form/index.js";
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
</script>
```

**Rule**: Compositional components (Card, Dialog, DropdownMenu, Form, Tooltip, Select, Sidebar, Sheet, etc.) **always** use `import * as X`. Single components (Button, Input, Badge, Progress, etc.) **always** use `import { X }`.

---

## Button Usage — EXACT

```svelte
<Button>Default</Button>
<Button variant="outline">Outline</Button>
<Button variant="secondary">Secondary</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Destructive</Button>
<Button variant="link">Link</Button>
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>
<Button size="icon" aria-label="Submit">
  <ArrowUpIcon />
</Button>
<Button href="/dashboard">Dashboard</Button>
<Button class="rounded-full">Rounded</Button>
```

**Variants**: `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`
**Sizes**: `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`

**Icons inside buttons need no margin** — spacing is automatic based on button size.

**For non-button elements styled as buttons**, use `buttonVariants()`:

```svelte
<script lang="ts">
  import { buttonVariants } from "$lib/components/ui/button/index.js";
</script>

<a class={buttonVariants({ variant: "outline" })}>Link as button</a>
```

---

## Card Usage — EXACT

```svelte
<Card.Root class="w-full max-w-sm">
  <Card.Header>
    <Card.Title>Login</Card.Title>
    <Card.Description>Enter your email below</Card.Description>
  </Card.Header>
  <Card.Content>
    <Input placeholder="m@example.com" />
  </Card.Content>
  <Card.Footer>
    <Button class="w-full">Login</Button>
  </Card.Footer>
</Card.Root>
```

**Parts**: `Card.Root`, `Card.Header`, `Card.Content`, `Card.Footer`, `Card.Title`, `Card.Description`

---

## Dialog Usage — EXACT

```svelte
<Dialog.Root>
  <Dialog.Trigger class={buttonVariants({ variant: "outline" })}>
    Open Dialog
  </Dialog.Trigger>
  <Dialog.Content class="sm:max-w-[425px]">
    <Dialog.Header>
      <Dialog.Title>Edit profile</Dialog.Title>
      <Dialog.Description>Make changes here.</Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4">
      <Input name="name" defaultValue="Pedro Duarte" />
    </div>
    <Dialog.Footer>
      <Dialog.Close class={buttonVariants({ variant: "outline" })}>Cancel</Dialog.Close>
      <Button>Save</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
```

**Parts**: `Dialog.Root`, `Dialog.Trigger`, `Dialog.Content`, `Dialog.Header`, `Dialog.Footer`, `Dialog.Title`, `Dialog.Description`, `Dialog.Close`, `Dialog.CloseIcon`

**Critical**: `Dialog.Trigger` and `Dialog.Close` use `buttonVariants()` — not `<Button>` directly.

---

## Dropdown Menu Usage — EXACT

```svelte
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

**Critical**: `DropdownMenu.Trigger` uses `{#snippet child({ props })}` — **not** `{#snippet children({ props })}`. This is the exact pattern from the docs.

---

## Form Usage — EXACT

Forms use **Formsnap** + **sveltekit-superforms** + **Zod**.

```svelte
<script lang="ts">
  import * as Form from "$lib/components/ui/form/index.js";
  import { Input } from "$lib/components/ui/input/index.js";
  import { formSchema } from "./schema";
  import { superForm } from "sveltekit-superforms";
  import { zod4Client } from "sveltekit-superforms/adapters";

  const form = superForm(initialForm, {
    validators: zod4Client(formSchema),
  });
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

**Structure**: `Form.Field` → `Form.Control` → `{#snippet children({ props })}` → input with `{...props}` and `bind:value`
**Validation**: Always use `Form.FieldErrors` for error display
**Helper text**: Always use `Form.Description` for helper text

---

## Tooltip Usage — EXACT

```svelte
<script lang="ts">
  import * as Tooltip from "$lib/components/ui/tooltip/index.js";
</script>

<Tooltip.Provider>
  <Tooltip.Root>
    <Tooltip.Trigger>
      <Button>Hover</Button>
    </Tooltip.Trigger>
    <Tooltip.Content>
      <p>Tooltip text</p>
    </Tooltip.Content>
  </Tooltip.Root>
</Tooltip.Provider>
```

**Parts**: `Tooltip.Provider`, `Tooltip.Root`, `Tooltip.Trigger`, `Tooltip.Content`, `Tooltip.Arrow`

---

## Select Usage — EXACT

```svelte
<script lang="ts">
  import * as Select from "$lib/components/ui/select/index.js";
  let value = $state('');
</script>

<Select.Root type="single" bind:value={value}>
  <Select.Trigger>
    {value}
  </Select.Trigger>
  <Select.Content>
    <Select.Item value="option1">Option 1</Select.Item>
    <Select.Item value="option2">Option 2</Select.Item>
  </Select.Content>
</Select.Root>
```

**Parts**: `Select.Root` (with `type="single"` and `bind:value`), `Select.Trigger`, `Select.Content`, `Select.Item`, `Select.Group`, `Select.Label`, `Select.Separator`, `Select.Arrow`

---

## Theming — EXACT

All colors controlled via **CSS custom properties** in global CSS. Convention is `--name` for background and `--name-foreground` for text color.

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
  --secondary: oklch(0.97 0 0);
  --secondary-foreground: oklch(0.205 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0);
  --accent: oklch(0.97 0 0);
  --accent-foreground: oklch(0.205 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --border: oklch(0.922 0 0);
  --input: oklch(0.922 0 0);
  --ring: oklch(0.708 0 0);
}
```

**Adding custom colors**:

```css
:root {
  --warning: oklch(0.84 0.16 84);
  --warning-foreground: oklch(0.28 0.07 46);
}

@theme inline {
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
}
```

Then use: `<div class="bg-warning text-warning-foreground">`

---

## Dark Mode — EXACT

Use `mode-watcher` package:

```svelte
<script lang="ts">
  import "../app.css";
  import { ModeWatcher } from "mode-watcher";
  let { children } = $props();
</script>
<ModeWatcher />
{@render children?.()}
```

Toggle button:

```svelte
<script lang="ts">
  import { toggleMode } from "mode-watcher";
  import { Button } from "$lib/components/ui/button/index.js";
</script>
<Button onclick={toggleMode} variant="outline" size="icon">
  <SunIcon class="dark:scale-0" />
  <MoonIcon class="scale-0 dark:scale-100" />
</Button>
```

Or dropdown selector with `setMode("light")`, `setMode("dark")`, `resetMode()`.

---

## Class Merging — EXACT

Always use the `cn()` utility from `$lib/utils.ts`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

---

## Icons — EXACT

Always use `@lucide/svelte`:

```svelte
<script lang="ts">
  import LockIcon from "@lucide/svelte/icons/lock";
  import { ArrowUp } from "@lucide/svelte";
</script>
```

---

## What NOT to Do

1. **Do NOT** manually copy component source — use CLI (`npx shadcn-svelte add`)
2. **Do NOT** try to override component styles via props — edit component source directly
3. **Do NOT** use `import Card from` for compositional components — always `import * as Card`
4. **Do NOT** use `<Button>` inside `Dialog.Trigger` — use `buttonVariants()`
5. **Do NOT** add margin classes to icons inside buttons — spacing is automatic
6. **Do NOT** use media queries for dark mode — use `.dark` class + `mode-watcher`
7. **Do NOT** change component class names directly — change CSS variables
8. **Do NOT** invent your own component patterns — follow the docs exactly

---

## Enforcement

When writing any shadcn-svelte component:
1. Check the docs for the exact example
2. Copy the pattern verbatim
3. Adapt only the content (text, values, bindings)
4. Never change the structure, props, or component hierarchy from the docs
