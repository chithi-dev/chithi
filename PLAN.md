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
| **Rust WASM** | DONE | `wasm_thread` parallel feature enabled, `+atomics,+simd128` flags set, build script uses `SharedArrayBuffer` |
| **JS Worker Pool** | DONE | `WORKER_CONCURRENCY = 1` (Rust handles parallelism), streams use worker dispatch |
| **Django Project** | PARTIAL | Settings, mixins, models (User/File/Config), Celery, S3 all configured |
| **GraphQL Schema** | PARTIAL | Basic Query/Mutation (users, files, config, login, logout, CRUD) — missing upload, onboarding, instance info/stats |
| **Frontend API** | REST | All queries hit FastAPI REST endpoints via `fetch()` — needs GraphQL migration |
| **shadcn-svelte** | MOSTLY DONE | 46 components installed, namespace imports correct, Data Table on admin pages |

---

## Phase 1: Complete Django + Strawberry-Django Backend

**Priority**: HIGH — blocks frontend GraphQL migration
**Agent**: Single focused agent

### 1A: Add missing GraphQL mutations

**File**: `src/backend-django/apps/graphql/schema.py`

The schema currently has basic CRUD. Missing mutations that the FastAPI backend provides:

| Mutation | FastAPI Endpoint | Purpose |
|---|---|---|
| `upload_file` | `POST /api/v1/upload/` | Create File record for upload |
| `upload_file_data` | `POST /api/v1/upload/{slug}/` | Receive encrypted file data, push to S3 |
| `download_file_info` | `GET /api/v1/download/{slug}/` | Get file info for download |
| `download_file_data` | `GET /api/v1/download/{slug}/data/` | Stream encrypted file from S3 |
| `complete_onboarding` | `POST /api/v1/onboarding/` | Create admin user + default config |
| `view_file_data` | `GET /api/v1/view/{slug}/data/` | Stream file for preview |
| `revoke_file` | `POST /api/v1/admin/files/{id}/revoke/` | Admin: revoke a file |

```python
@strawberry_django.mutation
def upload_file(
    self,
    info: Info,
    filename: str,
    expire_after: int,
    expire_after_n_download: int,
    number_of_files: int | None = None,
) -> FileType:
    """Create a new File record, return slug for upload."""
    from django.utils import timezone
    import uuid

    config = Config.load()
    # Validate against config limits...
    slug = uuid.uuid4().hex[:8]
    file = File.objects.create(
        key=slug,
        filename=filename,
        expires_at=timezone.now() + timezone.timedelta(seconds=expire_after),
        expire_after_n_download=expire_after_n_download,
        number_of_files=number_of_files,
    )
    return file

@strawberry.mutation
def complete_onboarding(
    self,
    username: str,
    email: str,
    password: str,
    site_description: str = "Secure file sharing service",
) -> OnboardingPOSTOut:
    """Complete onboarding: create admin user + default config."""
    User = get_user_model()
    user = User.objects.create_superuser(username=username, email=email, password=password)
    Config.objects.update_or_create(
        pk=1,
        defaults={"site_description": site_description},
    )
    access, refresh = get_jwt_tokens(user)
    return OnboardingPOSTOut(access=access, refresh=refresh, onboarded=True)
```

### 1B: Add missing GraphQL queries

**File**: `src/backend-django/apps/graphql/schema.py`

| Query | FastAPI Endpoint | Purpose |
|---|---|---|
| `file_info(slug: str)` | `GET /api/v1/files/{slug}/` | Get file metadata by slug |
| `instance_information()` | `GET /api/v1/info/` | Backend version, Python version, etc. |
| `instance_statistics()` | `GET /api/v1/info/statistics/` | Storage used, file counts, etc. |

```python
@strawberry.field
def file_info(self, slug: str) -> FileType | None:
    return File.objects.filter(key=slug).first()

@strawberry.field
def instance_information(self) -> InstanceInfoType:
    import sys, platform
    return InstanceInfoType(
        backend_version="0.1.0",
        python_version=sys.version,
        platform=platform.platform(),
    )

@strawberry.field
def instance_statistics(self) -> InstanceStatisticsType:
    total_files = File.objects.count()
    active_files = File.objects.filter(is_expired=False).count()
    # Calculate storage used from File sizes...
    return InstanceStatisticsType(...)
```

