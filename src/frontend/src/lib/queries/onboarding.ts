import { ONBOARDING_URL } from '$lib/consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export function useOnboarding() {
    const queryClient = useQueryClient();

    const status = createQuery(() => ({
        queryKey: ['onboarding-status'],
        queryFn: async () => {
            const res = await fetch(ONBOARDING_URL);
            if (!res.ok) {
                throw new Error('Failed to fetch onboarding status');
            }
            return res.json() as Promise<{ onboarded: boolean }>;
        },
        retry: false
    }));

    const completeOnboarding = async (user: { username: string; email: string; password: string }) => {
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

        queryClient.invalidateQueries({ queryKey: ['onboarding-status'] });
        return res.json();
    };

    return {
        status,
        completeOnboarding
    };
}
