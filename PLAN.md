# Chithi Implementation Plan

> **Status**: Active — chunked S3 + Web Crypto rewrite complete, CLI rewrite pending
> **Date**: 2026-10-04
> **Branch**: `feat/jxr-other`
>
> **Current architecture** (post-rewrite):
> - **Backend**: Django + Strawberry GraphQL + aioboto3 (S3) — runs on port 8001
> - **Frontend**: SvelteKit 2 + Svelte 5 + Apollo Client 4 + fflate — uploads 50 MB chunks to S3 via Django, downloads chunks directly from S3 (presigned URLs, behind Cloudflare)
> - **CLI**: Python — pending rewrite to pure Python (remove wasmtime/Rust bridge)
> - **Crypto**: Web Crypto API only — HKDF-SHA-256 + PBKDF2-SHA-256 + AES-128-GCM ECE (RFC 8188), 64 KiB records
> - **Removed**: Rust crates, WASM SDKs, WebSockets, reverse-share
>
> **Current focus**: CLI crypto rewrite in pure Python, then end-to-end verification.

---

## Current State Snapshot

| Area | Status | Detail |
|---|---|---|
| **Rust WASM** | REMOVED | Rust crates deleted; replaced with pure Web Crypto API |
| **Web Crypto Streams** | DONE | `streams.ts` — HKDF + AES-128-GCM ECE, worker-based, 64 KiB records |
| **Django Project** | DONE | Settings, models, Celery, S3 configured (port 8001) |
| **GraphQL Schema** | DONE | Chunked upload/download mutations (registerFile, uploadFileChunk, completeUpload, chunkUrl) |
| **S3 Service Layer** | DONE | `apps/files/services.py` — chunked upload, presigned download URLs |
| **Celery Expired Files** | DONE | Periodic task via django_celery_beat |
| **Frontend GraphQL Client** | DONE | Apollo Client v4, codegen, generated types, apollo-upload-client |
| **Frontend TypeScript** | DONE | Download-flow files type-clean; remaining 38 errors in pre-existing admin/reverse files (out of scope) |
| **Frontend Build** | DONE | `npm run build` passes |
| **Django Migrations** | DONE | SQLite + PostgreSQL compatible |
| **Frontend camelCase Migration** | DONE | All GraphQL interfaces, query modules, and Svelte components migrated |
| **shadcn-svelte Compliance** | DONE | 46 components, docs-exact patterns |
| **Chunked Upload (50 MB)** | DONE | `upload.ts` — registerFile → uploadFileChunk loop → completeUpload |
| **Chunked Download (50 MB)** | DONE | `download.ts` — fileInfo → chunkUrl loop → reassemble → decrypt |
| **WebSocket Removal** | PARTIAL | WebSockets removed from backend; `upload/state.svelte.ts` still references `Api.STATE_WS` (404, non-fatal) |
| **CLI Rewrite** | TODO | Rewrite `src/cli/app/helpers/crypto.py` in pure Python (HKDF + AES-128-GCM ECE); remove wasmtime |
| **Crypto Docs** | TODO | Update `apps/docs/crypto-architecture.md` to reflect new Web Crypto + chunked S3 model |
| **E2E Verification** | TODO | Full upload→download round-trip with a real file via Playwright |

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

## Phase 5: CLI Rewrite — Pure Python Crypto

### 5.1 Rewrite `crypto.py` using `cryptography` library

Replace the wasmtime/Rust bridge with pure Python using the `cryptography` package:

```python
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
```

**Scheme** (must match `streams.ts` exactly):
- **IKM resolution**: `resolveIkM(ikm, password)` → HKDF-SHA256 extract from IKM, or PBKDF2-SHA256 if only password
- **File key**: HKDF-SHA256 expand with salt (16 bytes) → AES-128 key
- **ECE records**: AES-128-GCM, 64 KiB plaintext per record, nonce = nonceBase XOR seq (last 4 bytes BE)
- **nonceBase**: SHA-256(file_key)[0:12]
- **Wire format**: `[16B salt][4B record_size BE][record_0][record_1]...`

**Files**:
- `src/cli/app/helpers/crypto.py` — full rewrite
- `src/cli/requirements.txt` — add `cryptography`, remove wasmtime
- `src/cli/app/helpers/chithi_core_bridge.py` — DELETE (wasmtime bridge, no longer needed)

**Status**: TODO

### 5.2 Update CLI upload/download to use 50 MB chunks

Align CLI chunk size with backend's `CHUNK_SIZE_BYTES` (50 MB). CLI uploads chunks via GraphQL `uploadFileChunk` mutation, downloads via presigned `chunkUrl`.

**Status**: TODO

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
