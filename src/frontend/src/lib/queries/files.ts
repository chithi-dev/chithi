import { client } from '$lib/graphql/client.js';
import { ADMIN_FILES_QUERY, DELETE_FILE_MUTATION } from '$lib/graphql/queries.js';
import type { AdminFilesData, FileInfoItem, DeleteFileResult } from '$lib/graphql/hooks.js';

export type FileInfo = {
  id: string;
  filename: string;
  folderName?: string;
  size?: number;
  createdAt: string;
  expiresAt?: string;
  expireAfterNDownload?: number;
  downloadCount?: number;
};

export type PaginatedFiles = {
  items: FileInfo[];
  totalItems: number;
  startIndex: number;
  endIndex: number;
  totalPages: number;
  currentPage: number;
  currentPageSize: number;
};

interface QueryState {
  data: PaginatedFiles | undefined;
  error: Error | null;
  isLoading: boolean;
}

function mapAdminFilesToPaginatedFiles(adminFilesData: NonNullable<AdminFilesData['adminFiles']>): PaginatedFiles {
  const items: FileInfo[] = (adminFilesData?.items ?? []).map((item: FileInfoItem) => ({
    id: item.id,
    filename: item.filename,
    size: item.size,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
    expireAfterNDownload: item.expireAfterNDownload,
    downloadCount: item.downloadCount
  }));

  const page = adminFilesData?.page ?? 1;
  const size = adminFilesData?.size ?? 20;
  const total = adminFilesData?.total ?? 0;
  const totalPages = adminFilesData?.pages ?? Math.ceil(total / size);

  return {
    items,
    totalItems: total,
    startIndex: (page - 1) * size + 1,
    endIndex: Math.min(page * size, total),
    totalPages,
    currentPage: page,
    currentPageSize: size
  };
}

export function useFilesQuery(page: () => number = () => 1, pageSize: number = 20) {
  const state = $state<QueryState>({
    data: undefined,
    error: null,
    isLoading: true
  });

  let currentPage = $state(page());

  function fetchFiles(p: number) {
    state.isLoading = true;
    state.error = null;

    const observable = client.watchQuery<AdminFilesData>({
      query: ADMIN_FILES_QUERY,
      variables: { page: p, size: pageSize, search: null }
    });

    observable.subscribe({
      next(result) {
        if (result.error) {
          state.error = new Error(result.error.message);
          state.data = undefined;
        } else {
          state.data = (result.data as AdminFilesData | undefined)?.adminFiles
            ? mapAdminFilesToPaginatedFiles((result.data as AdminFilesData).adminFiles)
            : undefined;
          state.error = null;
        }
        state.isLoading = false;
      },
      error(err) {
        state.error = err instanceof Error ? err : new Error(String(err));
        state.data = undefined;
        state.isLoading = false;
      }
    });
  }

  fetchFiles(currentPage);

  let intervalId: number | undefined = undefined;

  function startRefetchInterval() {
    if (intervalId !== undefined) return;
    intervalId = setInterval(() => {
      fetchFiles(currentPage);
    }, 1000) as unknown as number;
  }

  $effect(() => {
    startRefetchInterval();
    return () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };
  });

  $effect(() => {
    const p = page();
    currentPage = p;
    fetchFiles(p);
  });

  const revokeFile = async (id: string) => {
    const result = await client.mutate<DeleteFileResult>({
      mutation: DELETE_FILE_MUTATION,
      variables: { id }
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    fetchFiles(currentPage);
  };

  return {
    files: state,
    revokeFile
  };
}
