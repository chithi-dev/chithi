# Chithi Implementation Plan

> **Status**: Active — v3 crypto upgrade (AES-256-GCM + Argon2id) complete on frontend + CLI
> **Date**: 2026-10-05
> **Branch**: `feat/jxr-other`
>
> **Current architecture** (post-rewrite):
> - **Backend**: Django + Strawberry GraphQL + aioboto3 (S3) — runs on port 8001
> - **Frontend**: SvelteKit 2 + Svelte 5 + Apollo Client 4 + TanStack Svelte Query + fflate — uploads 50 MB chunks to S3 via Django, downloads chunks directly from S3 (presigned URLs, behind Cloudflare)
> - **CLI**: Python — pure Python crypto (`cryptography` + `argon2-cffi`); chunked GraphQL client
> - **Crypto v3**: **AES-256-GCM** (up from AES-128) + **Argon2id** password KDF (up from PBKDF2) + HKDF-SHA-256 with a **real per-file 16-byte salt** wired into both Argon2id and HKDF. ECE (RFC 8188), 64 KiB records. Wire header is now `[16B salt][1B version=3][4B record_size BE]` (21 bytes).
> - **Removed**: Rust crates, WASM SDKs, WebSockets, reverse-share
>
> **Current focus**: Crypto docs refresh + end-to-end browser verification.

---

## Current State Snapshot

