import { Api } from '#consts/backend';
import { fetchJson } from './fetch-utils';
import { createQuery, useQueryClient } from '@tanstack/svelte-query';

export type FileInfo = { filename: string; size: number; number_of_files?: number; download_count?: number; created_at?: string; expires_at?: string; expired?: boolean };

export function useFileInfoQuery(slug: () => string) {
  const qc = useQueryClient();
  const query = createQuery(() => ({
    queryKey: ['file-info', slug()],
    queryFn: () => fetchJson<FileInfo>(Api.FILE_INFO(slug()), 'file info').then((i) => ({ ...i, filename: typeof i.filename === 'string' ? i.filename : 'file', fileSize: typeof i.size === 'number' ? i.size : 0, numberOfFiles: i.number_of_files ?? 0 })),
    staleTime: Infinity, retry: false
  }));
  return { fileInfo: query, qc };
}
