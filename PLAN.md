# Frontend Rewrite Plan — Aligning Chithi Frontend with Reference Standard

## 0. Architecture Decision: Single Agnostic WASM + Wasmtime for Python

### Current State (BEFORE)
```
Rust source
├── chithi-core crate (crypto logic)
├── wasm_bindings crate ──wasm-bindgen──> .wasm ──vite-plugin-wasm──> JS frontend
└── python_bindings crate ──PyO3/maturin──> .so/.pyd ──import──> Python SDK
```
Two separate binding layers (wasm-bindgen for JS, PyO3 for Python), two build pipelines, duplicated FFI glue code.

### Target State (AFTER)
```
Rust source
├── chithi-core crate (crypto logic)
└── chithi_wasm crate ──#[no_mangle] extern "C"──> single .wasm
       ├── JS frontend ──vite-plugin-wasm──> browser (SharedArrayBuffer, workers)
       └── Python SDK ──wasmtime pip──> Python (wasmtime JIT runtime)
```
**One WASM module, one build pipeline, one source of truth.** Both JS and Python consume the same `.wasm` file.

### Why This Matters
| Aspect | PyO3 (old) | Wasmtime (new) |
|---|---|---|
| Build | `maturin build` per OS/arch → `.so`, `.pyd`, `.whl` | `cargo build --target wasm32-unknown-unknown` → single `.wasm` |
| Cross-platform | Must build wheels for Linux, macOS, Windows, ARM | Same `.wasm` runs everywhere wasmtime runs |
| Binding code | `#[pyfunction]`, `#[pymodule]`, `PyResult<T>`, GIL management | `#[no_mangle] extern "C"`, raw C ABI, no host-specific glue |
| Memory safety | Native .so can segfault Python | WASM sandbox isolates crashes |
| WASM JS compat | Separate wasm-bindgen crate needed | Same `.wasm` works in browser (with wasm-bindgen init shim) |
| Python install | Binary wheels, platform-specific | `pip install wasmtime`, pure Python package |

### WASM Interface Contract (Agnostic C ABI)
The WASM module exports **pure C functions** — no `wasm_bindgen` annotations, no `PyO3` types. All data passes through linear memory via pointer + length:

```rust
// BEFORE (wasm-bindgen — JS-specific)
#[wasm_bindgen]
pub fn encrypt_chunk(chunk: &[u8], key: &[u8], nonce: &[u8]) -> Vec<u8> { ... }

// AFTER (agnostic C ABI — works for both JS and Python)
#[no_mangle]
pub extern "C" fn encrypt_chunk(
    data_ptr: *const u8, data_len: u32,
    key_ptr: *const u8, key_len: u32,
    nonce_ptr: *const u8, nonce_len: u32,
    out_ptr: *mut u8, out_len: u32
) -> u32 {  // returns bytes written
    let slice = unsafe { std::slice::from_raw_parts(data_ptr, data_len) };
    let key = unsafe { std::slice::from_raw_parts(key_ptr, key_len) };
    let nonce = unsafe { std::slice::from_raw_parts(nonce_ptr, nonce_len) };
    let out = unsafe { std::slice::from_raw_parts_mut(out_ptr, out_len) };
    let written = chithi_core::encrypt_chunk(slice, key, nonce, out);
    written as u32
}
```

### Memory Management Pattern
- WASM exposes `memory` (exported linear memory)
- WASM exposes `alloc(len) -> ptr` and `dealloc(ptr, len)` for large buffers
- Caller writes input at known offsets, callee writes output to caller-allocated buffer
- For small returns: function returns value directly (i32, i64)
- For large returns: caller pre-allocates output buffer, callee writes into it

### Wasmtime Python Integration
```python
# BEFORE (PyO3)
import chithi_core  # compiled .so/.pyd
bundle = chithi_core.upload(files, password)

# AFTER (wasmtime)
from wasmtime import Store, Module, Instance
store = Store()
module = Module.from_file(store.engine, "chithi_wasm.wasm")
instance = Instance(store, module, [])
memory = instance.exports(store)["memory"]
# Pass data via linear memory, call exported C functions
```