### 1C: Add file upload/download S3 streaming

**File**: `src/backend-django/apps/files/services.py` (NEW)

Create S3 service layer for file operations:

```python
import boto3
from django.conf import settings

s3_client = boto3.client(
    "s3",
    endpoint_url=settings.AWS_S3_ENDPOINT_URL,
    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
)

def upload_file_data(key: str, data: bytes) -> None:
    """Upload encrypted file data to S3."""
    s3_client.put_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key, Body=data)

def download_file_data(key: str) -> bytes:
    """Download encrypted file data from S3."""
    response = s3_client.get_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)
    return response["Body"].read()

def delete_file_from_s3(key: str) -> None:
    """Delete file from S3."""
    s3_client.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=key)

def get_presigned_download_url(key: str, expires_in: int = 3600) -> str:
    """Generate presigned URL for direct S3 download."""
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.AWS_STORAGE_BUCKET_NAME, "Key": key},
        ExpiresIn=expires_in,
    )
```

For large file uploads, use **multipart upload** via S3 presigned URLs:
1. Mutation returns presigned upload URL
2. Frontend streams encrypted data directly to S3
3. Frontend notifies backend when upload complete

### 1D: Add reverse transfer WebSocket

**File**: `src/backend-django/apps/reverse/` (NEW)

Port the reverse file share WebSocket from FastAPI:

- WebSocket endpoint at `/ws/reverse/rooms/{room_id}/`
- Host/guest routing
- File streaming over WebSocket
- Room management (create, join, leave)

Use `channels` or raw ASGI WebSocket handling.

### 1E: Remove AppState WebSocket broadcast

The old FastAPI backend broadcasted global state via WebSocket at `/ws/state`. **Remove this entirely** — frontend queries GraphQL directly for config, stats, file info.

### 1F: Add admin file listing with pagination

**File**: `src/backend-django/apps/graphql/schema.py`

```python
@strawberry_django.field
def admin_files(
    self,
    info: Info,
    page: int = 1,
    size: int = 20,
    search: str | None = None,
) -> PaginatedFiles:
    """Paginated file listing for admin panel."""
    queryset = File.objects.all().order_by("-created_at")
    if search:
        queryset = queryset.filter(filename__icontains=search)
    # Paginate and return...
```

### 1G: Run migrations and verify

```bash
cd src/backend-django
python manage.py makemigrations
python manage.py migrate
python manage.py check
# Test GraphQL endpoint
curl -X POST http://localhost:8000/graphql/ -H "Content-Type: application/json" -d '{"query": "{ config { siteDescription } }"}'
```

---

## Phase 2: Frontend GraphQL Client Integration

**Priority**: HIGH — depends on Phase 1 completion
**Agent**: Frontend-focused agent

### 2A: Set up GraphQL client

Install and configure a GraphQL client for SvelteKit. Options:
- **Urql** (recommended) — `@urql/svelte` integrates with TanStack Query patterns
- **Gql.tada** — type-safe GraphQL queries at compile time

```ts
// src/frontend/src/lib/graphql/client.ts
import { createClient, cacheExchange, fetchExchange } from "urql";

export const client = createClient({
  url: "/graphql/",
  exchanges: [cacheExchange, fetchExchange],
  fetchOptions: () => {
    const token = localStorage.getItem("access_token");
    return {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    };
  },
});
```

### 2B: Define GraphQL query/mutation hooks

Replace REST query hooks with GraphQL equivalents:

**File**: `src/frontend/src/lib/queries/` — rewrite all query files

```ts
// Example: config query
import { client } from "$lib/graphql/client";

export const CONFIG_QUERY = `query { config { totalStorageLimit, maxFileSizeLimit, ... } }`;

export function useConfigQuery() {
  return client.query(CONFIG_QUERY, {});
}
```

