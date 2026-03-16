import { LOGIN_URL } from '#consts/backend';
import { command, getRequestEvent } from '$app/server';
import { user_store } from '$lib/store/user.svelte';
import { z } from 'zod';

const loginSchema = z.object({
	username: z.string().min(1),
	password: z.string().min(1)
});

export const login = command(loginSchema, async ({ username, password }) => {
	const { fetch, cookies, url } = getRequestEvent();

	const form = new FormData();
	form.append('username', username);
	form.append('password', password);

	const res = await fetch(LOGIN_URL, {
		method: 'POST',
		body: form
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		throw new Error(err?.detail || 'Invalid username or password');
	}

	const data = await res.json().catch(() => ({}));
	const token = data?.access_token;
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
	const { cookies } = getRequestEvent();
	cookies.delete('access_token', { path: '/' });
	user_store.unauthenticate();
	return { success: true };
});