### Migration Path
1. **Rewrite `wasm_bindings` crate** → agnostic C ABI, no `wasm-bindgen` macro dependency for exports
2. **Keep `wasm-bindgen` for JS init only** → `init()` function for memory growth, nothing else
3. **Drop `python_bindings` crate entirely** → no more PyO3, no more maturin
4. **Rewrite Python SDK** → `wasmtime` host calls, memory management wrapper
5. **Ship single `.wasm`** → embedded in Python wheel, loaded by JS frontend

### What Stays the Same
- `chithi-core` Rust crate (the crypto logic: Argon2, AES-GCM, 7z, Ed25519) — **untouched**
- JS frontend worker architecture (`chithi.worker.ts`) — **already done**
- Stream pipeline (`streams.ts`) — **already updated**
- SvelteKit frontend structure — **already aligned**

---

## 1. Web Research Summary: shadcn-svelte (v1.3.0)

### Core Architecture
shadcn-svelte is **not a component library** — it's a code distribution system. Components are cloned into your project via CLI, giving you full ownership. Built on:
- **Bits UI** (headless accessible primitives) for ARIA + keyboard navigation
- **Tailwind CSS v4** with OKLCH color space
- **tailwind-variants** (`tv()`) for variant/size styling
- **Svelte 5 runes** (`$state`, `$derived`, `$props()`, `$bindable`, `{#snippet}`)

### Key Conventions (from official docs)

| Convention | Detail |
|---|---|
| **Component imports** | Named imports for single components (`import { Button }`), namespace imports for compositional (`import * as Dialog`) |
| **CSS theming** | All colors via CSS custom properties (`--primary`, `--foreground`, etc.) in global CSS |
| **Dark mode** | `mode-watcher` package + `.dark` class toggle, not media query |
| **Class merging** | `cn()` utility (`clsx` + `tailwind-merge`) in `$lib/utils.ts` |
| **Button variants** | `buttonVariants()` helper from `tv()` applies button styling to non-button elements |
| **Icons** | `@lucide/svelte` is the standard icon library |
| **Component structure** | Each component in its own `.svelte` file, re-exported from `index.ts` |
| **Forms** | Formsnap + sveltekit-superforms + Zod for validation |
| **AI-ready** | Components designed for LLM consumption — clean, explicit code |

### 57 Available Components
Button, Accordion, Alert, AlertDialog, AspectRatio, Avatar, Badge, Breadcrumb, Calendar, Card, Carousel, Checkbox, Collapsible, Combobox, Command, ContextMenu, Datepicker, Dialog, Drawer, DropdownMenu, Field, HoverCard, Input, InputOTP, Item, Label, Menubar, NavigationMenu, Pagination, Popover, Progress, RadioGroup, RangeCalendar, Resizable, ScrollArea, Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Spinner, Switch, Tabs, Table, Textarea, Toggle, ToggleGroup, Tooltip, Chart, DataTable, DatePicker, Empty, InputGroup, Kbd

### Best Practices from Docs
1. Use CLI (`npx shadcn-svelte add`) — don't manually copy components
2. Edit component source directly to customize
3. Use namespace imports for compositional components (`Dialog.Root`, `Card.Header`)
4. CSS variables for all theming — change variables, not component classes
5. Icons inside buttons need no margin — spacing is automatic
6. Use `buttonVariants()` for links that should look like buttons
7. Tree-shaking ensures unused components aren't bundled

---

## 2. Web Research Summary: Wasmtime Python Bindings

### What is Wasmtime?
Wasmtime is a production-grade WebAssembly runtime by the **Bytecode Alliance** with a **JIT compiler** (Cranelift/Winch). It runs WASM modules natively — no browser, no Node.js required.