| Area | Status | Detail |
|---|---|---|
| **Rust WASM** | REMOVED | Rust crates deleted; replaced with pure Web Crypto API |
| **Web Crypto Streams** | DONE | `streams.ts` — HKDF + AES-128-GCM ECE, worker-based, 64 KiB records |
| **Django Project** | DONE | Settings, models, Celery, S3 configured (port 8001) |
| **GraphQL Schema** | DONE | Chunked upload/download mutations (registerFile, uploadFileChunk, completeUpload, chunkUrl) |
| **S3 Service Layer** | DONE | `apps/files/services.py` — chunked upload, presigned download URLs |
| **Celery Expired Files** | DONE | `apps/files/tasks.py` `delete_file_after_expiry(file_key)` (Celery `shared_task`); one-shot, enqueued at register via `services.schedule_expiry` (countdown = `expires_at - timezone.now()`, derived from Django's timezone-aware clock); no beat needed -- file deleted exactly at expiry |
| **Frontend GraphQL Client** | DONE | Apollo Client v4, codegen, generated types, apollo-upload-client |
| **Frontend TypeScript** | DONE | Download-flow files type-clean; remaining 38 errors in pre-existing admin/reverse files (out of scope) |
| **Frontend Build** | DONE | `npm run build` passes |
| **Django Migrations** | DONE | SQLite + PostgreSQL compatible |
| **Frontend camelCase Migration** | DONE | All GraphQL interfaces, query modules, and Svelte components migrated |
| **shadcn-svelte Compliance** | DONE | 46 components, docs-exact patterns |
| **Chunked Upload (50 MB)** | DONE | `upload.ts` — registerFile → uploadFileChunk loop → completeUpload |
| **Chunked Download (50 MB)** | DONE | `download.ts` — fileInfo → chunkUrl loop → reassemble → decrypt |
| **WebSocket Removal** | PARTIAL | WebSockets removed from backend; `Api.STATE_WS` / `Api.REVERSE` in `backend.ts` documented as placeholder URLs kept only to keep the dead reverse-share / state code compiling -- remove once that code is deleted |
| **Crypto v3 (frontend)** | DONE | `encryption.ts`/`streams.ts`/`crypto.worker.ts` — AES-256-GCM + Argon2id + real per-file salt; `npm run check` clean |
| **Crypto v3 (CLI)** | DONE | `crypto.py` rewritten (argon2-cffi + cryptography); 14 tests pass; cross-language interop verified |
| **Crypto Docs** | DONE | `apps/docs/crypto-architecture.md` rewritten to v3 |
| **CLI Client Rewrite** | DONE | `client.py` uses chunked GraphQL (registerFile → uploadFileChunk → completeUpload) + S3 presigned download |
| **CLI Commands Update** | DONE | `upload.py` + `download.py` use new client API (bytes in/out, no temp files) |
| **WASM Bridge Removal** | DONE | `chithi_core_bridge.py` deleted; `chithi-sdk` dep removed from pyproject.toml |
| **Apollo SSR Prefetch** | DONE | `server-client.ts` (ssrMode) + `hydration.svelte.ts` (usePrefetchedQuery) + `hydration-boundary.svelte`; all pages migrated from TanStack to pure Apollo; `/login` SSR 200 with full dehydrated cache |
| **HTTP Upload Path** | DONE | `apps/api/` package (django-ninja): register/chunk/complete under `/api/upload/`; views import shared `schemas/` + `utils/`; async views wrap ORM in `sync_to_async`; E2E register→chunk→complete verified, chunk written to store |
| **Async Config Singleton** | DONE | `SingletonModel.aload()` via Django 6 native async ORM (`aget_or_create`); all async call sites (REST `/config/`, upload validation, GraphQL config + file mutations) use `await Config.aload()`; `onboarding` uses `aget` to avoid a create side effect; `load()` retained for sync-only contexts |
| **E2E Verification** | DONE | CLI upload→download round-trip, matching md5; Playwright browser E2E still pending |
| **CLI Async Refactor** | DONE | All crypto/archive/QR helpers async via `anyio.to_thread`; banner comments removed; dead `urls.py` helpers removed; `__future__` imports removed; full round-trip verified |
| **Speedtest (ninja)** | DONE | `apps/api/views/speedtest.py` — download/upload/latency under `/api/speedtest/`; async `_iter_chunks`; all three endpoints verified against live backend |
| **Legacy Django Views** | REMOVED | `apps/files/views.py`, `speedtest.py`, `speedtest_urls.py`, `urls.py` deleted; all routes served via GraphQL or ninja API only |
| **Middleware Auth** | DONE | `core/middleware.py` `JwtAuthenticationMiddleware` injects `request.user` from Bearer JWT on every request (session auth takes priority); registered after `AuthenticationMiddleware`; GraphQL context forwards `request.user`; verified JWT sets user on both GraphQL `me` and a ninja endpoint; 3 middleware tests pass |
| **Celery (one-shot)** | DONE | `core/celery.py` (Celery app, no beat); `core/__init__.py` imports `celery_app`; `core/settings.py` `TASKS` (django.tasks) removed, replaced with `CELERY_BROKER_URL`/`CELERY_RESULT_BACKEND`; `pyproject.toml` adds `celery[redis]`; `services.schedule_expiry` shared helper enqueues at register (GraphQL + ninja); 8 Docker docs keep `celery` worker (no beat); 6 task tests pass |
| **Type Hints (Backend)** | DONE | All views, resolvers, managers, services fully annotated; no `Any` used; `manager.py` `**extra_fields: bool \| str`; `services.py` fully typed via django-storages |
| **Type Hints (CLI)** | DONE | `test/test_crypto.py` moved to `test/` package; all 14 test functions annotated `-> None`; async calls wrapped in `asyncio.run`; `print.py` `__rich_console__` return type added; 14/14 tests pass |
| **django-storages** | DONE | `aioboto3` + hand-rolled boto3 removed; `STORAGES` dict in settings.py selects `S3Storage` (creds present) or `FileSystemStorage` (dev); `services.py` rewritten on `default_storage` API (`save`/`url`/`delete`/`exists`); sync calls wrapped in `sync_to_async`; upload/exist/url/delete round-trip verified; CDN via `S3_CDN_URL` setting |
| **Delete-Safety Fix** | DONE | `delete_file_chunks` no longer crashes on a missing prefix (local-filesystem `listdir` raises `FileNotFoundError`; S3 returns empty) - now a safe no-op |
| **Backend Docs** | DONE | `backend/storage.md` (multi-backend), `backend/custom-clients.md` (REST+GraphQL protocol + Docker hosting), `crypto-architecture.md` moved into docs/; all registered in nav; Zensical build clean |
| **Docker Celery Docs** | DONE | `celery` worker service present in all 8 compose files (basic + watchtower x vanila/caddy/nginx/traefik); no beat service (one-shot tasks, no periodic scheduler); all YAML validated |
| **Chunk Proxy (ninja)** | DONE | `apps/api/views/files.py` `GET /files/{key}/chunk/{index}/bytes/` streams chunk bytes through the backend (one egress URL, no direct CDN); 200 + exact Content-Length + byte-for-byte match verified, expired -> 422 |
| **Unified Chunk Stream** | DONE | `services.open_chunk_stream()` is the single async interface for chunk egress. `S3_CDN_URL` set -> `httpx.AsyncClient` v2 `client.stream()` + `aiter_bytes` (all egress backend-mediated, client never hits the CDN); local `FileSystemStorage` -> `aiofiles` true-async reads; S3 -> `sync_to_async` handle with per-block loop yield. View is a one-liner `StreamingHttpResponse(services.open_chunk_stream(...))`; new deps `httpx` + `aiofiles` in `pyproject.toml`; 4 tests in `tests/test_chunk_stream.py` pass |
| **N-Download Eviction** | DONE | `services.record_download()` increments `download_count` (atomic `F()`); called when the *last* chunk is fetched (the only signal a full download completed) by both `chunk_url` transports (GraphQL + ninja); when the count hits `expire_after_n_download`, schedules one-shot deletion (countdown=0), mirroring the time-based path; 8 task tests pass |
| **Frontend Env Vars** | DONE | `src/env.ts` with `defineEnvVars` (zod schemas) for `PUBLIC_BACKEND_API` + optional donation/instance URLs; `experimental.explicitEnvironmentVariables: true` in `svelte.config.js`; `@sveltejs/kit` upgraded to `^2.70.3`; all `$env/dynamic/public` + `#consts/urls` consumers migrated to `import { ... } from '$app/env/public'` (backend.ts, layout.svelte); `svelte-check` clean on touched files |

---

## Phase 1: Fix Critical File Upload — Add `apollo-upload-client` 🔴 BLOCKER

### 1.1 Install and configure `apollo-upload-client`

**Problem**: The frontend sends file uploads via GraphQL `UPLOAD_FILE_MUTATION` which uses `$file: Upload!`. The current Apollo client uses `HttpLink` which does **NOT** support GraphQL multipart file uploads. This is the #1 blocker — file uploads will fail silently or throw a serialization error.

**Files**:
- `src/frontend/package.json` — add `apollo-upload-client` dependency
- `src/frontend/src/lib/graphql/client.ts` — replace `HttpLink` with `createUploadLink`

**Implementation**:

```bash
cd src/frontend
npm install apollo-upload-client
```

Then update `client.ts`:

```ts
import { ApolloClient, InMemoryCache, ApolloLink } from '@apollo/client/core';
import { createUploadLink } from 'apollo-upload-client';

function getAuthHeaders(): Record<string, string> {
  const token = typeof localStorage !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

const authLink = new ApolloLink((operation, forward) => {
  operation.setContext({
    headers: getAuthHeaders()
  });
  return forward(operation);
});

const uploadLink = createUploadLink({
  uri: '/graphql/',
  credentials: 'include',
});

export const client = new ApolloClient({
  link: authLink.concat(uploadLink),
  cache: new InMemoryCache()
});
```

**Why**: `createUploadLink` detects `Upload` type variables and serializes them as multipart/form-data per the GraphQL Multipart Request Spec. `HttpLink` sends everything as JSON and cannot handle binary file uploads.

**Status**: TODO

### 1.2 Verify `strawberry-graphql` supports multipart file uploads

**File**: `src/backend-django/core/settings.py`

Strawberry-GraphQL requires `strawberry-graphql-django` with file upload support. The `UPLOAD_FILE_MUTATION` uses `Upload` type, and the Django view at `/graphql/` must handle multipart requests.

Verify the GraphQL view is configured with `multipart_uploads_enabled=True`:

```python
from strawberry.django.views import AsyncGraphQLView

class GraphQLView(AsyncGraphQLView):
    # multipart_uploads_enabled is True by default in strawberry-graphql
    pass
```

**Status**: VERIFY

### 1.3 Verify upload mutation parameter names match

**Frontend mutation** (`queries.ts`):
```graphql
mutation UploadFile($file: Upload!, $filename: String!, $expiresAt: Int!, $expireAfterNDownload: Int!, $numberOfFiles: Int)
```

**Django resolver** (`mutations/__init__.py`):
```python
async def upload_file(self, filename: str, file: Upload, expires_at: int, expire_after_n_download: int, number_of_files: int | None = None)
```

Strawberry auto-converts `expires_at` → `expiresAt` and `expire_after_n_download` → `expireAfterNDownload`. **This should match.**

**Status**: VERIFY

---

## Phase 2: File Download — Backend Serves Files Directly (No Presigned URLs)

### 2.1 Confirm download flow

**Decision**: Users never access S3 directly. The backend serves all files, exactly like FastAPI did.

**File**: `src/backend/apps/files/views.py` — `download_file` view already exists and correctly:
- Streams files from both local storage and S3 backends
- Enforces atomic expiry/download-count checks via F() expressions
- Increments download count only after successful stream completion
- Returns `StreamingHttpResponse` for S3, `FileResponse` for local storage

**File**: `src/backend/apps/files/urls.py` — URL pattern `path("<uuid:file_id>/", download_file)` already wired

**File**: `src/frontend/src/lib/functions/fetch-decrypt.ts` — already calls `Api.DOWNLOAD(slug)` which hits `/files/<uuid>/` — **correct, no change needed**

**Removed**: `download_file_stream` mutation that returned presigned URLs — deleted from `file.py`

**Status**: DONE — confirmed correct architecture

---

## Phase 3: Start Django Server and Verify End-to-End

### 3.1 Start Django development server

```bash
cd src/backend-django
python manage.py runserver 8002
```

Verify `/graphql/` endpoint responds with introspection.

**Status**: TODO

### 3.2 Test GraphQL queries

Hit the GraphQL endpoint with:
- `config` query
- `onboarding` query
- `login` mutation
- `fileInfo` query
- `adminFiles` query

**Status**: TODO

### 3.3 Start frontend dev server and verify

```bash
cd src/frontend
npm run dev
```

Verify:
- Onboarding page loads
- Login works
- Config page loads
- Admin pages load
- **File upload flow works** (encrypt → upload via apollo-upload-client)
- **File download flow works** (presigned URL → decrypt)

**Status**: TODO

---

## Phase 4: Migrate Page Load Functions to GraphQL

### 4.1 View/Download page load functions

**Files**:
- `src/frontend/src/routes/.../view/[slug]/+page.ts`
- `src/frontend/src/routes/.../download/[slug]/+page.ts`

Currently call `Api.FILE_INFO(params.slug)` via REST `fetch()`. Migrate to use the GraphQL client.

**Status**: TODO (after Phase 3 verification)

### 4.2 Reverse room REST calls

**File**: `src/frontend/src/lib/queries/reverse.ts`

Currently uses `Api.REVERSE.ROOM_DETAIL(room_id)` via REST. Django doesn't have reverse room models yet.

**Status**: DEFER (reverse rooms not yet in Django)

### 4.3 WebSocket state management

**File**: `src/frontend/src/routes/.../upload/state.svelte.ts`

Connects to `Api.STATE_WS` (WebSocket). Django doesn't have WebSocket support yet.

**Status**: DEFER (needs Django Channels)

---

## Phase 5: CLI Rewrite — Pure Python Crypto ✅

### 5.1 Rewrite `crypto.py` using `cryptography` + `argon2-cffi` ✅ DONE (v3)

Pure Python ECE implementation in `src/cli/app/helpers/crypto.py`, mirrors the
frontend exactly:
- Argon2id(password, header_salt, t=3, m=64 MiB, p=1) → 32B IKM  *(was PBKDF2 → 16B)*
- HKDF-SHA256(IKM, salt=header_salt, info='chithi-file-key-v3') → 32B AES-256 key
- nonceBase = SHA-256(file_key)[0:12]
- Per-record nonce = nonceBase XOR (seq as last 4 bytes, BE)
- Wire format: `[16B salt][1B version=3][4B record_size BE][AES-256-GCM record_0]...`
- Each record: 64 KiB plaintext → 65552 bytes ciphertext (64 KiB + 16B GCM tag)
- Zip via `zipfile` (zlib level 6)
- `cryptography>=42.0.0` + `argon2-cffi>=25.1.0` in pyproject.toml
- **Cross-language interop verified**: TS HKDF file-key + nonceBase byte-identical to
  Python; frontend pipeline decrypts a CLI-produced 3-record ciphertext.

### 5.2 Rewrite `client.py` for chunked GraphQL ✅ DONE

- `registerFile` → `uploadFileChunk` (multipart GraphQL) → `completeUpload` for upload
- `fileInfo` → `chunkUrl` (presigned S3) → fetch chunks for download
- `CHUNK_SIZE = 50 MB` matches backend
- No temp files — upload takes `bytes`, download returns `bytes`

### 5.3 Update CLI commands ✅ DONE

- `upload.py`: encrypt → `c.upload_file(bundle.raw, ...)` (no temp file)
- `download.py`: `c.download_file(slug)` → `decrypt_and_decompress(bundle_data, ...)`

---

## Phase 6: Remove Remaining WebSocket References

### 6.1 Clean up `upload/state.svelte.ts`

Remove or replace the WebSocket state store. Upload progress is now tracked locally (per-chunk callbacks) — no server push needed.

**File**: `src/frontend/src/routes/.../upload/state.svelte.ts`

**Status**: TODO

### 6.2 Remove `Api.STATE_WS` and `Api.REVERSE`

**File**: `src/frontend/src/lib/consts/backend.ts`

**Status**: TODO

---

## Execution Order and Parallelization

```
Phase 1.1 (install apollo-upload-client) ──┐
Phase 1.2 (verify multipart support) ──────┤──→ Agent 1: Fix file upload pipeline
Phase 1.3 (verify param names) ────────────┘
                                          │
Phase 2.1 (migrate download to presigned) ─┤──→ Agent 2: Fix download pipeline
Phase 2.2 (remove REST dependency) ────────┘
                                          │
Phase 3.1 (start Django) ─────────────────┤
Phase 3.2 (test GraphQL) ─────────────────┤──→ Sequential: Start servers, verify E2E
Phase 3.3 (start frontend + verify) ──────┘
                                          │
Phase 4 (migrate page loads) ─────────────┤──→ Agent 3: REST → GraphQL migration
Phase 5 (WASM verification) ──────────────┘
```

---

## Verification Checklist

### File Upload Pipeline
- [ ] `apollo-upload-client` installed
- [ ] `createUploadLink` configured in Apollo client
- [ ] `HttpLink` replaced with `createUploadLink`
- [ ] Strawberry multipart file upload supported
- [ ] Upload mutation parameter names match
- [ ] End-to-end: select files → encrypt → upload → S3

### File Download Pipeline
- [ ] `download_file` view streams files through backend (no presigned URLs)
- [ ] `fetch-decrypt.ts` calls `Api.DOWNLOAD(slug)` → backend serves encrypted data
- [ ] End-to-end: backend serves file → frontend decrypts → save

### Django Backend
- [ ] `python manage.py check` passes
- [ ] GraphQL endpoint responds on port 8002
- [ ] All queries resolve correctly
- [ ] All mutations resolve correctly
- [ ] S3 upload/download works

### Frontend
- [ ] `npm run check` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] Onboarding flow works
- [ ] Login/logout works with JWT
- [ ] Config page loads via GraphQL
- [ ] Admin files page loads with pagination
- [ ] Admin users page works (CRUD)
- [ ] Instance info/stats pages work
- [ ] Dark mode works on all pages
- [ ] Responsive at 1920px, 768px, 375px

