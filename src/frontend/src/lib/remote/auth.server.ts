import { getRequestEvent } from '$app/server';
import { Api } from '#consts/backend';
import { LoginDocument, LogoutDocument } from '$lib/graphql/generated/graphql.js';
import { z } from 'zod';

/**
 * Server-only auth helpers.
 *
 * These run in the SvelteKit server (actions in `+page.server.ts` /
 * `+server.ts`), never in the browser. They read the `getRequestEvent()`
 * context to reach the current request's cookies, so they must be invoked
 * from a server-side handler.
 */

const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1)
});

const GRAPHQL_URL = `${Api.BASE}/graphql/`;

export async function login({ username, password }: { username: string; password: string }) {
	const { fetch, cookies, url } = getRequestEvent();

	const parsed = loginSchema.safeParse({ username, password });
	if (!parsed.success) {
		throw new Error('Invalid username or password');
	}

	const res = await fetch(GRAPHQL_URL, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			query: LoginDocument,
			variables: { username, password }
		})
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		const message = err?.errors?.[0]?.message || err?.detail || 'Invalid username or password';
		throw new Error(message);
	}

	const data = await res.json().catch(() => ({}));
	const token = data?.data?.login?.access;
	if (!token) {
		throw new Error('Failed to login');
	}

	const secure = url.protocol === 'https:';
	cookies.set('access_token', token, {
		httpOnly: true,
		secure,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24
	});

	return { success: true };
}

export async function logout() {
	const { fetch, cookies } = getRequestEvent();

	cookies.delete('access_token', { path: '/' });

	try {
		await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ query: LogoutDocument })
		});
	} catch {
		// Best-effort server-side logout; cookie is already cleared.
	}

	return { success: true };
}
