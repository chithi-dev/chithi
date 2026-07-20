import { client } from '$lib/graphql/client.js';
import { ONBOARDING_QUERY } from '$lib/graphql/queries.js';
import { useOnboardingQuery, completeOnboardingMutation } from '$lib/graphql/hooks.js';
import type { OnboardingData } from '$lib/graphql/hooks.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingStatus {
  onboarded: boolean;
}

interface OnboardingState {
  data: OnboardingStatus | undefined;
  error: string | undefined;
  isLoading: boolean;
  stale: boolean;
}

// ─── Prefetch ──────────────────────────────────────────────────────────────────

export const prefetch = async (_params?: { queryClient?: unknown; fetch?: typeof globalThis.fetch }) => {
  const source = client.query(ONBOARDING_QUERY, {});
  await source.toPromise();
};

// ─── Query Hook ────────────────────────────────────────────────────────────────

function mapOnboardingState(raw: ReturnType<typeof useOnboardingQuery>): OnboardingState {
  return {
    data: raw.data ? { onboarded: raw.data.onboarding.is_configured } : undefined,
    error: raw.error,
    isLoading: raw.fetching,
    stale: raw.stale
  };
}

// ─── Public API ────────────────────────────────────────────────────────────────

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

    // Refetch the onboarding status after mutation.
    const refetchSource = client.query(ONBOARDING_QUERY, {});
    await refetchSource.toPromise();

    return result.data;
  };

  return { status, completeOnboarding };
};
