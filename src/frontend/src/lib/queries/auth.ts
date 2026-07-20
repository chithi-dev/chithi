import { browser } from '$app/environment';
import { login as loginRemote, logout as logoutRemote } from '$lib/remote/auth.remote';
import { user_store } from '$lib/store/user.svelte';
import { client } from '$lib/graphql/hooks.js';
import { ME_QUERY, UPDATE_USER_MUTATION } from '$lib/graphql/queries.js';
import type { MeData, UserData, UpdateUserResult } from '$lib/graphql/hooks.js';
import type { OperationResult } from '@urql/core';

export const queryKey = ['auth-user'];

// ─── Module-level ME query state ───────────────────────────────────────────────

let meQuery = $state({
  data: null as UserData | null,
  error: null as string | null,
  fetching: true
});

const source = client.query(ME_QUERY);

const subscription = source.subscribe((result: OperationResult<MeData>) => {
  meQuery.fetching = result.stale || (!result.data && !result.error);
  meQuery.error = result.error ? result.error.message : null;
  meQuery.data = result.data ? result.data.me : null;

  if (browser) {
    if (meQuery.data) {
      user_store.authenticate();
    } else if (result.error) {
      user_store.unauthenticate();
    }
  }
});

$effect(() => {
  return () => {
    subscription.unsubscribe();
  };
});

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function refetchMe() {
  await client.refetchQuery(ME_QUERY);
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const prefetch = async () => {
  // urql manages its own cache; no explicit prefetch needed.
  // Kept for backward compatibility with existing callers.
};

export const useAuth = () => {
  const user = {
    get data() {
      return meQuery.data;
    },
    get isLoading() {
      return meQuery.fetching;
    },
    get error() {
      return meQuery.error;
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

    const currentUser = meQuery.data;
    if (!currentUser) {
      throw new Error('No authenticated user');
    }

    const result = await client.mutation(UPDATE_USER_MUTATION, {
      id: currentUser.id,
      username: data.username ?? undefined,
      email: data.email ?? undefined
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
