import { Api } from '#consts/backend';
import { browser } from '$app/environment';
import { login as loginRemote, logout as logoutRemote } from '$lib/remote/auth.remote';
import { user_store } from '$lib/store/user.svelte';
import type { QueryClient } from '@tanstack/svelte-query';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export const queryKey = ['auth-user'];

const fetchUser = async (fn = globalThis.fetch) => {
	if (browser && user_store.is_authenticated === false) return null;
	const res = await fn(Api.USER, { credentials: 'include' });
	if (!res.ok || [401, 403].includes(res.status)) {
		if (browser) user_store.unauthenticate();
		await logoutRemote();
		return null;
	}
	if (browser) user_store.authenticate();
	return res.json();
};

export const prefetch = async ({ queryClient, fetch }: { queryClient: QueryClient; fetch?: typeof globalThis.fetch }) => {
	await queryClient.prefetchQuery({
		queryKey,
		queryFn: () => fetchUser(fetch),
		staleTime: Infinity,
		retry: false
	});
};

export const useAuth = () => {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey,
		queryFn: () => fetchUser(),
		staleTime: Infinity,
		retry: false
	}));

	const login = async (username: string, password: string) => {
		if (!browser) return;
		try {
			await loginRemote({ username, password });
			user_store.authenticate();
			await queryClient.invalidateQueries({ queryKey });
		} catch (error) {
			user_store.unauthenticate();
			throw new Error(error instanceof Error ? error.message : 'Invalid username or password');
		}
	};

	const updateUser = async (data: { username?: string; email?: string | null }) => {
		if (!browser) return;
		const res = await globalThis.fetch(Api.ADMIN.USER_UPDATE, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(data)
		});
		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.detail ?? 'Failed to update user');
		}
		await queryClient.invalidateQueries({ queryKey });
		return res.json();
	};

	return { user: query, login, updateUser };
};
