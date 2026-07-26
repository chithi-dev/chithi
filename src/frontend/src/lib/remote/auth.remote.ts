import { Api } from '#consts/backend';
import { command, getRequestEvent } from '$app/server';
import { LOGIN_MUTATION, LOGOUT_MUTATION } from '$lib/graphql/queries.js';
import { user_store } from '$lib/store/user.svelte';
import { z } from 'zod';

const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1)
});

const GRAPHQL_URL = `${Api.BASE}/graphql/`;

export const login = command(loginSchema, async ({ username, password }) => {
	const { fetch, cookies, url } = getRequestEvent();

	const res = await fetch(GRAPHQL_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({
			query: LOGIN_MUTATION,
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
});

export const logout = command(async () => {
	const { fetch, cookies } = getRequestEvent();

	cookies.delete('access_token', { path: '/' });

	try {
		await fetch(GRAPHQL_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				query: LOGOUT_MUTATION
			})
		});
	} catch {
		// Best-effort server-side logout; cookie is already cleared.
	}

	user_store.unauthenticate();
	return { success: true };
});
