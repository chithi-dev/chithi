import { client } from '$lib/graphql/client.js';
import { ONBOARDING_QUERY } from '$lib/graphql/queries.js';
import { useOnboardingQuery, completeOnboardingMutation } from '$lib/graphql/hooks.js';
import type { OnboardingData } from '$lib/graphql/hooks.js';

interface OnboardingStatus {
  onboarded: boolean;
}

interface OnboardingState {
  data: OnboardingStatus | undefined;
  error: string | undefined;
  isLoading: boolean;
  stale: boolean;
}

export const prefetch = async () => {
  await client.query({ query: ONBOARDING_QUERY });
};

function mapOnboardingState(raw: ReturnType<typeof useOnboardingQuery>): OnboardingState {
  return {
    data: raw.data ? { onboarded: raw.data.onboarding.isConfigured } : undefined,
    error: raw.error,
    isLoading: raw.fetching,
    stale: raw.stale
  };
}

export const useOnboarding = () => {
  const rawState = useOnboardingQuery();

  const status = $derived(mapOnboardingState(rawState));

  const completeOnboarding = async (user: { username: string; email: string; password: string }) => {
    const result = await completeOnboardingMutation(
      user.username,
      user.email,
      user.password,
      ''
    );

    if (result.error) {
      throw new Error(result.error.message);
    }

    await client.query({ query: ONBOARDING_QUERY });

    return result.data;
  };

  return { status, completeOnboarding };
};
