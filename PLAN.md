# Chithi Implementation Plan

> **Status**: Active implementation — aligning frontend with Django GraphQL backend
> **Date**: 2026-07-26
> **Branch**: `feat/jxr-other`
>
> Three workstreams completed previously:
> 1. **Frontend** — Apollo Client v4, GraphQL codegen, shadcn-svelte compliance
> 2. **Django + Strawberry-Django Backend** — full port from FastAPI, GraphQL schema, S3, Celery
> 3. **WASM Multi-Core** — `wasm_thread` parallelism verified, all cores utilized via Rust Rayon
>
> **Current focus**: Wire frontend ↔ Django backend together, fix schema mismatches, migrate remaining REST calls to GraphQL.

---

## Current State Snapshot

| Area | Status | Detail |
|---|---|---|
| **Rust WASM** | DONE | `wasm_thread` parallel feature, `+atomics,+simd128`, SharedArrayBuffer |
| **JS Worker Pool** | DONE | `WORKER_CONCURRENCY = 1` (Rust handles parallelism) |
| **Django Project** | DONE | Settings, mixins, models, Celery, S3 configured |
| **GraphQL Schema** | DONE | Query/Mutation for all domain objects |
| **S3 Service Layer** | DONE | `apps/files/services.py` — upload, download, delete, presigned URLs |
| **Celery Expired Files** | DONE | Periodic task via django_celery_beat |
| **Frontend GraphQL Client** | DONE | Apollo Client v4, codegen, generated types |
| **Frontend TypeScript** | DONE | `npm run check` passes |
| **Frontend Build** | DONE | `npm run build` succeeds |
| **Django Migrations** | DONE | 39 migrations, SQLite + PostgreSQL compatible |
| **shadcn-svelte Compliance** | DONE | 46 components, docs-exact patterns |
| **WASM Parallel Verification** | DONE | 4 parallel call sites, 14/14 tests pass |

---

## Phase 1: Fix Backend Bugs and Schema Gaps

### 1.1 Fix missing import in mutations — `get_presigned_download_url`

**File**: `src/backend-django/apps/graphql/mutations/__init__.py`

The `download_file_stream` mutation calls `get_presigned_download_url(file_key)` but the function is not imported. Add it:

```python
from apps.files.services import (
    delete_file_from_s3,
    upload_file_data,
    get_presigned_download_url,  # ADD THIS
)
```

Also wrap in `sync_to_async` since it's an async function inside an async resolver:
```python
@strawberry.mutation
async def download_file_stream(self, file_key: str) -> str:
    return await sync_to_async(get_presigned_download_url)(file_key)
```

**Status**: TODO

### 1.2 Add `logout` mutation

**File**: `src/backend-django/apps/graphql/mutations/__init__.py`

The frontend sends `LOGOUT_MUTATION` (`mutation Logout { logout }`) but Django has no `logout` mutation. Add a no-op logout that returns `Boolean`:

```python
@strawberry.type
class AuthMutation:
    # ... existing login, complete_onboarding ...

    @strawberry.mutation
    def logout(self) -> bool:
        # Client-side token cleanup. Server-side JWT is stateless.
        return True
```

**Status**: TODO

### 1.3 Fix upload mutation field name mismatch

**File**: `src/backend-django/apps/graphql/mutations/__init__.py`

The frontend `UPLOAD_FILE_MUTATION` sends variables `expire_after` and `expire_after_n_download`, but the mutation resolver expects `expires_at` and `expire_after_n_download`. The frontend mutation definition maps `expire_after` → `expiresAt` in GraphQL. Django's Strawberry auto-converts `expires_at` (snake) → `expiresAt` (camel). So the GraphQL field names actually match. **However**, the frontend hook `uploadFileMutation` passes `expire_after` as the variable name, and the mutation maps it to `expiresAt`. Django expects `expires_at` which is `expiresAt` in camelCase. **This should work** — verify.

**Status**: VERIFY

### 1.4 Verify Strawberry camelCase conversion

Strawberry-Django auto-converts Python snake_case field names to camelCase in the GraphQL schema. Verify that:
- `total_storage_limit` → `totalStorageLimit` ✓
- `default_expiry` → `defaultExpiry` ✓
- `number_of_files` → `numberOfFiles` ✓
- `download_count` → `downloadCount` ✓
- `created_at` → `createdAt` ✓
- `expires_at` → `expiresAt` ✓
- `is_expired` → `isExpired` ✓

**Status**: VERIFY

---

## Phase 2: Update Frontend Backend URL Configuration

### 2.1 Update default backend URL to `localhost:8002`

