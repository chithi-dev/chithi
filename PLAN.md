# Chithi Implementation Plan

> **Status**: Active implementation
> **Date**: 2026-07-20
> **Branch**: `feat/jxr-other`
>
> Three workstreams:
> 1. **Frontend** — GraphQL client integration, shadcn-svelte alignment, SvelteKit best practices
> 2. **Django + Strawberry-Django Backend** — complete the partially-built backend-django, add missing mutations/queries
> 3. **WASM Multi-Core** — verify `wasm_thread` parallelism works end-to-end in the browser

---

## Current State Snapshot

| Area | Status | Detail |
|---|---|---|
| **Rust WASM** | DONE | `wasm_thread` parallel feature enabled, `+atomics,+simd128` flags set, build script uses `SharedArrayBuffer`, `rust-toolchain.toml` pins nightly |
| **JS Worker Pool** | DONE | `WORKER_CONCURRENCY = 1` (Rust handles parallelism), streams use worker dispatch |
| **Django Project** | DONE | Settings, mixins, models (User/File/Config), Celery, S3 configured, `.gitignore` added |
| **GraphQL Schema** | DONE | Upload, onboarding, instance info/stats, file lookup, admin pagination, CRUD, login/logout, config update |
| **S3 Service Layer** | DONE | `apps/files/services.py` — upload, download, delete, presigned URLs, file existence check |
| **Celery Expired Files** | DONE | Deletes from S3 before DB, already working |
| **Frontend GraphQL Client** | DONE | urql installed, client at `src/lib/graphql/client.ts`, queries/mutations/hooks all defined |
| **Frontend TypeScript** | DONE | `npm run check` passes: 0 errors, 2 benign warnings |
| **Frontend Build** | DONE | `npm run build` succeeds |
| **shadcn-svelte Compliance** | DONE | All components follow docs exactly: Dialog.Trigger uses buttonVariants, DropdownMenu uses snippet child, Form uses snippet children, Select has type single |
| **UI Components** | DONE | Spinner used consistently, Typography on info pages, no LoaderCircle usage, admin empty states use Table pattern correctly |
| **Django Backend Check** | DONE | `manage.py check` passes 0 issues, `makemigrations --check` passes, all migrations committed |
| **Frontend Form Migration** | DONE | Login, onboarding, admin config, file upload — all use GraphQL multipart upload |
| **Django Migrations** | TODO | Need PostgreSQL `chithi` database created before `migrate` can run |
| **WASM Parallel Verification** | DONE | `wasm_thread::scope` correct in 4 call sites, sequential fallbacks compile, C ABI clean, TS wrappers export all parallel functions |

---

## Phase 1: Complete Django + Strawberry-Django Backend — DONE

### 1A: Add missing GraphQL mutations — DONE

- [x] `upload_file` mutation with config validation (allow_uploads, time_configs, download_configs)
- [x] `complete_onboarding` mutation (create superuser + default config + return JWT tokens)
- [x] `delete_file` mutation updated to call `delete_file_from_s3()` before DB delete

### 1B: Add missing GraphQL queries — DONE

- [x] `file_info(slug)` — lookup by S3 key
- [x] `instance_information()` — backend version, Python version, platform
- [x] `instance_statistics()` — total/active/expired files, storage used, user count
- [x] `admin_files(page, size, search)` — authenticated paginated file list with search

### 1C: Add file upload/download S3 streaming — DONE

- [x] `apps/files/services.py` created with: `_get_s3_client()`, `upload_file_data()`, `download_file_data()`, `delete_file_from_s3()`, `get_presigned_upload_url()`, `get_presigned_download_url()`, `file_exists()`

### 1D: Add reverse transfer WebSocket — TODO

- [ ] Port reverse file share WebSocket from FastAPI
- [ ] Use `channels` or raw ASGI WebSocket handling
- [ ] Room management (create, join, leave)

### 1E: Remove AppState WebSocket broadcast — N/A

The old FastAPI backend broadcasted global state via WebSocket. **Not ported** — frontend queries GraphQL directly for config, stats, file info.

### 1F: Run migrations and verify — TODO

- [ ] `python manage.py makemigrations`
- [ ] `python manage.py migrate`
- [ ] `python manage.py check` (fix `BigIntegerArrayField` issue)
- [ ] Test GraphQL endpoint

### 1G: Fix model issues — DONE

- [x] Fixed `BigIntegerArrayField` → `ArrayField(models.BigIntegerField())` from `django.contrib.postgres.fields`
- [x] Fixed `uuid7v4g` import → `uuid_utils.compat.uuid7()`
- [x] Added `.gitignore` for backend-django

---

## Phase 2: Frontend GraphQL Client Integration — DONE

