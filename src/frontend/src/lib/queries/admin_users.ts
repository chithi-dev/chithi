import { client } from '#graphql/client';
import { USERS_QUERY, CREATE_USER_MUTATION, DELETE_USER_MUTATION } from '#graphql/queries';
import type { DocumentInput } from '@urql/core';

export const usersQueryKey = ['admin-users'];

// Shape expected by callers (matches the old REST paginated response).
interface UsersResponse {
  items: Array<{ id: string; username: string; email: string | null; created_at: string }>;
  total_items: number;
}

// urql OperationResult shape for error access.
interface QueryResult {
  data: UsersResponse | undefined;
  error: string | undefined;
  fetching: boolean;
}

/**
 * Thin adapter that makes the urql query result look like the old
 * tanstack-svelte-query result, so callers need zero changes.
 */
function adaptQuery(result: QueryResult) {
  return {
    get data() {
      return result.data;
    },
    get isLoading() {
      return result.fetching;
    },
    get error() {
      return result.error ? new Error(result.error) : null;
    }
  };
}

export const useUsersQuery = (page: () => number, size: number) => {
  // GraphQL users query returns a flat list (no server-side pagination).
  // The page/size params are accepted for API compatibility but ignored.

  let fetching = $state(true);
  let data = $state<UsersResponse | undefined>(undefined);
  let error = $state<string | undefined>(undefined);

  const source = client.query(USERS_QUERY, {});

  const subscription = source.subscribe((result) => {
    fetching = result.operation.kind === 'query' && result.stale;
    error = result.error ? result.error.message : undefined;

    if (result.data) {
      data = {
        items: result.data.users,
        total_items: result.data.users.length
      };
    }
  });

  $effect(() => {
    return () => {
      subscription.unsubscribe();
    };
  });

  const queryResult = adaptQuery({ fetching, data, error });

  const invalidate = () => {
    // Re-fetch the users query from the urql cache.
    client.query(USERS_QUERY, {}).subscribe((r) => {
      if (r.error) {
        error = r.error.message;
      } else if (r.data) {
        data = {
          items: r.data.users,
          total_items: r.data.users.length
        };
      }
      fetching = false;
    });
  };

  const createUser = async (user_in: { username: string; email?: string | null; password?: string }) => {
    const result = await client
      .mutation(CREATE_USER_MUTATION, {
        username: user_in.username,
        password: user_in.password || '',
        email: user_in.email
      })
      .toPromise();

    if (result.error) {
      throw new Error(result.error.message);
    }

    invalidate();
    return result.data;
  };

  const deleteUser = async (user_id: string) => {
    const result = await client
      .mutation(DELETE_USER_MUTATION, { id: user_id })
      .toPromise();

    if (result.error) {
      throw new Error(result.error.message);
    }

    invalidate();
    return result.data;
  };

  return { users: queryResult, createUser, deleteUser };
};
