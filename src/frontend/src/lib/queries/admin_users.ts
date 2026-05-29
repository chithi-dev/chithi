import { Api } from '#consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['admin-users'];

export const useUsersQuery = (page: () => number, size: number) => {
	const queryClient = useQueryClient();

	const users = createQuery(() => ({
		queryKey: [...queryKey, page()],
		queryFn: async () => {
			const res = await fetch(`${Api.ADMIN.USERS}?page=${page()}&size=${size}`, { credentials: 'include' });
			if (!res.ok) throw new Error('Failed to fetch users');
			return res.json();
		}
	}));

	const createUser = async (userIn: Record<string, unknown>) => {
		const res = await fetch(Api.ADMIN.USER_CREATE, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(userIn),
			credentials: 'include'
		});
		if (!res.ok) {
			const error = await res.json().catch(() => ({}));
			throw new Error(error.detail ?? 'Failed to create user');
		}
		queryClient.invalidateQueries({ queryKey });
		return res.json();
	};

	const deleteUser = async (userId: string) => {
		const res = await fetch(Api.ADMIN.USER_DELETE(userId), { credentials: 'include' });
		if (!res.ok) {
			const error = await res.json().catch(() => ({}));
			throw new Error(error.detail ?? 'Failed to delete user');
		}
		queryClient.invalidateQueries({ queryKey });
		return res.json();
	};

	return { users, createUser, deleteUser };
};
