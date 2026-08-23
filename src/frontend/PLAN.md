# Svelte Frontend Improvement Plan

> **Date**: 2026-07-31
> **Branch**: `feat/jxr-other`
> **Source**: Comprehensive codebase exploration + static analysis

---

## Quick Wins (Low Risk, High Impact)

### 1. Remove duplicate `vite.config.js`

**Problem**: Both `vite.config.js` and `vite.config.ts` exist. Vite loads whichever it finds first, creating unpredictable behavior. The `.js` file is a minimal stale version.

**Action**: Delete `vite.config.js`, merge `optimizeDeps.exclude` into `vite.config.ts`.

**Status**: TODO

### 2. Remove unused npm dependencies

**Problem**: Several packages are installed but never imported:

| Package | Type | Reason |
|---------|------|--------|
| `urql` | runtime | Leftover from GraphQL client migration, Apollo is used instead |
| `takumi-js` | runtime | No imports found |
| `superforms` | runtime | No imports found |
| `sveltekit-superforms` | dev | No imports found |
| `wabt` | dev | No imports found |
| `bowser` | dev | No imports found |
| `hash-wasm` | dev | No imports found |
| `caniuse-lite` | dev | No imports found |
| `@internationalized/date` | dev | No imports found |
| `@testing-library/svelte` | dev | No test files import it |

**Action**: Run `npm uninstall` on each, verify `npm run check` and `npm run build` still pass.

**Status**: TODO

### 3. Move `graphql` to devDependencies

**Problem**: `graphql` v17 is in `dependencies` but only imported for the `DocumentNode` type in `hooks.ts` — a build-time need.

**Action**: `npm move graphql --dev`

**Status**: TODO

### 4. Replace remaining `onMount` with `$effect.pre`

**Problem**: `upload/+page.svelte` uses `onMount` from legacy Svelte for `window.history.pushState`. Everything else uses Svelte 5 runes.

**Action**: Replace with `$effect.pre`.

**Status**: TODO

### 5. Add user-facing error toasts where only `console.error` exists

**Problem**: Several catch blocks log to console but don't inform the user:
- `once/[slug]/+page.svelte` — `console.error(e)` with no toast
- `view/[slug]/+page.svelte` — `console.error(e)` with no toast
- `download/[slug]/+page.svelte` — `console.error(e)` with no toast

**Action**: Add `toast.error()` calls from `svelte-sonner` in these catch blocks.

**Status**: TODO

---

## Medium Priority

### 6. Fix module-level Apollo subscription in `auth.ts`

**Problem**: `lib/queries/auth.ts` creates a `watchQuery` at module load time — it starts even when no component uses it and never cleans up. Memory leak risk.

**Action**: Move the subscription into the `useAuth` hook or a component that calls it, with proper `$effect` cleanup.

**Status**: TODO

### 7. Add keyboard accessibility to clickable `Card.Root` elements

**Problem**: Home page cards and reverse share cards use `onclick` on `Card.Root` without `role="button"` or `tabindex`, making them unreachable via keyboard.

**Action**: Add `role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && ...}` or replace with `<Button>` wrappers.

**Status**: TODO

### 8. Consolidate TanStack Query or remove it

**Problem**: TanStack Query is set up (`QueryClientProvider`, devtools) but underutilized — most data fetching uses custom Apollo `watchQuery` wrappers. This is either redundant or an incomplete migration.

**Decision needed**: Either migrate Apollo queries to TanStack Query hooks, or remove TanStack Query entirely.

**Status**: TODO (decision required)

---

## Nice-to-Have

### 9. Add loading states to GraphQL queries

**Problem**: The custom `watchQuery` hooks in `graphql/hooks.ts` return `{ data, loading, error }` but some components don't render loading skeletons.

**Action**: Add `Skeleton` components from shadcn-svelte where queries can take >500ms.

**Status**: TODO

### 10. Add error boundaries per route group

**Problem**: The global `+error.svelte` handles all errors generically. A failure in one route group shouldn't break the entire app.

**Action**: Add `+error.svelte` in `(needs_onboarding)` and `(navbar_and_footer)` route groups.

**Status**: TODO

### 11. Migrate reverse room queries to GraphQL

**Problem**: `lib/queries/reverse.ts` uses raw `fetch()` calls with a TODO to migrate to GraphQL.

**Action**: Create GraphQL mutations/queries for reverse room operations. Depends on Django backend having reverse room models.

**Status**: DEFER (backend dependency)

---

## Verification Checklist

- [ ] `vite.config.js` removed, `vite.config.ts` has all settings
- [ ] Unused dependencies removed, `npm install` is cleaner
- [ ] `graphql` moved to devDependencies
- [ ] `onMount` replaced with `$effect.pre`
- [ ] Error toasts added to `once/`, `view/`, `download/` pages
- [ ] Module-level Apollo subscription moved into a hook
- [ ] Clickable cards have keyboard accessibility
- [ ] TanStack Query decision made (keep or remove)
- [ ] `npm run check` passes (0 errors)
- [ ] `npm run build` succeeds
- [ ] Playwright visual verification — no regressions
