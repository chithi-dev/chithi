import { Api } from '#consts/backend';
import { browser } from '$app/environment';
import { login as loginRemote, logout as logoutRemote } from '$lib/remote/auth.remote';
import { user_store } from '$lib/store/user.svelte';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export const queryKey = ['auth-user'];

const resolveFetch = (fetch?: typeof globalThis.fetch) => fetch ?? globalThis.fetch;

const fetchUser = async ({ fetch }: { fetch?: typeof globalThis.fetch }) => {
	if (browser && user_store.is_authenticated === false) return null;

	let runtimeFetch: typeof globalThis.fetch | null = null;
	try {
		runtimeFetch = resolveFetch(fetch);
	} catch {
		await logoutRemote();
		return null;
	}

	const res = await runtimeFetch(Api.USER, {
		credentials: 'include'
	});

	if (!res.ok || res.status === 401) {
		if (browser) user_store.unauthenticate();
		return null;
	}

	const data = await res.json();
	if (browser) user_store.authenticate();
	return data;
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
			user_store.authenticate();
			await queryClient.invalidateQueries({ queryKey });
		} catch (error: any) {
			user_store.unauthenticate();
			throw new Error(error?.message || 'Invalid username or password');
		}
	};

	const updateUser = async (data: { username?: string; email?: string | null }) => {
		if (!browser) return;
		const runtimeFetch = resolveFetch();

		const res = await runtimeFetch(Api.ADMIN.USER_UPDATE, {
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