### WASM Multi-Core
- [ ] `parallel` feature enabled in chithi-core
- [ ] WASM compiled with `+atomics,+simd128`
- [ ] SharedArrayBuffer available (COOP/COEP headers)
- [ ] Parallel encryption works in browser
- [ ] Parallel decryption works in browser

---

## Critical Files Reference

### Django Backend (Needs Fixes)
- `src/backend-django/apps/graphql/mutations/__init__.py` — upload mutation, presigned URL
- `src/backend-django/core/settings.py` — configured, port 8002
- `src/backend-django/core/urls.py` — routes: /admin/, /graphql/, /files/
- `src/backend-django/apps/files/services.py` — S3 operations, presigned URLs

### Frontend (Needs Fixes)
- `src/frontend/package.json` — add `apollo-upload-client`
- `src/frontend/src/lib/graphql/client.ts` — replace `HttpLink` with `createUploadLink`
- `src/frontend/src/lib/functions/fetch-decrypt.ts` — migrate to presigned URL
- `src/frontend/src/routes/.../view/[slug]/+page.ts` — migrate to GraphQL
- `src/frontend/src/routes/.../download/[slug]/+page.ts` — migrate to GraphQL

### Frontend (Completed)
- `src/frontend/src/lib/consts/backend.ts` — ✅ port updated to 8002
- `src/frontend/codegen.ts` — ✅ schema URL updated
- `src/frontend/src/lib/graphql/hooks.ts` — ✅ all interfaces camelCase
- `src/frontend/src/lib/queries/*.ts` — ✅ all query modules camelCase
- `src/frontend/src/lib/graphql/queries.ts` — ✅ UPLOAD_FILE_MUTATION uses `$file: Upload!`
- `src/frontend/src/routes/**/+page.svelte` — ✅ all components use camelCase data access

