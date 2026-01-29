import { ONBOARDING_URL } from '$lib/consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

const queryKey = ['onboarding-status'];

const fetchOnboarding = async ({
	fetch = globalThis.window.fetch
}: {
	fetch?: typeof globalThis.window.fetch;
}) => {
	const res = await fetch(ONBOARDING_URL);
	if (!res.ok) {
		throw new Error('Failed to fetch onboarding status');
	}
	return res.json() as Promise<{ onboarded: boolean }>;
};

export const prefetch = async ({ queryClient, fetch }: { queryClient: any; fetch: any }) => {
	await queryClient.prefetchQuery({
		queryKey: queryKey,
		queryFn: () => fetchOnboarding({ fetch }),
		staleTime: 10,
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
		const res = await fetch(ONBOARDING_URL, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
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