### Key Characteristics
| Aspect | Detail |
|---|---|
| **JIT compilation** | Compiles WASM to native machine code via Cranelift |
| **WASI support** | Full WASI Preview 1 & 2 (filesystem, env, stdio) |
| **Python API** | `pip install wasmtime` — `Store`, `Module`, `Instance`, `Func`, `Memory`, `Linker` |
| **Performance** | ~70-90% of native for compute, negligible difference for I/O-bound work |
| **Cross-platform** | Same `.wasm` runs on Linux, macOS, Windows, ARM |
| **Sandboxing** | WASM memory isolation — crashes can't kill the host process |

### Compiling Rust for Wasmtime (vs wasm-bindgen)
```toml
# Cargo.toml — NO wasm-bindgen dependency for exports
[lib]
crate-type = ["cdylib"]
```
```rust
// Pure C ABI — works for both wasmtime AND wasm-bindgen JS init
#[no_mangle]
pub extern "C" fn my_function(data: *const u8, len: u32) -> i32 { ... }
```
```bash
cargo build --target wasm32-unknown-unknown --release
# Produces target/wasm32-unknown-unknown/release/chithi_wasm.wasm
```

### Wasmtime Python API (key classes)
- `Store`, `Engine`, `Config` — execution context
- `Module.from_file()`, `Instance` — load and instantiate
- `Func`, `FuncType`, `ValType` — host functions
- `Memory.read()`, `Memory.write()`, `Memory.data_ptr()` — linear memory access
- `Linker`, `WasiConfig` — WASI support
- `Trap`, `WasmtimeError` — error handling

---

## 2. Deep Functional Comparison: Chithi Frontend vs Reference Frontend

### 2.1 Dependency Differences

| Package | Reference (`D:\Programming\frontend`) | Chithi (`D:\Programming\chithi\src\frontend`) | Impact |
|---|---|---|---|
| **shadcn-svelte** | `^1.2.7` | `^1.3.0` | Chithi is newer — good |
| **@jsquash/avif** | MISSING | `^2.1.1` | Chithi has AVIF image compression |
| **@discourse/webp** | `^1.0.0` | `^1.5.0` | Chithi has newer version |
| **vite-plugin-wasm** | MISSING | `^3.6.0` | Chithi uses Rust WASM |
| **vite-plugin-top-level-await** | MISSING | `^1.6.0` | Chithi uses top-level await |
| **temporal-polyfill** | MISSING | `^0.3.2` | Chithi polyfills Temporal |
| **@testing-library/svelte** | MISSING | `^5.3.1` | Chithi has testing setup |
| **hash-wasm** | `^4.12.0` | `^4.12.0` | Same — JS Argon2 |

### 2.2 Architecture Differences

| Aspect | Reference | Chithi | Impact |
|---|---|---|---|
| **Crypto** | Pure JS Web Crypto API + hash-wasm | **Rust WASM bindings (chithi_wasm)** | WASM is faster — KEEP |
| **Compression** | `@zip.js/zip.js` (JavaScript) | **Rust WASM 7z** + `@zip.js/zip.js` | 7z is more efficient — KEEP |
| **Encryption Workers** | `encrypt.worker.ts` + `decrypt.worker.ts` | `crypto/crypto.worker.ts` (combined) | Will unify into single `chithi.worker.ts` |
| **7z Worker** | NONE | `rust.worker.ts` | Will merge into `chithi.worker.ts` |
| **Fetch Decrypt** | Inline in streams.ts | Separate `fetch-decrypt.ts` | Chithi separates — better modularity |
| **IndexedDB** | Single `index.ts` | Split: `index.ts` + `recent-uploads.svelte.ts` + `types.ts` | Chithi splits for modularity — good |
| **Error types** | NONE | `errors/password.ts` | Chithi has typed error handling — good |
| **File tree** | NONE | `functions/file-tree.ts` | Chithi has drag-and-drop file tree — good |
| **Sanitize** | `functions/sanitize.ts` | MISSING | **Must add from reference** |
| **Security** | `functions/security.ts` | MISSING | **Must add from reference** |
| **Libravatar** | `functions/libravatar.ts` | MISSING | **Must add from reference** |
| **String conversion** | `functions/string-conversion.ts` | MISSING | **Must add from reference** |
| **Download** | `functions/download.ts` | MISSING | **Must add from reference** |
| **WASM module** | NONE | `wasm/` directory | **KEEP — core advantage** |

