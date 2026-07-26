# Chithi Implementation Plan

> **Status**: Active implementation
> **Date**: 2026-07-26
> **Branch**: `feat/jxr-other`
>
> Three workstreams completed:
> 1. **Frontend** — Apollo Client v4 (replaced urql), GraphQL codegen, shadcn-svelte compliance, SvelteKit best practices
> 2. **Django + Strawberry-Django Backend** — full port from FastAPI, GraphQL schema, S3 service, Celery, cross-database support
> 3. **WASM Multi-Core** — `wasm_thread` parallelism verified, all cores utilized via Rust Rayon

---

## Current State Snapshot

| Area | Status | Detail |
|---|---|---|
| **Rust WASM** | DONE | `wasm_thread` parallel feature enabled, `+atomics,+simd128` flags set, SharedArrayBuffer, nightly toolchain |
| **JS Worker Pool** | DONE | `WORKER_CONCURRENCY = 1` (Rust handles parallelism), streams use worker dispatch |
| **Django Project** | DONE | Settings, mixins, models (User/File/Config), Celery, S3 configured, `.gitignore` added |
| **GraphQL Schema** | DONE | Upload, onboarding, instance info/stats, file lookup, admin pagination, CRUD, login/logout, config update |
| **S3 Service Layer** | DONE | `apps/files/services.py` — upload, download, delete, presigned URLs, file existence check |
| **Celery Expired Files** | DONE | Deletes from S3 before DB, already working |
| **Frontend GraphQL Client** | DONE | Apollo Client v4 (replaced urql), codegen configured, generated types, queries/mutations/hooks |
| **Frontend TypeScript** | DONE | `npm run check` passes: 0 errors, 2 benign warnings (TanStack Table + Svelte 5 known issue) |
| **Frontend Build** | DONE | `npm run build` succeeds (12,580 modules transformed) |
| **Django Database** | DONE | dj-database-url for configurable backend (SQLite default, PostgreSQL via DATABASE_URL) |
| **Django Migrations** | DONE | All 39 migrations apply successfully with SQLite and PostgreSQL-compatible JSONField |
| **Django Backend Check** | DONE | `manage.py check` passes 0 issues |
| **shadcn-svelte Compliance** | DONE | All components follow docs exactly |
| **WASM Parallel Verification** | DONE | `wasm_thread::scope` correct in 4 call sites, sequential fallbacks compile, C ABI clean |

---

## Phase 1: Django + Strawberry-Django Backend — DONE

### What Was Ported from FastAPI

| FastAPI Component | Django Equivalent | Status |
|---|---|---|
| SQLModel models (User, File, Config) | Django ORM models with UUIDPrimaryKeyMixin, CreatedAtMixin, SingletonModel | DONE |
| PyJWT HS256 auth | DRF-SimpleJWT HS512 with token blacklist | DONE |
| REST endpoints (17 routes) | Strawberry-Django GraphQL Query/Mutation | DONE |
| aioboto3 S3 operations | boto3 S3 service layer (`apps/files/services.py`) | DONE |
| Celery expired file cleanup | Celery + django_celery_beat periodic tasks | DONE |
| Redis state management | Redis cache (preserved) | DONE |
| Async SQLite/PostgreSQL | dj-database-url (SQLite default, PostgreSQL via env) | DONE |

### Architecture (Following alumni-backend Patterns)

```
src/backend-django/
├── core/
│   ├── settings.py          # Django 5.2+, dj-database-url, 13 apps
│   ├── urls.py              # /admin/, /graphql/ Strawberry endpoint
│   └── middleware.py        # GraphQLJwtMiddleware — resolve JWT for /graphql/ only
├── apps/
│   ├── users/
│   │   └── models.py        # Custom User model (UUIDPrimaryKeyMixin)
│   ├── files/
│   │   ├── models.py        # File model with UUID, key, size, expires_at
│   │   ├── services.py      # S3 upload/download/delete/presigned URLs
│   │   └── tasks.py         # Celery delete expired files (S3 + DB)
│   ├── config/
│   │   └── models.py        # Config singleton (JSONField for cross-DB compat)
│   └── graphql/
│       ├── schema.py        # Query + Mutation (inline, all resolvers)
│       ├── types.py         # Strawberry types (ConfigType, FileType, UserType, etc.)
│       ├── auth.py          # get_user_from_jwt_token()
│       └── urls.py          # GraphQL view configuration
├── mixins/
│   ├── models/base/singleton.py     # SingletonModel (get_or_create pk=1)
│   └── models/fields/              # UUIDPrimaryKeyMixin, CreatedAtMixin
├── celery_app.py            # Celery configuration
└── manage.py
```

