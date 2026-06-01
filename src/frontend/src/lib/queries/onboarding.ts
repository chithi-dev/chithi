import { Api } from '#consts/backend';
import { useQueryClient } from '@tanstack/svelte-query';
import { makeFetcher, makeQuery } from './fetch-utils';

const fetcher = makeFetcher<{ onboarded: boolean }>(Api.ONBOARDING, 'onboarding status');
const q = makeQuery(fetcher, 'onboarding-status', { retry: false });

export const prefetch = q.prefetch;

export const useOnboarding = () => {
	const { query, qc } = q.useQuery();

	const completeOnboarding = async (user: { username: string; email: string; password: string }) => {
		const res = await fetch(Api.ONBOARDING, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			credentials: 'include',
			body: JSON.stringify(user)
		});
		if (!res.ok) throw new Error((await res.json()).detail || 'Failed to complete onboarding');
		await qc.invalidateQueries({ queryKey: ['onboarding-status'] });
		return res.json();
	};

	return { status: query, completeOnboarding };
};
