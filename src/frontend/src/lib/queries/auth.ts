import { ADMIN_USER_UPDATE_URL, LOGIN_URL, USER_URL } from '#consts/backend';
import { browser } from '$app/environment';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['auth-user'];

const fetchUser = async ({
	fetch = globalThis.window.fetch
}: {
	fetch?: typeof globalThis.window.fetch;
}) => {
	if (!browser) return null;
	const token = localStorage.getItem('auth_token');
	if (!token) return null;

	const res = await fetch(USER_URL, {
		headers: { Authorization: `Bearer ${token}` }
	});

	if (!res.ok || res.status === 401) {
		localStorage.removeItem('auth_token');
		return null;
	}
	return res.json();
};

export const prefetch = async ({ queryClient, fetch }: { queryClient: any; fetch: any }) => {
	await queryClient.prefetchQuery({
		queryKey: queryKey,
		queryFn: () => fetchUser({ fetch }),
		staleTime: Infinity,
		retry: false
	});
};

export const useAuth = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: queryKey,
		queryFn: () => fetchUser({}),
		staleTime: Infinity,
		retry: false
	}));

	const login = async (username: string, password: string) => {
		// Build form data using FormData (let the browser set Content-Type)
		const form = new FormData();
		form.append('username', username);
		form.append('password', password);

		const res = await fetch(LOGIN_URL, {
			method: 'POST',
			body: form
		});

		if (!res.ok) {
			throw new Error('Invalid username or password');
		}

		const data = await res.json();
		const token = data.access_token;
		if (browser && token) {
			localStorage.setItem('auth_token', token);
		}
		await queryClient.invalidateQueries({ queryKey: queryKey });

		return token;
	};

	const logout = () => {
		if (!browser) return null;
		if (!localStorage.getItem('auth_token')) {
			throw new Error('Not authenticated');
		}
		localStorage.removeItem('auth_token');
		queryClient.setQueryData(queryKey, null);
		queryClient.clear();
	};

	const updateUser = async (data: { username?: string; email?: string | null }) => {
		if (!browser) return;
		const token = localStorage.getItem('auth_token');
		if (!token) throw new Error('Not authenticated');

		const res = await fetch(ADMIN_USER_UPDATE_URL, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify(data)
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.detail || 'Failed to update user');
		}

		await queryClient.invalidateQueries({ queryKey: queryKey });
		return res.json();
	};

	const isAuthenticated = () => {
		if (!browser) return false;
		return !!localStorage.getItem('auth_token');
	};

	return {
		user: query,
		login,
		logout,
		updateUser,
		isAuthenticated
	};
};
