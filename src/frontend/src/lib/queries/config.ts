import { Api } from '#consts/backend';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';
import { fetchJson, prefetch as prefetchFn } from './fetch-utils';

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

const key = ['config'];

export const prefetch = ({ queryClient, fetch }: { queryClient: import('@tanstack/svelte-query').QueryClient; fetch?: typeof globalThis.fetch }) =>
  prefetchFn(queryClient, key, () => fetchJson<Config>(Api.CONFIG, 'config', fetch));

export const useConfigQuery = () => {
  const qc = useQueryClient();
  const query = createQuery(() => ({ queryKey: key, queryFn: () => fetchJson<Config>(Api.CONFIG, 'config'), staleTime: Infinity }));

  const updateConfig = async (data: Partial<Config>) => {
    const res = await fetch(Api.ADMIN.CONFIG, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(data) });
    if (res.ok) await qc.invalidateQueries({ queryKey: key });
  };

  return { config: query, updateConfig };
};
