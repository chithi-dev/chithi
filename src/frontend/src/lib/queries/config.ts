import { client } from '$lib/graphql/client.js';
import { CONFIG_QUERY } from '$lib/graphql/queries.js';
import { updateConfigMutation } from '$lib/graphql/hooks.js';
import type { ConfigData } from '$lib/graphql/hooks.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface Config {
  totalStorageLimit: number;
  maxFileSizeLimit: number;
  defaultExpiry: number;
  defaultNumberOfDownloads: number;
  siteDescription: string;
  downloadConfigs: number[];
  timeConfigs: number[];
  allowedFileTypes: string[];
  bannedFileTypes: string[];
  allowUploads: boolean;
}

interface ConfigState {
  data: Config | undefined;
  error: string | undefined;
  isLoading: boolean;
  isFetching: boolean;
  stale: boolean;
}

// ─── Prefetch ──────────────────────────────────────────────────────────────────

export const prefetch = async () => {
  await client.query<ConfigData>({ query: CONFIG_QUERY });
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

  const observable = client.watchQuery<ConfigData>({ query: CONFIG_QUERY });

  observable.subscribe({
    next(result) {
      state.isLoading = result.loading;
      state.isFetching = result.loading;
      state.stale = false;
      state.data = (result.data as ConfigData | undefined)?.config ?? undefined;
      state.error = result.error?.message ?? undefined;
    },
    error(err) {
      state.isLoading = false;
      state.isFetching = false;
      state.error = err.message;
    }
  });

  $effect(() => {
    return () => {
      // Apollo handles cleanup internally, but we note the intent.
    };
  });

  return state;
}

// ─── Public API ────────────────────────────────────────────────────────────────

export const useConfigQuery = () => {
  const query = createConfigState();

  const updateConfig = async (data: Partial<Config>) => {
    const result = await updateConfigMutation(data);

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Refetch the config query after mutation to sync the cache.
    await client.query<ConfigData>({ query: CONFIG_QUERY });
  };

  return { config: query, updateConfig };
};