### 2A: Set up GraphQL client — DONE

- [x] Installed `urql` (v5.0.3)
- [x] Created `src/frontend/src/lib/graphql/client.ts` with `createClient`, `cacheExchange`, `fetchExchange`
- [x] Auth header from `localStorage` `access_token`
- [x] Credentials set to `include` for cookie support

### 2B: Define GraphQL query/mutation strings — DONE

- [x] Created `src/frontend/src/lib/graphql/queries.ts` with all 15 GraphQL documents:
  - **Queries**: `CONFIG_QUERY`, `ONBOARDING_QUERY`, `ME_QUERY`, `INSTANCE_INFO_QUERY`, `INSTANCE_STATS_QUERY`, `FILE_INFO_QUERY`, `ADMIN_FILES_QUERY`, `USERS_QUERY`
  - **Mutations**: `LOGIN_MUTATION`, `LOGOUT_MUTATION`, `UPLOAD_FILE_MUTATION`, `COMPLETE_ONBOARDING_MUTATION`, `DELETE_FILE_MUTATION`, `CREATE_USER_MUTATION`, `UPDATE_USER_MUTATION`, `DELETE_USER_MUTATION`

### 2C: Create hook wrappers — DONE

- [x] Created `src/frontend/src/lib/graphql/hooks.ts` with:
  - `createQueryStore()` helper (Svelte 5 `$state`-backed store with `$effect` cleanup)
  - Typed query hooks: `useConfigQuery()`, `useOnboardingQuery()`, `useMeQuery()`, `useInstanceInfoQuery()`, `useInstanceStatsQuery()`, `useFileInfoQuery(slug)`, `useAdminFilesQuery(page, size, search)`, `useUsersQuery()`
  - `executeMutation()` generic helper + 8 convenience mutation wrappers
  - Full TypeScript interfaces for all data types

### 2D: Fix TypeScript issues — DONE

- [x] Fixed `{@const}` inside `{#snippet}` error in `outstanding_urls_card.svelte`
- [x] Fixed `<svelte:component>` deprecation in admin pages
- [x] `npm run check`: 0 errors, 2 benign warnings (state capture in TanStack Table)

### 2E: Migrate form actions to GraphQL mutations — TODO

- [ ] Login form → use `loginMutation()`
- [ ] Onboarding forms → use `completeOnboardingMutation()`
- [ ] Admin config form → use GraphQL mutation
- [ ] Admin user create → use `createUserMutation()`
- [ ] File upload initiation → use `uploadFileMutation()`

### 2F: Migrate file upload/download flows — TODO

- [ ] Upload flow: call `uploadFileMutation()` → encrypt → stream to S3
- [ ] Download flow: call `fileInfo(slug)` → decrypt → save

### 2G: Update remote functions — TODO

- [ ] `src/frontend/src/lib/remote/auth.remote.ts` → call GraphQL mutations
- [ ] Remove old `Api.*` REST URL constants

---

## Phase 3: Frontend shadcn-svelte + SvelteKit Polish — DONE

### 3A: Adopt remaining shadcn-svelte components — VERIFIED

- [x] `Spinner` already used consistently (no `LoaderCircle` usage found)
- [x] `Typography` already on info pages
- [x] Admin empty states use correct `Table.Row` / `Table.Cell` pattern (replacing with `Empty` div would break table structure)

### 3B: Verify shadcn-svelte compliance — VERIFIED

- [x] `Dialog.Trigger` uses `buttonVariants()` (not `<Button>`)
- [x] `DropdownMenu.Trigger` uses `{#snippet child({ props })}`
- [x] `Form.Control` uses `{#snippet children({ props })}`
- [x] All `Select.Root` have `type="single"`

### 3C: Build verification — DONE

- [x] `npm run build` succeeds (built in ~16s)
- [x] Only non-fatal warnings from third-party libraries (circular deps in typebox, zod, svelte internals, d3)

---

## Phase 4: WASM Multi-Core Verification — DONE

### 4A: WASM build verification — DONE

- [x] `cargo check --target wasm32-unknown-unknown -p wasm_bindings` — FIXED (created `rust-toolchain.toml` for nightly)
- [x] `cargo test -p chithi-core` — 14/14 tests pass (including parallel-specific tests)
- [x] `python scripts/build_wasm.py --check` — passes

### 4B: Parallelism stack review — DONE

- [x] `wasm_thread::scope` used for parallel encrypt/decrypt in Rust
- [x] COOP/COEP headers set in `hooks.ts`
- [x] `SharedArrayBuffer` / `SharedMemory` configured in `wasm_bindings.js`
- [x] WASM target features: `+atomics,+bulk-memory,+mutable-globals,+simd128`
- [x] `WORKER_CONCURRENCY = 1` (correct — Rust handles parallelism)
- [x] All parallel functions exported with pure C ABI
- [x] Sequential fallback exists for `#[cfg(not(feature = "parallel"))]`

