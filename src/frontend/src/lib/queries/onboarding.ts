import { Api } from '#consts/backend';
import { createQuery, type QueryClient, useQueryClient } from '@tanstack/svelte-query';
import { fetchJson, prefetch as prefetchFn } from './fetch-utils';

const key = ['onboarding-status'];

export const prefetch = ({ queryClient, fetch }: { queryClient: QueryClient; fetch?: typeof globalThis.fetch }) =>
  prefetchFn(queryClient, key, () => fetchJson<{ onboarded: boolean }>(Api.ONBOARDING, 'onboarding status', fetch), { retry: false });

export const useOnboarding = () => {
  const queryClient = useQueryClient();

  const query = createQuery(() => ({
    queryKey: key,
    queryFn: () => fetchJson<{ onboarded: boolean }>(Api.ONBOARDING, 'onboarding status'),
    retry: false
  }));

  const completeOnboarding = async (user: { username: string; email: string; password: string }) => {
    const res = await fetch(Api.ONBOARDING, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(user)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to complete onboarding');
    }

    await queryClient.invalidateQueries({ queryKey: key });
    return res.json();
  };

  return { status: query, completeOnboarding };
};
