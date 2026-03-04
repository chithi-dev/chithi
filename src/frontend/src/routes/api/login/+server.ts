import { LOGIN_URL } from '#consts/backend';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, fetch, cookies, url }) => {
	const form = await request.formData();

	const res = await fetch(LOGIN_URL, {
		method: 'POST',
		body: form
	});

	if (!res.ok) {
		const err = await res.json().catch(() => ({}));
		const message = err?.detail || 'Invalid username or password';
		return json({ message }, { status: res.status });
	}

	const data = await res.json().catch(() => ({}));
	const token = data?.access_token;
	if (!token) {
		return json({ message: 'Failed to login' }, { status: 500 });
	}

	const secure = url.protocol === 'https:';
	cookies.set('access_token', token, {
		httpOnly: true,
		secure,
		sameSite: 'lax',
		path: '/',
		maxAge: 60 * 60 * 24
	});

	return json({ success: true });
};
