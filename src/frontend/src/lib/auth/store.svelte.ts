/**
 * Auth store - Svelte 5 runes.
 *
 * The JWT lives in an HttpOnly cookie set by the SvelteKit server at login.
 * The browser can not read the cookie directly. The session flows through
 * SvelteKit's standard page-data channel:
 *
 *   1. `hooks.server.ts` resolves the session from the `access_token` cookie
 *      into `event.locals.session` on every server request.
 *   2. `+layout.server.ts` returns `{ session: locals.session }` as page data.
 *   3. `+layout.svelte` hydrates this store from `$page.data.session` in an
 *      `$effect`, so the store always tracks the server-resolved session.
 *
 * The Apollo client calls `getAuthToken()` to read the raw JWT and sends it
 * as an `Authorization: Bearer` header on every request. WebSocket
 * connections call `getWsToken()` and pass it as a `?token=` query param.
 *
 * After a mutation that changes the session (login, logout), the caller
 * invokes `invalidate('session')` to re-run the layout `load()` on the
 * server; the resulting page-data update re-fires the layout `$effect` and
 * re-hydrates the store.
 */

let authenticated = $state(false);
let token = $state<string | null>(null);

/**
 * Set store state from a server-resolved session. Called by the root
 * layout `$effect` whenever `$page.data.session` changes.
 */
export function hydrate(session: { token: string } | null): void {
	authenticated = session !== null;
	token = session?.token ?? null;
}

function reset(): void {
	authenticated = false;
	token = null;
}

/** Whether a signed-in session is active. */
export function isAuthenticated(): boolean {
	return authenticated;
}

/** The raw JWT, or null when signed out. Sent as a Bearer header. */
export function getAuthToken(): string | null {
	return token;
}

/**
 * The raw JWT for WebSocket `?token=` query param auth, or null.
 * WS connections cannot carry cookies cross-origin, so the token rides
 * in the query string.
 */
export function getWsToken(): string | null {
	return token;
}

/**
 * Reset local state after logout. Call `invalidate('session')` after this
 * so the server re-resolves (signed-out) and the layout `$effect` re-hydrates.
 */
export function clear(): void {
	reset();
}