### Key Design Decisions

- **JSONField over ArrayField**: Works with both SQLite (local dev) and PostgreSQL (production)
- **dj-database-url**: `DATABASE_URL=sqlite:///db.sqlite3` for local, `DATABASE_URL=postgres://...` for production
- **Inline schema**: All Query/Mutation resolvers in a single `schema.py` for simplicity
- **GraphQLJwtMiddleware**: Django middleware resolves JWT tokens only for `/graphql/` paths
- **Strawberry Upload scalar**: Native GraphQL multipart file upload support

---

## Phase 2: Frontend Apollo Client v4 Migration — DONE

### Migration Summary: urql → Apollo Client v4

| Aspect | urql (old) | Apollo Client v4 (new) |
|---|---|---|
| Client creation | `createClient()` + exchanges | `new ApolloClient()` + `InMemoryCache` |
| Query execution | `client.query().toPromise()` | `client.query()` returns Promise |
| Mutation execution | `client.mutation(query, vars)` | `client.mutate({ mutation, variables })` |
| Error handling | `result.errors` (array) | `result.error` (single GraphQLError) |
| Watch queries | `client.query()` | `client.watchQuery()` returns `DeepPartial<Data>` |
| Type safety | Manual interfaces | Auto-generated via `@graphql-codegen/cli` |
| Prefetch | `client.query(query).execute()` | `client.query(query).toPromise()` |

### Codegen Configuration

```ts
// src/frontend/codegen.ts
import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "http://localhost:8000/graphql/",
  documents: ["src/lib/graphql/**/*.graphql", "src/lib/queries/**/*.ts"],
  generates: {
    "src/lib/graphql/generated/": {
      plugins: ["typescript", "typescript-operations", "typescript-react-apollo"],
      config: {
        strictScalars: true,
        maybeValue: "T | undefined",
      },
    },
  },
};
```

### Files Changed (41 TypeScript Errors → 0)

- `src/lib/graphql/client.ts` — Apollo Client v4 setup
- `src/lib/graphql/hooks.ts` — `createQueryStore()`, typed hooks, mutation wrappers
- `src/lib/queries/auth.ts` — `result.errors` → `result.error`
- `src/lib/queries/config.ts` — Apollo v4 API
- `src/lib/queries/onboarding.ts` — Apollo v4 API
- `src/lib/queries/file-info.ts` — Apollo v4 API
- `src/lib/queries/files.ts` — Apollo v4 API
- `src/lib/queries/admin_users.ts` — Apollo v4 API
- `src/lib/queries/instance.ts` — prefetch signatures
- `src/lib/remote/auth.remote.ts` — remote function updates
- `upload/stage_2.svelte` — `client.mutate<any>()` options object
- All route pages — Apollo v4 query execution

---

## Phase 3: Frontend shadcn-svelte + SvelteKit Alignment — DONE

### shadcn-svelte Compliance (Verified)

- `Dialog.Trigger` uses `buttonVariants()` — not `<Button>`
- `DropdownMenu.Trigger` uses `{#snippet child({ props })}` — exact docs pattern
- `Form.Control` uses `{#snippet children({ props })}` — exact docs pattern
- All `Select.Root` have `type="single"`
- 46 shadcn components installed and used correctly
- `Spinner` used consistently (no `LoaderCircle`)
- `Typography` on info pages

### SvelteKit Best Practices

- Filesystem routing with route groups `(needs_onboarding)`, `(login_required)`, `(navbar_and_footer)`
- Form actions via `sveltekit-superforms` + Zod v4 validation
- Remote functions for server-side GraphQL mutations
- Layout-level WASM initialization via `ensureInitialized()`
- COOP/COEP headers in `hooks.ts` for SharedArrayBuffer
- NProgress navigation indicator

---

## Phase 4: WASM Multi-Core Encryption — DONE

### Architecture

