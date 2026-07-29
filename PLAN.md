# Chithi Implementation Plan

> **Status**: Active implementation — wiring frontend ↔ Django GraphQL backend, fixing critical gaps
> **Date**: 2026-07-28
> **Branch**: `feat/jxr-other`
>
> Three workstreams completed previously:
> 1. **Frontend** — Apollo Client v4, GraphQL codegen, shadcn-svelte compliance, camelCase migration
> 2. **Django + Strawberry-Django Backend** — full port from FastAPI, GraphQL schema, S3, Celery
> 3. **WASM Multi-Core** — `wasm_thread` parallelism, XChaCha20-Poly1305, all cores utilized
>
> **Current focus**: Fix critical integration gaps, add missing mutations, wire file uploads/downloads, verify end-to-end.

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
| **Frontend TypeScript** | DONE | `npm run check` passes, 0 errors |
| **Frontend Build** | DONE | `npm run build` succeeds |
| **Django Migrations** | DONE | 39 migrations, SQLite + PostgreSQL compatible |
| **Frontend camelCase Migration** | DONE | All GraphQL interfaces, query modules, and Svelte components migrated |
| **shadcn-svelte Compliance** | DONE | 46 components, docs-exact patterns |
| **WASM Parallel Verification** | DONE | 4 parallel call sites, 14/14 tests pass |
| **Logout Mutation** | DONE | Added `logout` mutation returning `Boolean` |
| **Backend URL** | DONE | Updated to `localhost:8002` |

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

## Phase 2: Fix Download Flow — Migrate to Presigned URL

### 2.1 Update `fetch-decrypt.ts` to use presigned URL via GraphQL

**Problem**: The frontend downloads from `Api.DOWNLOAD(slug)` which is a REST endpoint (`/download/{slug}/`). The Django backend has a `download_file_stream` GraphQL mutation that returns a presigned S3 URL. We need to migrate the download flow.

**File**: `src/frontend/src/lib/functions/fetch-decrypt.ts`

**Current flow**:
```
frontend → /download/{slug}/ (REST) → Django streams S3 → frontend decrypts
```

**New flow**:
```
frontend → downloadFileStream(fileKey: slug) (GraphQL) → returns presigned URL → frontend fetches from S3 → frontend decrypts
```

**Implementation**:

```ts
import { client } from '$lib/graphql/client.js';
import { PasswordRequiredError } from '#errors/password';
import { createDecryptedStream } from '#functions/streams';

export interface FetchDecryptOptions { knownSize?: number; onProgress?: (percent: number) => void }

export async function fetchDecryptedBlob(slug: string, key: string, password: string, opts: FetchDecryptOptions = {}): Promise<Blob> {
  // Step 1: Get presigned URL via GraphQL
  const { data } = await client.mutate({
    mutation: gql`mutation DownloadFileStream($fileKey: String!) { downloadFileStream(fileKey: $fileKey) }`,
    variables: { fileKey: slug }
  });

  const presignedUrl = data.downloadFileStream;

  // Step 2: Fetch encrypted data from presigned URL
  const res = await fetch(presignedUrl);
  if (!res.ok) throw new Error(res.status === 404 ? 'File not found' : 'Download failed');
  if (!res.body) throw new Error('No response body');

  const total = opts.knownSize ?? parseInt(res.headers.get('content-length') ?? '0', 10);
  const src = opts.onProgress && total > 0 ? wrapProgress(res.body, total, opts.onProgress) : res.body;
  const stream = await createDecryptedStream(src, key, password);

  const reader = stream.getReader();
  let first: Uint8Array | undefined;
  try {
    const { done, value } = await reader.read();
    if (!done) first = value;
  } catch (e: any) {
    if (e.name === 'OperationError') { await reader.cancel('Wrong password'); throw new PasswordRequiredError(); }
    throw e;
  }

  const chunks: BlobPart[] = [];
  if (first) chunks.push(first as BlobPart);
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value as BlobPart); }
  const blob = new Blob(chunks, { type: 'application/zip' });
  if (chunks.length === 0 || blob.size < 4) throw new Error('Decryption produced no output data');
  return blob;
}
```

**Status**: TODO

### 2.2 Remove `Api.DOWNLOAD` REST endpoint dependency

After Phase 2.1, the `Api.DOWNLOAD` endpoint is no longer needed for downloads. The frontend will exclusively use the presigned URL flow. Keep the REST endpoint as a fallback for now, mark for removal after verification.

**Status**: TODO (after verification)

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

## Phase 5: WASM Multi-Core Verification

### 5.1 Verify `wasm_thread` parallelism is enabled

**Files**:
- `crates/chithi-core/Cargo.toml` — `parallel` feature is default ✓
- `crates/wasm_bindings/Cargo.toml` — inherits default features ✓
- `src/frontend/src/lib/wasm/chithi_wasm.ts` — calls `wasmEncryptChunksParallel` ✓

The Rust `encrypt_chunks_parallel` uses `wasm_thread::scope()` to spawn parallel threads per chunk. The `parallel` feature is enabled by default in `chithi-core`.

**Status**: VERIFIED

### 5.2 Verify WASM is compiled with `+atomics,+simd128`

**File**: `src/frontend/src/lib/wasm/chithi_wasm.ts` and build script

The WASM module must be compiled with `+atomics,+simd128` for `wasm_thread` to work. Check the build script.

**Status**: VERIFY

### 5.3 Verify SharedArrayBuffer is available

The frontend must serve with correct COOP/COEP headers for `SharedArrayBuffer` (required by `wasm_thread`). Check `svelte.config.js` for headers.

**Status**: VERIFY

---

## Phase 6: Add WebSocket Support to Django (Upload State)

### 6.1 Install and configure Django Channels

Add `channels` to `INSTALLED_APPS`, configure `ASGI_APPLICATION`, add WebSocket routing.

### 6.2 Create upload state consumer

Port the WebSocket state broadcasting from FastAPI to Django Channels, preserving Redis pub/sub for state sync.

**Status**: DEFER (after Phase 3 verification)

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
- [ ] `fetch-decrypt.ts` migrated to presigned URL flow
- [ ] `downloadFileStream` mutation returns presigned URL
- [ ] End-to-end: fetch presigned URL → download → decrypt → save

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

### Risk 2: Presigned URL CORS

S3 presigned URLs may fail due to CORS if the S3 endpoint (MinIO) doesn't allow cross-origin requests from the frontend origin.

**Mitigation**: Configure MinIO CORS policy to allow `GET` from `http://localhost:5173` (dev) and production origins.

### Risk 3: SharedArrayBuffer requires COOP/COEP headers

`wasm_thread` requires `SharedArrayBuffer` which requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers.

**Mitigation**: Ensure `svelte.config.js` sets these headers in the dev server and production server.

### Risk 4: Large file uploads may timeout

The current upload flow loads the entire encrypted blob into memory before sending. For large files, this could cause memory issues.

**Mitigation**: After initial verification, consider streaming uploads via presigned URLs for large files.

---

## Notes

- The `UPLOAD_FILE_MUTATION` already uses `$file: Upload!` in the GraphQL definition — the schema is correct, only the transport layer (`HttpLink` → `createUploadLink`) needs fixing.
- The `download_file_stream` mutation already exists and returns a presigned URL — the frontend just needs to call it.
- The WASM parallel encryption is already configured correctly with `wasm_thread` and the `parallel` feature enabled by default.
- All camelCase migration is complete — frontend interfaces, query modules, and components all use camelCase matching the Strawberry-Django schema.
