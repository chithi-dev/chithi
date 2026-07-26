import { client } from '$lib/graphql/client.js';
import { USERS_QUERY, CREATE_USER_MUTATION, DELETE_USER_MUTATION } from '$lib/graphql/queries.js';
import type { UserData } from '$lib/graphql/hooks.js';

export const usersQueryKey = ['admin-users'];

interface UsersResponse {
  items: Array<{ id: string; username: string; email: string | null; created_at: string }>;
  total_items: number;
}

interface UsersData {
  users: UserData[];
}

interface QueryState {
  data: UsersResponse | undefined;
  error: string | undefined;
  isLoading: boolean;
}

function mapUsersResult(users: UserData[]): UsersResponse {
  return {
    items: users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email,
      created_at: u.created_at
    })),
    total_items: users.length
  };
}

export const useUsersQuery = (page: () => number, size: number) => {
  let state = $state<QueryState>({
    data: undefined,
    error: undefined,
    isLoading: true
  });

  function fetchUsers() {
    state.isLoading = true;
    const observable = client.watchQuery<UsersData>({ query: USERS_QUERY });
    observable.subscribe({
      next(result) {
        state.isLoading = result.loading;
        state.error = result.error?.message ?? undefined;
        const usersData = result.data as UsersData | undefined;
        if (usersData?.users) {
          state.data = mapUsersResult(usersData.users);
        }
      },
      error(err) {
        state.isLoading = false;
        state.error = err.message;
      }
    });
  }

  fetchUsers();

  const invalidate = () => {
    client.query<UsersData>({ query: USERS_QUERY }).then((result) => {
      if (result.error) {
        state.error = result.error.message;
      } else {
        const data = result.data as UsersData | undefined;
        if (data?.users) {
          state.data = mapUsersResult(data.users);
        }
      }
      state.isLoading = false;
    });
  };

  const createUser = async (user_in: { username: string; email?: string | null; password?: string }) => {
    const result = await client.mutate({
      mutation: CREATE_USER_MUTATION,
      variables: {
        username: user_in.username,
        password: user_in.password || '',
        email: user_in.email
      }
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    invalidate();
    return result.data;
  };

  const deleteUser = async (user_id: string) => {
    const result = await client.mutate({
      mutation: DELETE_USER_MUTATION,
      variables: { id: user_id }
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    invalidate();
    return result.data;
  };

  return { users: state, createUser, deleteUser };
};