Queries to migrate (same order as current REST queries):
1. `config.ts` — site configuration
2. `auth.ts` — current user, user update
3. `file-info.ts` — file metadata by slug
4. `files.ts` — admin file listing with pagination
5. `admin_users.ts` — admin user management
6. `instance.ts` — instance info and statistics
7. `onboarding.ts` — onboarding status and completion
8. `reverse.ts` — reverse room queries (if not WebSocket-only)

### 2C: Migrate form actions to GraphQL mutations

Forms that currently POST to REST endpoints:
1. Login form → `login` mutation (already exists)
2. Onboarding forms → `completeOnboarding` mutation (Phase 1A)
3. Admin config form → `updateConfig` mutation (already exists)
4. Admin user create → `createUser` mutation (already exists)
5. File upload initiation → `uploadFile` mutation (Phase 1A)

### 2D: Migrate file upload/download flows

The upload flow is the most complex:
1. Select files → configure → call `uploadFile` mutation to get slug
2. Encrypt via WASM worker pool
3. Stream encrypted data to S3 via presigned URL (or through backend)
4. Notify backend of completion

Download flow:
1. Call `fileInfo(slug)` query
2. Prompt for password if needed
3. Stream encrypted data from S3 (presigned URL or backend proxy)
4. Decrypt via WASM worker pool
5. Download/preview

### 2E: Update remote functions

The remote auth function at `src/frontend/src/lib/remote/auth.remote.ts` currently calls REST. Update to call GraphQL mutations.

### 2F: Remove old API URL constants

Remove or deprecate the `Api.*` constants that point to FastAPI REST endpoints.

---

## Phase 3: Frontend shadcn-svelte + SvelteKit Polish

**Priority**: MEDIUM — can run in parallel with Phase 2
**Agent**: Frontend UI agent

### 3A: Adopt remaining shadcn-svelte components

| Component | Where to use | Replaces |
|---|---|---|
| `HoverCard` | File info links on view/download pages | Bare links |
| `Empty` | Empty file lists, no-results states | Custom empty divs |
| `Spinner` | Any remaining `LoaderCircle` + `animate-spin` | Icon workaround |
| `Alert` | Error/info messages on upload page | Custom banners |
| `Typography` | Info pages (`/informations/`) | Raw `<h1>`, `<p>` |
| `Separator` | Section dividers in admin pages | Manual `<hr>` |
| `Pagination` | Admin file listing | Custom pagination |
| `Combobox` | File type filtering | Custom select |

### 3B: SvelteKit load function alignment

Ensure all page-level data uses SvelteKit `load` functions:

```ts
// +page.ts pattern
import type { PageLoad } from "./$types";

export const load: PageLoad = async ({ fetch, data }) => {
  const config = await fetch("/graphql/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: "{ config { ... } }" }),
  }).then(r => r.json());
  return { config };
};
```

### 3C: Verify dark mode + responsive

After all changes, verify at multiple viewports and in both light/dark modes using Playwright.

---

## Phase 4: WASM Multi-Core Verification

**Priority**: MEDIUM — verify, not implement (already done)
**Agent**: Testing agent

### 4A: Verify wasm_thread parallelism in browser

The Rust code already uses `wasm_thread::scope` for parallel chunk encryption/decryption. Verify:

1. Build WASM: `python scripts/build_wasm.py`
2. Start dev server
3. Upload a large file (500MB+)
4. Chrome DevTools → Performance tab: verify all CPU cores show activity
5. Check `wasm_thread` worker threads appear in DevTools Memory tab
6. Measure wall-clock encryption time vs sequential baseline

### 4B: Verify COOP/COEP headers

The `hooks.ts` already sets `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`. Verify these are present in production builds (required for `SharedArrayBuffer`).

### 4C: End-to-end encryption test

1. Upload encrypted file
2. Download and decrypt
3. Verify file integrity (compare hashes)
4. Test with and without password
5. Test parallel encrypt/decrypt paths

---

## Implementation Order

```
Phase 1 (Complete Django backend) ─────────┐
                                           ├─ MUST complete first
Phase 2 (Frontend GraphQL migration) ──────┤
                                           ├─ Depends on Phase 1
Phase 3 (Frontend UI polish) ──────────────┤
                                           └─ Can run parallel with Phase 2
Phase 4 (WASM verification) ────────────────┘
                                           └─ Can run anytime independently
```

