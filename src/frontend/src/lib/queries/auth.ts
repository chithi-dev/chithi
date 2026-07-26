import { browser } from '$app/environment';
import { login as loginRemote, logout as logoutRemote } from '$lib/remote/auth.remote';
import { user_store } from '$lib/store/user.svelte';
import { client } from '$lib/graphql/client.js';
import { ME_QUERY, UPDATE_USER_MUTATION } from '$lib/graphql/queries.js';
import type { MeData, UserData, UpdateUserResult } from '$lib/graphql/hooks.js';

export const queryKey = ['auth-user'];

// ─── Module-level ME query state ───────────────────────────────────────────────

const meQueryState = {
  data: null as UserData | null,
  error: null as string | null,
  fetching: true
};

const observable = client.watchQuery<MeData>({ query: ME_QUERY });

observable.subscribe({
  next(result) {
    meQueryState.fetching = result.loading || (!result.data && !result.error);
    meQueryState.error = result.error?.message ?? null;
    meQueryState.data = (result.data as MeData | undefined)?.me ?? null;

    if (browser) {
      if (meQueryState.data) {
        user_store.authenticate();
      } else if (result.error) {
        user_store.unauthenticate();
      }
    }
  },
  error(err) {
    meQueryState.fetching = false;
    meQueryState.error = err.message;
  }
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function refetchMe() {
  await client.query<MeData>({ query: ME_QUERY });
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const prefetch = async () => {
  // Apollo manages its own cache; no explicit prefetch needed.
  // Kept for backward compatibility with existing callers.
};

export const useAuth = () => {
  const user = {
    get data() {
      return meQueryState.data;
    },
    get isLoading() {
      return meQueryState.fetching;
    },
    get error() {
      return meQueryState.error;
    }
  };

  const login = async (username: string, password: string) => {
    if (!browser) return;
    try {
      await loginRemote({ username, password });
      user_store.authenticate();
      await refetchMe();
    } catch (error) {
      user_store.unauthenticate();
      throw new Error(error instanceof Error ? error.message : 'Invalid username or password');
    }
  };

  const updateUser = async (data: { username?: string; email?: string | null }) => {
    if (!browser) return;

    const currentUser = meQueryState.data;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const result = await client.mutate<UpdateUserResult>({
      mutation: UPDATE_USER_MUTATION,
      variables: {
        id: currentUser.id,
        username: data.username ?? undefined,
        email: data.email ?? undefined
      }
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    await refetchMe();
    return result.data as UpdateUserResult;
  };

  return {
    user,
    login,
    updateUser
  };
};
