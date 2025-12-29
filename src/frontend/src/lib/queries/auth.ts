import { browser } from '$app/environment';
import { LOGIN_URL, USER_URL } from '$lib/consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export function useAuth() {
	const queryClient = useQueryClient();

	const query = createQuery(() => ({
		queryKey: ['auth-user'],
		queryFn: async () => {
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
		},
		staleTime: Infinity,
		retry: false
	}));

	const login = async (username: string, password: string) => {
		// Build form data
		const body = new URLSearchParams();
		body.append('username', username);
		body.append('password', password);

		const res = await fetch(LOGIN_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded'
			},
			body
		});

		if (!res.ok) {
			throw new Error('Invalid username or password');
		}

		const data = await res.json();
		const token = data.access_token;
		if (browser && token) {
			localStorage.setItem('auth_token', token);
		}

		return token;
	};

	const logout = () => {
		if (browser) {
			localStorage.removeItem('auth_token');
		}
		queryClient.setQueryData(['auth-user'], null);
		queryClient.clear();
	};
	const isAuthenticated = () => {
		if (!browser) return false;
		return !!localStorage.getItem('auth_token');
	};

	return {
		user: query,
		login,
		logout,
		isAuthenticated
	};
}