**File**: `src/frontend/src/lib/consts/backend.ts`

Change the fallback from `http://localhost:8000` to `http://localhost:8002` (Django's default port).

```ts
const environment_variable = env.PUBLIC_BACKEND_API ?? 'http://localhost:8002';
```

**Status**: TODO

### 2.2 Update GraphQL codegen schema URL

**File**: `src/frontend/codegen.ts`

Change from `http://localhost:8000/graphql/` to `http://localhost:8002/graphql/`.

**Status**: TODO

---

## Phase 3: Fix Frontend Interface Mismatches

### 3.1 Fix snake_case → camelCase in interfaces

**Files**: `src/frontend/src/lib/graphql/hooks.ts`

Apollo Client returns camelCase data (matching the GraphQL query field names). The interfaces currently use snake_case keys (e.g., `file_info`, `total_storage_limit`). Fix to match actual GraphQL response shape:

- `ConfigData.config.total_storage_limit` → `config.totalStorageLimit`
- `OnboardingData.onboarding.is_configured` → `onboarding.isConfigured`
- `FileInfoData.file_info` → `fileInfo` (matches query alias `fileInfo`)
- `AdminFilesData.admin_files` → `adminFiles`
- `LoginResult.login` → `login` (no change needed, single word)
- `UploadFileResult.upload_file` → `uploadFile`
- etc.

**Status**: TODO

### 3.2 Fix query modules that access snake_case keys

**Files**:
- `src/frontend/src/lib/queries/config.ts` — accesses `raw.data.config.*`
- `src/frontend/src/lib/queries/onboarding.ts` — accesses `raw.data.onboarding.is_configured`
- `src/frontend/src/lib/queries/file-info.ts` — accesses `result.data.file_info`
- `src/frontend/src/lib/queries/files.ts` — accesses `result.data.admin_files`
- `src/frontend/src/lib/queries/instance.ts` — accesses `result.data.instance_information`
- `src/frontend/src/lib/queries/admin_users.ts` — accesses `result.data.users`

All these need to use camelCase keys matching the GraphQL response.

**Status**: TODO

---

## Phase 4: Migrate Remaining REST Calls to GraphQL

### 4.1 View/Download page load functions

**Files**:
- `src/frontend/src/routes/.../view/[slug]/+page.ts`
- `src/frontend/src/routes/.../download/[slug]/+page.ts`

Currently call `Api.FILE_INFO(params.slug)` via REST `fetch()`. Migrate to use the GraphQL client to fetch file info. Since these are SvelteKit `PageLoad` functions, use `fetch` to call the GraphQL endpoint directly:

```ts
const res = await fetch('/graphql/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    query: '{ fileInfo(key: "' + params.slug + '") { filename size numberOfFiles } }',
  }),
});
const { fileInfo } = await res.json().data;
```

Or better: create a server-side GraphQL helper that reuses the query definitions.

**Status**: TODO

### 4.2 Reverse room REST calls

**File**: `src/frontend/src/lib/queries/reverse.ts`

Currently uses `Api.REVERSE.ROOM_DETAIL(room_id)` via REST. The Django backend doesn't yet have reverse room models/GraphQL types. **Decision**: Keep REST for now until reverse rooms are ported to Django, or create a GraphQL-compatible endpoint.

**Status**: DEFER (reverse rooms not yet in Django)

### 4.3 WebSocket state management

**File**: `src/frontend/src/routes/.../upload/state.svelte.ts`

Connects to `Api.STATE_WS` (WebSocket). Django doesn't have WebSocket support yet. **Decision**: Add Django Channels or a raw ASGI WebSocket endpoint for upload state broadcasting.

**Status**: TODO (after backend verification)

### 4.4 Download streaming via presigned URL

**File**: `src/frontend/src/lib/functions/fetch-decrypt.ts`

Currently downloads from `Api.DOWNLOAD(slug)` via REST. The Django backend has a `download_file_stream` GraphQL mutation that returns a presigned S3 URL. Migrate to:
1. Call `downloadFileStream(fileKey: slug)` mutation to get presigned URL
2. Fetch encrypted data from presigned URL
3. Decrypt via WASM stream (unchanged)

**Status**: TODO

---

## Phase 5: Start Django Server and Verify End-to-End

### 5.1 Start Django development server

```bash
cd src/backend-django
python manage.py runserver 8002
```

Verify `/graphql/` endpoint responds with introspection.

**Status**: TODO

### 5.2 Test GraphQL queries

Hit the GraphQL endpoint with:
- `config` query
- `onboarding` query
- `login` mutation
- `fileInfo` query
- `adminFiles` query

**Status**: TODO

### 5.3 Start frontend dev server and verify

```bash
cd src/frontend
npm run dev
```

Verify:
- Onboarding page loads
- Login works
- Config page loads
- Admin pages load
- File upload flow works (encrypt → upload)
- File download flow works (presigned URL → decrypt)

**Status**: TODO

---

## Phase 6: Add WebSocket Support to Django (Upload State)

### 6.1 Install and configure Django Channels

Add `channels` to `INSTALLED_APPS`, configure `ASGI_APPLICATION`, add WebSocket routing.

### 6.2 Create upload state consumer

Port the WebSocket state broadcasting from FastAPI to Django Channels, preserving Redis pub/sub for state sync.

**Status**: TODO (after Phase 5 verification)

---

## Execution Order and Parallelization

```
Phase 1.1 (fix import bug) ──┐
Phase 1.2 (add logout) ──────┤──→ Parallel Agent 1: Django backend fixes
Phase 1.3 (verify upload) ───┘
                              │
Phase 2.1 (update URL) ───────┤
Phase 2.2 (update codegen) ───┤──→ Parallel Agent 2: Frontend URL + interface fixes
Phase 3.1 (fix interfaces) ───┤
Phase 3.2 (fix query modules)─┘
                              │
Phase 4.1 (page loads) ───────┤
Phase 4.4 (download stream) ──┤──→ Parallel Agent 3: REST → GraphQL migration
                              │
Phase 5 (E2E verification) ──┘──→ Sequential: start servers, verify in browser
```

---

## Verification Checklist

### Django Backend Fixes
- [ ] `get_presigned_download_url` imported in mutations
- [ ] `logout` mutation added
- [ ] Upload mutation field names match frontend
- [ ] CamelCase conversion verified
- [ ] `python manage.py check` still passes
- [ ] GraphQL endpoint responds on port 8002

### Frontend Fixes
- [ ] Backend URL updated to `localhost:8002`
- [ ] Codegen URL updated
- [ ] Interfaces use camelCase matching GraphQL response
- [ ] Query modules access correct camelCase keys
- [ ] `npm run check` passes
- [ ] `npm run build` succeeds

### End-to-End
- [ ] Onboarding flow works
- [ ] Login/logout works with JWT
- [ ] Config page loads via GraphQL
- [ ] Admin files page loads with pagination
- [ ] Admin users page works (CRUD)
- [ ] File upload → encrypt → S3 upload works
- [ ] File download → presigned URL → decrypt works
- [ ] Instance info/stats pages work
- [ ] Dark mode works on all pages
- [ ] Responsive at 1920px, 768px, 375px

---

## Critical Files Reference

### Django Backend (Needs Fixes)
- `src/backend-django/apps/graphql/mutations/__init__.py` — missing import + logout mutation
- `src/backend-django/core/settings.py` — configured, port 8002
- `src/backend-django/core/urls.py` — routes: /admin/, /graphql/, /files/

### Frontend (Needs Fixes)
- `src/frontend/src/lib/consts/backend.ts` — update default port
- `src/frontend/codegen.ts` — update schema URL
- `src/frontend/src/lib/graphql/hooks.ts` — fix snake_case interfaces
- `src/frontend/src/lib/queries/config.ts` — fix key access
- `src/frontend/src/lib/queries/onboarding.ts` — fix key access
- `src/frontend/src/lib/queries/file-info.ts` — fix key access
- `src/frontend/src/lib/queries/files.ts` — fix key access
- `src/frontend/src/lib/queries/instance.ts` — fix key access
- `src/frontend/src/lib/queries/admin_users.ts` — fix key access
- `src/frontend/src/lib/functions/fetch-decrypt.ts` — migrate to presigned URL
- `src/frontend/src/routes/.../view/[slug]/+page.ts` — migrate to GraphQL
- `src/frontend/src/routes/.../download/[slug]/+page.ts` — migrate to GraphQL

### Unchanged (Working Correctly)
- `src/frontend/src/lib/graphql/client.ts` — Apollo v4, relative `/graphql/` path
- `src/frontend/src/lib/graphql/queries.ts` — all query/mutation definitions correct
- `src/frontend/src/lib/workers/chithi.worker.ts` — WASM worker pool
- `src/frontend/src/lib/wasm/chithi_wasm.ts` — WASM C ABI wrapper
- `src/frontend/src/lib/functions/streams.ts` — encrypted stream helpers
- `crates/chithi-core/src/chithi_cryto.rs` — parallel XChaCha20 encryption
- `src/backend-django/apps/files/services.py` — S3 operations
- `src/backend-django/apps/files/tasks.py` — Celery expired file cleanup
