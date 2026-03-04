import { ADMIN_USER_UPDATE_URL, USER_URL } from '#consts/backend';
import { browser } from '$app/environment';
import { login as loginRemote } from '$lib/remote/auth.remote';
import { user_store } from '$lib/store/user.svelte';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';
const { is_authenticated, authenticate, unauthenticate } = user_store();
const queryKey = ['auth-user'];

const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;

const fetchUser = async ({ fetch }: { fetch?: typeof globalThis.fetch }) => {
	if (!is_authenticated) return null;
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(USER_URL, {
		credentials: 'include'
	});

	if (!res.ok || res.status === 401) {
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
		if (!browser) return;
		try {
			await loginRemote({ username, password });
			authenticate();
			await queryClient.invalidateQueries({ queryKey });
		} catch (error: any) {
			unauthenticate();
			throw new Error(error?.message || 'Invalid username or password');
		}
	};

	const updateUser = async (data: { username?: string; email?: string | null }) => {
		if (!browser) return;
		const runtimeFetch = resolveFetch();

		const res = await runtimeFetch(ADMIN_USER_UPDATE_URL, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(data)
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.detail || 'Failed to update user');
		}

		await queryClient.invalidateQueries({ queryKey: queryKey });
		return res.json();
	};

	return {
		user: query,
		login,
		updateUser
	};
};