### 2.3 Query Hook Differences

| Query | Reference | Chithi | Difference |
|---|---|---|---|
| `auth.ts` | `useAuth()` | `useAuth()` | Same pattern |
| `config.ts` | `useConfigQuery()` | `useConfigQuery()` | Same pattern |
| `files.ts` | `useFilesQuery()` | `useFilesQuery()` | Same pattern |
| `instance.ts` | `useInstanceInformationQuery()` | `useInstanceInformationQuery()` | Same pattern |
| `onboarding.ts` | `useOnboarding()` | `useOnboarding()` | Same pattern |
| `fetch-utils.ts` | NONE | `fetchJson()`, `prefetch()` | **Chithi has shared fetch utilities — good** |
| `file-info.ts` | NONE | `useFileInfoQuery()` | **Chithi-specific — keep** |
| `reverse.ts` | NONE | `useRoomQuery()`, `useReverseShareQuery()` | **Chithi-specific — keep** |
| `admin_users.ts` | `useAdminUsersQuery()` | MISSING | **Must add from reference** |

### 2.4 Route Differences

| Route | Reference | Chithi | Difference |
|---|---|---|---|
| `/` (home) | Card-based layout | Card-based layout | Same structure |
| `/upload/` | 3-stage flow | 3-stage flow | Same structure |
| `/download/[slug]/` | Exists | Exists | Same |
| `/view/[slug]/` | Exists | Exists | Same |
| `/reverse/` | WebSocket rooms | WebSocket rooms | Same |
| `/speedtest/` | Gauge + graph | Gauge + graph | Same |
| `/login/` | Formsnap form | Formsnap form | Same |
| `/logout/` | Server command | Server command | Same |
| `/admin/*` | Sidebar layout | Sidebar layout | Same |
| `/onboarding/` | Multi-stage | Multi-stage | Same |
| `/informations/` | Info pages | Info pages | Same |
| `/once/[slug]/` | One-time download | One-time download | Same |
| `/og/*` | OG images | OG images | Same |

### 2.5 Encryption/Stream Architecture — DEEP DIVE

#### Chithi Approach (Rust WASM) — THIS IS THE PRIMARY PATH
```
wasm/chithi_wasm.ts:
  - ensureInitialized() -> init WASM module
  - compress7z / decompress7z / validate7z
  - argon2DeriveWasm, generateIkmWasm
  - wasmEncryptChunk, wasmDecryptChunk
  - wasmEncryptChunksParallel, wasmDecryptChunksParallel
  - wasmEncryptAll, wasmDecryptAll
  - wasmGetChunkNonce, wasmDeriveKey
  - upload, download, uploadData, downloadData (SDK-level)
  - WasmKeychain (key management)

workers/crypto/crypto.worker.ts:
  - Combined encrypt + decrypt worker
  - Uses WASM for crypto operations
  - WILL BE REPLACED by unified chithi.worker.ts

workers/rust.worker.ts:
  - 7z compression/decompression/validation
  - WILL BE MERGED into unified chithi.worker.ts

functions/encryption.ts:
  - base64, argon2, chunk IV helpers
  - WASM-specific crypto wrappers

functions/fetch-decrypt.ts:
  - Download + decrypt in one call

functions/streams.ts:
  - Stream pipeline integrated with WASM
```