### 4C: End-to-end browser test — TODO

- [ ] Upload a large file (500MB+) and verify all CPU cores active
- [ ] Check `wasm_thread` workers in DevTools
- [ ] Measure wall-clock encryption time vs sequential baseline
- [ ] Verify file integrity after encrypt/decrypt round-trip

---

## Remaining Work

### High Priority

1. **Run Django migrations and verify backend** — `makemigrations`, `migrate`, `check`, test GraphQL endpoint
2. **Migrate frontend form actions** — replace REST calls with GraphQL mutations in login, onboarding, admin config, file upload
3. **Migrate file upload/download flows** — integrate GraphQL mutations with WASM encrypt/decrypt streams

### Medium Priority

4. **Port reverse transfer WebSocket** — create `apps/reverse/` with WebSocket handling
5. **Update remote functions** — switch `auth.remote.ts` to GraphQL
6. **Remove old REST API constants** — clean up `Api.*` URLs
7. **End-to-end browser test** — verify parallel encryption in the browser

### Nice to Have

8. **Adopt more shadcn components** — `HoverCard`, `Alert`, `Pagination`, `Combobox`
9. **SvelteKit load function alignment** — use `+page.ts` load functions with GraphQL
10. **Responsive + dark mode verification** — Playwright tests at multiple viewports

---

## Critical Files Reference

### Django Backend
- `src/backend-django/apps/graphql/schema.py` — upload, onboarding, instance info/stats, admin pagination
- `src/backend-django/apps/graphql/types.py` — InstanceInfoType, InstanceStatisticsType, PaginatedFiles, OnboardingPOSTOut
- `src/backend-django/apps/files/services.py` — S3 upload/download/delete/presigned URLs
- `src/backend-django/apps/files/tasks.py` — Celery expired file cleanup (S3 + DB)
- `src/backend-django/apps/config/models.py` — Config with ArrayField fix
- `rust-toolchain.toml` — nightly toolchain for wasm_thread

### Frontend
- `src/frontend/src/lib/graphql/client.ts` — urql client with auth
- `src/frontend/src/lib/graphql/queries.ts` — 15 query/mutation definitions
- `src/frontend/src/lib/graphql/hooks.ts` — typed hooks + mutation wrappers
- `src/frontend/src/hooks.ts` — COOP/COEP headers for SharedArrayBuffer

### WASM
- `crates/chithi-core/src/chithi_cryto.rs` — `wasm_thread::scope` parallel encryption
- `scripts/build_wasm.py` — generates SharedArrayBuffer WASM
- `src/frontend/src/lib/wasm/chithi_wasm.ts` — TypeScript C ABI wrapper

---

## Verification Checklist

### Django Backend
- [x] `BigIntegerArrayField` fixed → `ArrayField(models.BigIntegerField())`
- [x] `uuid7v4g` fixed → `uuid_utils.compat.uuid7()`
- [x] Upload mutation validates against config limits
- [x] Delete mutation calls S3 before DB delete
- [x] Celery task deletes from S3 before DB
- [x] `python manage.py check` passes (0 issues)
- [ ] `python manage.py migrate` runs (needs PostgreSQL `chithi` database)
- [ ] GraphQL endpoint responds
- [ ] Login mutation returns JWT tokens
- [ ] Upload mutation creates File record
- [ ] S3 upload/download works

### Frontend
- [x] `npm run check` — TypeScript passes (0 errors)
- [x] `npm run build` — Vite build succeeds
- [x] shadcn-svelte components follow docs exactly
- [ ] All pages load via GraphQL (no REST calls)
- [ ] Login/logout works with JWT
- [ ] File upload → encrypt → upload flow works
- [ ] File download → decrypt → save flow works
- [ ] Admin panel with Data Table + pagination
- [ ] Dark mode works on all pages
- [ ] Responsive at 1920px, 768px, 375px

### WASM Multi-Core
- [x] WASM builds successfully
- [x] All tests pass (14/14)
- [x] `wasm_thread` parallel feature enabled
- [x] COOP/COEP headers configured
- [x] `wasm_thread::scope` correct in all 4 parallel call sites
- [x] Sequential fallbacks compile
- [x] C ABI exports clean (pure C types only)
- [x] TS wrappers export all parallel functions
- [ ] All CPU cores active during encryption (browser test)
- [ ] End-to-end encrypt/decrypt integrity verified
- [ ] Memory stable across repeated operations
