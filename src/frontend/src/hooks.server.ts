import type { Handle } from '@sveltejs/kit';

/**
 * SvelteKit server hooks.
 *
 * Runs on every server request (page loads, actions, server routes). Resolves
 * the signed-in session from the `access_token` HttpOnly cookie and attaches
 * it to `event.locals`, so server code has a single, always-populated
 * `locals.session` -- the canonical SvelteKit auth pattern (the cookie is
 * HttpOnly, so only the server can read it).
 *
 * The session is a minimal object: `{ token }` holds the raw JWT so downstream
 * server code (e.g. the Apollo prefetch bridge) can forward it as a Bearer
 * header. Server routes and `+page.server.ts` actions read
 * `event.locals.session` instead of re-reading the cookie.
 *
 * See https://svelte.dev/docs/kit/hooks
 */

const AUTH_COOKIE = 'access_token';

export const handle: Handle = async ({ event, resolve }) => {
	const token = event.cookies.get(AUTH_COOKIE);

	event.locals.session = token ? { token } : null;

	return resolve(event);
};