#### Reference Approach (Pure JS) — STRUCTURAL REFERENCE ONLY
The reference uses pure JS Web Crypto API + hash-wasm for encryption. This is the fallback path only.
For structural patterns (worker pool round-robin, TransformStream pipeline, context objects, fallback handling), the reference is the model.

### 2.6 EncryptUpload Component Comparison

#### Reference (`EncryptUpload.svelte` does NOT exist as a separate component)
The reference frontend splits upload logic across:
- `upload/stage_1.svelte` — file selection, drag-and-drop
- `upload/stage_2.svelte` — password/config, file list, upload execution
- `upload/stage_3.svelte` — progress/share result
- `upload/state.svelte.ts` — shared upload state store (WebSocket app state)
- `upload/upload_showcase.svelte` — real-time storage showcase
- `upload/recent_upload.svelte.ts` — recent upload IndexedDB
- `upload/enums.ts` — upload configuration enums

#### Chithi (`EncryptUpload.svelte` exists as a single monolithic component)
The chithi frontend has a single `EncryptUpload.svelte` component that bundles:
- File selection with drag-and-drop
- Encryption configuration
- Upload progress
- All state management inline
- WASM initialization

**Key issue**: The reference splits upload into 3 stages, each as its own component. Chithi bundles everything into one monolithic component. The reference approach is cleaner and more maintainable.

### 2.7 CSS/Theming Comparison

Both use:
- Tailwind CSS v4 with OKLCH color space
- Geist + JetBrains Mono fonts
- Dark mode via `.dark` class
- NProgress for navigation indicators
- Custom radius tokens

**Difference**: The chithi frontend has additional custom animations (`dash` keyframe) and a slightly more extensive sidebar token set.

### 2.8 shadcn-svelte Component Usage

Both projects use the same set of shadcn-svelte UI components. The chithi frontend has `shadcn-svelte ^1.3.0` vs reference `^1.2.7` — a minor version bump with bug fixes.

**Key shadcn-svelte usage patterns observed in both**:
- `import * as Card from "$lib/components/ui/card/index.js"` — compositional pattern
- `import { Button } from "$lib/components/ui/button/index.js"` — single component
- `buttonVariants({ variant: "outline" })` — for non-button elements
- `cn()` utility for class merging
- `@lucide/svelte` for icons

### 2.9 What the Reference Does Better

1. **Separation of concerns**: Upload flow split into 3 stages, each a separate component
2. **Utility organization**: `functions/` directory has sanitize, security, libravatar, string-conversion, download utilities that chithi lacks
3. **Admin users query**: Has `admin_users.ts` query hook that chithi is missing
4. **Cleaner state management**: Upload state in dedicated `state.svelte.ts` store
5. **Clean stream pipeline**: Context-based worker pool with round-robin dispatch and fallback

### 2.10 What Chithi Does Better

1. **Rust WASM performance**: Crypto operations in WASM are faster than JS — KEEP
2. **7z support**: Rust-based 7z compression is more efficient than ZIP — KEEP
3. **Shared fetch utilities**: `fetch-utils.ts` provides reusable query helpers — KEEP
4. **Typed error handling**: `errors/password.ts` for specific error types — KEEP
5. **Modular IndexedDB**: Split into `index.ts`, `recent-uploads.svelte.ts`, `types.ts` — KEEP
6. **File tree handling**: `functions/file-tree.ts` for drag-and-drop — KEEP
7. **More query hooks**: `file-info.ts`, `reverse.ts` for advanced features — KEEP
8. **Newer shadcn-svelte**: `^1.3.0` vs `^1.2.7` — KEEP

---

## 3. Plan to Work Forward

### DESIGN DECISION: SINGLE WASM MODULE FOR ALL HOSTS

