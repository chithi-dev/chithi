import { Api } from '#consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export const usersQueryKey = ['admin-users'];

export const useUsersQuery = (page: () => number, size: number) => {
	const queryClient = useQueryClient();

	const users = createQuery(() => ({
		queryKey: [...usersQueryKey, page()],
		queryFn: async () => {
			const res = await fetch(`${Api.ADMIN.USERS}?page=${page()}&size=${size}`, {
				credentials: 'include'
			});

			if (!res.ok) {
				throw new Error('Failed to fetch users');
			}

			return res.json();
		}
	}));

	const createUser = async (user_in: any) => {
		const res = await fetch(Api.ADMIN.USER_CREATE, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(user_in),
			credentials: 'include'
		});

		if (!res.ok) {
			const error = await res.json().catch(() => ({}));
			throw new Error(error.detail || 'Failed to create user');
		}

		const data = await res.json();
		queryClient.invalidateQueries({ queryKey: usersQueryKey });
		return data;
	};

	const deleteUser = async (user_id: string) => {
		const res = await fetch(Api.ADMIN.USER_DELETE(user_id), {
			method: 'DELETE',
			credentials: 'include'
		});

		if (!res.ok) {
			const error = await res.json().catch(() => ({}));
			throw new Error(error.detail || 'Failed to delete user');
		}

		const data = await res.json();
		queryClient.invalidateQueries({ queryKey: usersQueryKey });
		return data;
	};

	return { users, createUser, deleteUser };
};
