import { client } from '$lib/graphql/client.js';
import { CONFIG_QUERY, UPDATE_CONFIG_MUTATION } from '$lib/graphql/queries.js';
import type { OperationResult } from '@urql/core';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Config {
  total_storage_limit: number;
  max_file_size_limit: number;
  default_expiry: number;
  default_number_of_downloads: number;
  site_description: string;
  download_configs: number[];
  time_configs: number[];
  allowed_file_types: string[];
  banned_file_types: string[];
  allow_uploads: boolean;
}

interface ConfigState {
  data: Config | undefined;
  error: string | undefined;
  isLoading: boolean;
  isFetching: boolean;
  stale: boolean;
}

// ─── Prefetch ──────────────────────────────────────────────────────────────────

export const prefetch = async (_params?: { queryClient?: unknown; fetch?: typeof globalThis.fetch }) => {
  const source = client.query(CONFIG_QUERY);
  await source.toPromise();
};

// ─── Query Hook ────────────────────────────────────────────────────────────────

function createConfigState() {
  const initialState: ConfigState = {
    data: undefined,
    error: undefined,
    isLoading: true,
    isFetching: true,
    stale: false
  };

  let state = $state<ConfigState>(initialState);

  const source = client.query(CONFIG_QUERY);

  const subscription = source.subscribe((result: OperationResult) => {
    state.isLoading = result.operation.kind === 'query' && result.stale;
    state.isFetching = result.operation.kind === 'query' && result.stale;
    state.stale = result.stale;
    state.data = result.data ? result.data.config : undefined;
    state.error = result.error ? result.error.message : undefined;
  });

  $effect(() => {
    return () => {
      subscription.unsubscribe();
    };
  });

  return state;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const useConfigQuery = () => {
  const query = createConfigState();

  const updateConfig = async (data: Partial<Config>) => {
    const result = await client.mutation(UPDATE_CONFIG_MUTATION, data);

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Refetch the config query after mutation to sync the cache.
    const refetchSource = client.query(CONFIG_QUERY);
    await refetchSource.toPromise();
  };

  return { config: query, updateConfig };
};
