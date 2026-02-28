import { ADMIN_USER_UPDATE_URL, USER_URL } from '#consts/backend';
import { browser } from '$app/environment';
import { user_store } from '$lib/store/user.svelte';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';
const { is_authenticated } = user_store();
const queryKey = ['auth-user'];

const fetchUser = async ({
	fetch = globalThis.window.fetch
}: {
	fetch?: typeof globalThis.window.fetch;
}) => {
	if (!is_authenticated) return null;
	const res = await fetch(USER_URL, {
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
	const updateUser = async (data: { username?: string; email?: string | null }) => {
		if (!browser) return;

		const res = await fetch(ADMIN_USER_UPDATE_URL, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json'
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

	return {
		user: query,
		updateUser
	};
};
