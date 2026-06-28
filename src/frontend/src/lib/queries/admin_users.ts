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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: usersQueryKey });

  const createUser = async (user_in: { username: string; email?: string | null; password?: string }) => {
    const res = await fetch(Api.ADMIN.USER_CREATE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(user_in),
      credentials: 'include'
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to create user');
    }

    invalidate();
    return res.json();
  };

  const deleteUser = async (user_id: string) => {
    const res = await fetch(Api.ADMIN.USER_DELETE(user_id), {
      method: 'DELETE',
      credentials: 'include'
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete user');
    }

    invalidate();
    return res.json();
  };

  return { users, createUser, deleteUser };
};