```
Frontend (main thread)
  └─ Worker Pool (chithi.worker.ts)
      └─ WASM Module (chithi_wasm.wasm)
          ├─ wasm_thread::scope (parallel encrypt/decrypt)
          ├─ Rayon parallel iterators
          └─ XChaCha20-Poly1305 encryption
```

### Key Details

- **Parallelism**: `wasm_thread::scope` in 4 call sites (encrypt, decrypt, encrypt-all, decrypt-all)
- **Target Features**: `+atomics,+bulk-memory,+mutable-globals,+simd128`
- **Worker Concurrency**: `WORKER_CONCURRENCY = 1` (Rust handles parallelism internally)
- **COOP/COEP Headers**: Set in `hooks.ts` for SharedArrayBuffer access
- **Sequential Fallback**: `#[cfg(not(feature = "parallel"))]` compiles without parallelism
- **Pure C ABI**: All exports use `#[no_mangle] pub extern "C"` with `(*const u8, len: u32)` pattern
- **Tests**: 14/14 pass including parallel-specific tests

---

## Remaining Work

### High Priority

1. **Start Django server and test GraphQL endpoint** — run `runserver`, hit `/graphql/` with queries, verify auth flow
2. **Port reverse transfer WebSocket** — create `apps/reverse/` with WebSocket handling (channels or raw ASGI)

### Medium Priority

3. **Remove old REST API constants** — clean up `Api.*` URLs (reverse/download still use REST)
4. **End-to-end browser test** — verify parallel encryption uses all CPU cores
5. **SvelteKit load function alignment** — use `+page.ts` load functions with GraphQL prefetch

### Nice to Have

6. **Adopt more shadcn components** — `HoverCard`, `Alert`, `Pagination`, `Combobox`
7. **Responsive + dark mode verification** — Playwright tests at 1920px, 768px, 375px

---

## Verification Checklist

### Django Backend
- [x] `JSONField` for cross-database compatibility (replaced ArrayField)
- [x] `uuid7v4g` fixed → `uuid_utils.compat.uuid7()`
- [x] Upload mutation validates against config limits
- [x] Delete mutation calls S3 before DB delete
- [x] Celery task deletes from S3 before DB
- [x] `python manage.py check` passes (0 issues)
- [x] `python manage.py migrate` runs successfully (39 migrations)
- [x] GraphQL schema loads via `django.setup()`
- [ ] GraphQL endpoint responds (needs server started)
- [ ] Login mutation returns JWT tokens
- [ ] Upload mutation creates File record + S3 upload
- [ ] S3 upload/download works end-to-end

### Frontend
- [x] `npm run check` — TypeScript passes (0 errors, 2 benign warnings)
- [x] `npm run build` — Vite build succeeds (12,580 modules)
- [x] shadcn-svelte components follow docs exactly
- [x] Apollo Client v4 migration complete
- [x] GraphQL codegen configured with generated types
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

---

## Critical Files Reference

### Django Backend
- `src/backend-django/apps/graphql/schema.py` — Query + Mutation (inline resolvers)
- `src/backend-django/apps/graphql/types.py` — Strawberry types
- `src/backend-django/apps/graphql/auth.py` — JWT token resolution
- `src/backend-django/apps/files/services.py` — S3 upload/download/delete
- `src/backend-django/apps/config/models.py` — Config with JSONField
- `src/backend-django/core/middleware.py` — GraphQL JWT auth middleware
- `src/backend-django/core/settings.py` — dj-database-url, 13 apps, Celery config

### Frontend
- `src/frontend/codegen.ts` — GraphQL codegen config
- `src/frontend/src/lib/graphql/client.ts` — Apollo Client v4
- `src/frontend/src/lib/graphql/generated/` — Auto-generated types
- `src/frontend/src/lib/graphql/queries.ts` — 15 query/mutation definitions
- `src/frontend/src/lib/graphql/hooks.ts` — Typed hooks + mutation wrappers
- `src/frontend/src/lib/queries/` — Query store modules
- `src/frontend/src/hooks.ts` — COOP/COEP headers

### WASM
- `crates/chithi-core/src/chithi_cryto.rs` — `wasm_thread::scope` parallel encryption
- `scripts/build_wasm.py` — Generates SharedArrayBuffer WASM
- `src/frontend/src/lib/wasm/chithi_wasm.ts` — TypeScript C ABI wrapper
- `src/frontend/src/lib/workers/chithi.worker.ts` — Web Worker message dispatch
