import { Api } from '#consts/backend';
import { fetchJson } from './fetch-utils';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export type FileInfo = { filename: string; size: number; number_of_files?: number; download_count?: number; created_at?: string; expires_at?: string; expired?: boolean };

export function useFileInfoQuery(slug: () => string) {
  const queryClient = useQueryClient();

  const query = createQuery(() => ({
    queryKey: ['file-info', slug()],
    queryFn: () => fetchJson<FileInfo>(Api.FILE_INFO(slug()), 'file info').then((info) => ({
      ...info,
      filename: typeof info.filename === 'string' ? info.filename : 'file',
      fileSize: typeof info.size === 'number' ? info.size : 0,
      numberOfFiles: info.number_of_files ?? 0
    })),
    staleTime: Infinity,
    retry: false
  }));

  return { fileInfo: query, queryClient };
}