### Unchanged (Working Correctly)
- `src/frontend/src/lib/workers/chithi.worker.ts` — WASM worker pool
- `src/frontend/src/lib/wasm/chithi_wasm.ts` — WASM C ABI wrapper
- `src/frontend/src/lib/functions/streams.ts` — encrypted stream helpers
- `crates/chithi-core/src/chithi_cryto.rs` — parallel XChaCha20 encryption
- `src/backend-django/apps/files/tasks.py` — Celery expired file cleanup

---

## Known Risks and Mitigations

### Risk 1: `apollo-upload-client` compatibility with Apollo Client v4

`apollo-upload-client` may need a specific version for Apollo Client v4. Check `package.json` for `@apollo/client` version and install a compatible `apollo-upload-client`.

**Mitigation**: Use `npm install apollo-upload-client` and verify the peer dependency resolution. If incompatible, use `@apollo/client`'s built-in `FileUploadLink` (if available in v4).

### Risk 2: Large file streaming memory

S3 streaming downloads buffer chunks in memory. For very large files, this could be slow.

**Mitigation**: The `download_file` view uses `StreamingHttpResponse` which streams chunk-by-chunk. After initial verification, consider range requests for resumable downloads.

### Risk 3: SharedArrayBuffer requires COOP/COEP headers

`wasm_thread` requires `SharedArrayBuffer` which requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers.

**Mitigation**: Ensure `svelte.config.js` sets these headers in the dev server and production server.

### Risk 4: Large file uploads may timeout

The current upload flow loads the entire encrypted blob into memory before sending. For large files, this could cause memory issues.

**Mitigation**: After initial verification, consider streaming uploads via presigned URLs for large files.

---

## Notes

- The `UPLOAD_FILE_MUTATION` already uses `$file: Upload!` in the GraphQL definition — the schema is correct, only the transport layer (`HttpLink` → `createUploadLink`) needs fixing.
- The `download_file_stream` mutation that returned presigned URLs has been removed — the backend serves all files directly through `views.py`, users never access S3 directly.
- The WASM parallel encryption is already configured correctly with `wasm_thread` and the `parallel` feature enabled by default.
- All camelCase migration is complete — frontend interfaces, query modules, and components all use camelCase matching the Strawberry-Django schema.