### Workflow agent plan:

1. **Agent 1**: Complete Django backend (Phase 1A-1G) — add all missing mutations/queries, S3 service, reverse WebSocket
2. **Agent 2**: WASM verification (Phase 4A-4C) — build and test parallel encryption
3. **Agent 3**: Frontend GraphQL migration (Phase 2A-2F) — set up client, migrate queries/mutations
4. **Agent 4**: Frontend UI polish (Phase 3A-3C) — adopt new shadcn components, SvelteKit alignment

Agents 2 and 3 can start once Agent 1 completes. Agent 4 runs parallel with Agent 3.

---

## Critical Files Reference

### Django Backend (Phase 1)
- `src/backend-django/apps/graphql/schema.py` — add upload, onboarding, instance info/stats mutations
- `src/backend-django/apps/graphql/types.py` — add InstanceInfoType, InstanceStatisticsType, OnboardingPOSTOut
- `src/backend-django/apps/files/services.py` — NEW: S3 upload/download service
- `src/backend-django/apps/reverse/` — NEW: WebSocket reverse transfer
- `src/backend-django/apps/graphql/schema.py` — add admin file pagination

### Frontend (Phases 2-3)
- `src/frontend/src/lib/graphql/client.ts` — NEW: GraphQL client setup
- `src/frontend/src/lib/queries/*.ts` — rewrite all to use GraphQL
- `src/frontend/src/lib/remote/auth.remote.ts` — update to GraphQL
- `src/frontend/src/routes/**/+page.svelte` — verify shadcn component usage
- `src/frontend/src/routes/admin/**/+page.svelte` — verify Data Table + Pagination

### WASM (Phase 4)
- `crates/chithi-core/src/chithi_cryto.rs` — already uses `wasm_thread`
- `scripts/build_wasm.py` — already generates `SharedArrayBuffer`
- `src/frontend/src/hooks.ts` — already sets COOP/COEP

### FastAPI Backend (reference for porting)
- `src/backend/app/routes/http/` — 17 REST endpoints to port to GraphQL mutations
- `src/backend/app/states/app.py` — AppState broadcast (REMOVED, frontend queries GraphQL)
- `src/backend/app/routes/ws/` — WebSocket state (REMOVED) + reverse (PORTED)

---

## Verification Checklist

### Django Backend
- [ ] `python manage.py check` passes
- [ ] `python manage.py migrate` runs
- [ ] GraphQL endpoint responds: `curl -X POST http://localhost:8000/graphql/`
- [ ] Login mutation returns JWT tokens
- [ ] Upload mutation creates File record
- [ ] S3 upload/download works
- [ ] Celery worker processes expired file cleanup
- [ ] Reverse WebSocket connects and streams

### Frontend
- [ ] `npm run check` — TypeScript passes
- [ ] `npm run build` — Vite build succeeds
- [ ] All pages load via GraphQL (no REST calls)
- [ ] Login/logout works with JWT
- [ ] File upload → encrypt → upload flow works
- [ ] File download → decrypt → save flow works
- [ ] Admin panel with Data Table + pagination
- [ ] Dark mode works on all pages
- [ ] Responsive at 1920px, 768px, 375px

### WASM Multi-Core
- [ ] WASM builds successfully
- [ ] All CPU cores active during encryption
- [ ] `wasm_thread` workers visible in DevTools
- [ ] End-to-end encrypt/decrypt integrity verified
- [ ] Memory stable across repeated operations

---

## Notes

- **No AppState broadcast**: Frontend queries GraphQL directly for all state. The `/ws/state` WebSocket is removed.
- **Reverse transfer WebSocket**: Kept at `/ws/reverse/rooms/{room_id}/` for real-time file streaming (not replaceable by GraphQL).
- **S3 streaming**: Use presigned URLs for large file uploads/downloads to avoid bottlenecking through Django.
- **COOP/COEP**: Already set in `hooks.ts`, required for `SharedArrayBuffer` (used by `wasm_thread`).
- **WORKER_CONCURRENCY = 1**: JS worker pool is a thin transport layer; Rust `wasm_thread` handles all parallelism internally.
