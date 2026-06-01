import { Api } from '#consts/backend';
import { createQuery, type QueryClient, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['onboarding-status'];

import { resolveFetch } from './fetch-utils';

const fetchOnboarding = async ({ fetch }: { fetch?: typeof globalThis.fetch }) => {
	const runtimeFetch = resolveFetch(fetch);
	const res = await runtimeFetch(Api.ONBOARDING, { credentials: 'include' });
	if (!res.ok) {
		throw new Error('Failed to fetch onboarding status');
	}
	return res.json() as Promise<{ onboarded: boolean }>;
};

export const prefetch = async ({
	queryClient,
	fetch
}: {
	queryClient: QueryClient;
	fetch?: typeof globalThis.fetch;
}) => {
	await queryClient.prefetchQuery({
		queryKey: queryKey,
		queryFn: () => fetchOnboarding({ fetch }),
		staleTime: Infinity,
		retry: false
	});
};

export const useOnboarding = () => {
	const queryClient = useQueryClient();

	const status = createQuery(() => ({
		queryKey: queryKey,
		queryFn: () => fetchOnboarding({}),
		retry: false
	}));

	const completeOnboarding = async (user: {
		username: string;
		email: string;
		password: string;
	}) => {
		const res = await fetch(Api.ONBOARDING, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			credentials: 'include',
			body: JSON.stringify(user)
		});

		if (!res.ok) {
			const err = await res.json();
			throw new Error(err.detail || 'Failed to complete onboarding');
		}

		await queryClient.invalidateQueries({ queryKey: queryKey });
		return res.json();
	};

	return {
		status,
		completeOnboarding
	};
};
