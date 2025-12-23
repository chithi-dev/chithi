import { LOGIN_URL } from '$lib/consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export function useAuth() {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: ['auth-user'],
		queryFn: async () => {
			const token = localStorage.getItem('auth_token');
			if (!token) return null;

			const res = await fetch(LOGIN_URL, {
				headers: { Authorization: `Bearer ${token}` }
			});

			if (res.status === 401) {
				localStorage.removeItem('auth_token');
				return null;
			}
			return res.json();
		},
		staleTime: Infinity,
		retry: false
	}));

	const login = (token: string) => {
		localStorage.setItem('auth_token', token);
		// Refresh the specific key
		queryClient.invalidateQueries({ queryKey: ['auth-user'] });
	};

	const logout = () => {
		localStorage.removeItem('auth_token');
		queryClient.setQueryData(['auth-user'], null);
		queryClient.clear();
	};

	return {
		user: query,
		login,
		logout
	};
}