The Rust WASM module is the single source of truth for all crypto operations. Both the JS frontend and Python SDK consume the **same `.wasm` file** — compiled with `wasm32-unknown-unknown`, no host-specific binding code.
- JS frontend loads via `vite-plugin-wasm` + `chithi.worker.ts` (SharedArrayBuffer, Web Workers)
- Python SDK loads via `wasmtime` JIT runtime (pip install wasmtime)

### Completed Work

| Task | Status | Detail |
|---|---|---|
| Unified `chithi.worker.ts` | DONE | Created at `workers/chithi.worker.ts`, handles all WASM message types |
| Removed old `crypto/crypto.worker.ts` | DONE | Deleted, no longer referenced |
| Removed old `rust.worker.ts` | DONE | Deleted, no longer referenced |
| Updated `streams.ts` → `ChithiWorker` | DONE | Both encrypt and decrypt pools use unified worker |
| 3-stage upload split | DONE | `stage_1.svelte`, `stage_2.svelte`, `stage_3.svelte` already exist |
| Removed dead `EncryptUpload.svelte` | DONE | Deleted, 3-stage split is the active path |

### Phase 1: Agnostic WASM Rewrite (NEW — highest priority)

**Goal**: Rewrite the WASM binding layer to use pure C ABI so the same `.wasm` works for JS frontend AND Python wasmtime.

#### Step 1.1: Audit current `wasm_bindings` crate
- Read all Rust source files in the wasm_bindings crate
- Identify all `#[wasm_bindgen]` annotations that tie exports to JS
- Map the complete export surface: encrypt, decrypt, 7z, argon2, keychain, etc.
- Identify all `JsValue`, `String` (Rust), `Vec<u8>` return types that need C-ABI conversion

#### Step 1.2: Rewrite exports to pure C ABI
- Replace `#[wasm_bindgen]` with `#[no_mangle] pub extern "C"`
- All buffer I/O uses `(*const u8, len: u32)` + output buffer pattern
- Add `alloc(len: u32) -> u32` and `dealloc(ptr: u32, len: u32)` for memory management
- Keep `wasm-bindgen` as a dev dependency for the JS `init()` shim only
- String I/O: pass `(ptr, len)` for UTF-8, callee writes to output buffer
- Return values: `i32` for success/error codes, output buffers for data

#### Step 1.3: Update JS wrapper (`chithi_wasm.ts`)
- Adapt JS bindings to new C-ABI interface
- Memory management: write inputs to WASM linear memory, call functions, read outputs
- Wrap raw calls in ergonomic JS API (`wasmEncryptChunk(chunk, key, nonce)`)
- Keep the same public API surface for consumers (`streams.ts`, `chithi.worker.ts`)

#### Step 1.4: Drop `python_bindings` crate + PyO3
- Remove `rust/crates/python_bindings/` entirely
- Remove `maturin` from `sdk/python/pyproject.toml`
- No more platform-specific wheel building

#### Step 1.5: Rewrite Python SDK with wasmtime
- Replace `import chithi_core` (PyO3 native module) with `wasmtime` host calls
- Build a Python wrapper that:
  - Loads the same `.wasm` file shipped in the package
  - Manages WASM linear memory (write inputs, call functions, read outputs)
  - Provides ergonomic Python API (`Chithi.upload()`, `Chithi.download()`)
- Update `pyproject.toml`: `wasmtime` as runtime dependency, no maturin
- Ship `.wasm` as package data in the wheel

### Phase 2: Frontend Alignment

**Goal**: Align the chithi frontend structure with the reference's cleaner organization.

#### Step 2.1: Add missing utility functions from reference
- `functions/sanitize.ts` — HTML/text sanitization
- `functions/security.ts` — security headers, CSP helpers
- `functions/libravatar.ts` — libravatar/gravatar integration
- `functions/string-conversion.ts` — string formatting utilities
- `functions/download.ts` — file download helpers

#### Step 2.2: Add missing query hooks from reference
- `queries/admin_users.ts` — admin user management queries

#### Step 2.3: shadcn-svelte alignment
- Audit all component imports (namespace vs named)
- Align form patterns with EXACT shadcn-svelte docs (Formsnap + Zod)
- Verify theming matches shadcn-svelte CSS variable convention
- Add any missing shadcn-svelte components via CLI

#### Step 2.4: Svelte 5 runes audit
- Ensure `$state`, `$derived`, `$effect` used correctly
- Verify `$props()` with `$bindable` for two-way binding
- Check `{#snippet}` usage for compositional patterns

#### Step 2.5: Accessibility audit
- Verify ARIA attributes on all interactive elements
- Check keyboard navigation
- Verify focus management in dialogs/drawers

---

## 4. shadcn-svelte Exact Code Patterns to Follow

### 4.1 Form Pattern (from docs)
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

### 4.2 Dialog Pattern (from docs)
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

### 4.3 Card Pattern (from docs)
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

### 4.4 Dropdown Menu Pattern (from docs)
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

### 4.5 Button Pattern (from docs)
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

---

## 5. Wasmtime Python Integration Patterns

### 5.1 WASM Memory Management (C ABI)
```rust
// WASM exports — pure C ABI, no wasm-bindgen types
#[no_mangle] pub extern "C" fn encrypt_chunk(
    data_ptr: *const u8, data_len: u32,
    key_ptr:  *const u8, key_len: u32,
    nonce_ptr: *const u8, nonce_len: u32,
    out_ptr: *mut u8, out_len: u32
) -> u32 { /* returns bytes written */ }

#[no_mangle] pub extern "C" fn alloc(len: u32) -> u32 { /* returns pointer */ }
#[no_mangle] pub extern "C" fn dealloc(ptr: u32, len: u32) { /* free buffer */ }
```

### 5.2 Wasmtime Python Wrapper Pattern
```python
from wasmtime import Store, Module, Instance

store = Store()
module = Module.from_file(store.engine, "chithi_wasm.wasm")
instance = Instance(store, module, [])
memory = instance.exports(store)["memory"]

# Write input data to WASM memory
memory.write(store, input_bytes, offset)

# Call exported function
result = instance.exports(store)["encrypt_chunk"](store, data_ptr, data_len, ...)

# Read output from WASM memory
output = memory.read(store, out_ptr, out_ptr + bytes_written)
```

### 5.3 Build Pipeline
```bash
# Single build command produces .wasm for ALL hosts
cargo build --target wasm32-unknown-unknown --release
# Output: target/wasm32-unknown-unknown/release/chithi_wasm.wasm
# → JS frontend: copied to src/lib/wasm/ by vite-plugin-wasm
# → Python SDK: shipped as package data in wheel
```

---

## 6. Summary of Key Changes

| Area | Before | After | Status |
|---|---|---|---|
| Worker architecture | Split crypto.worker + rust.worker | **Single chithi.worker.ts** | DONE |
| Stream pipeline | `CryptoWorker` imports | **`ChithiWorker` unified** | DONE |
| Upload flow | Monolithic EncryptUpload | **3-stage split** | DONE |
| WASM binding layer | wasm-bindgen (JS-specific) | **Agnostic C ABI** | TODO Phase 1 |
| Python bindings | PyO3 + maturin (native .so) | **wasmtime (same .wasm)** | TODO Phase 1 |
| Build pipeline | Two Rust workspaces | **Single wasm target** | TODO Phase 1 |
| Utility functions | Missing sanitize, security, etc. | **Add from reference** | TODO Phase 2 |
| Query hooks | Missing admin_users | **Add from reference** | TODO Phase 2 |
| Form patterns | Mixed Formsnap | **EXACT shadcn-svelte docs** | TODO Phase 2 |
| Theming | OKLCH + Tailwind v4 | **Verify vs shadcn-svelte** | TODO Phase 2 |
| Accessibility | Bits UI foundation | **Full ARIA audit** | TODO Phase 2 |
