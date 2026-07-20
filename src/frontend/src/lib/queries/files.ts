import { client } from '$lib/graphql/client.js';
import { ADMIN_FILES_QUERY, DELETE_FILE_MUTATION } from '$lib/graphql/queries.js';

export type FileInfo = {
  id: string;
  filename: string;
  folder_name?: string;
  size?: number;
  created_at: string;
  expires_at?: string;
  expire_after_n_download?: number;
  download_count?: number;
};

export type PaginatedFiles = {
  items: FileInfo[];
  total_items: number;
  start_index: number;
  end_index: number;
  total_pages: number;
  current_page: number;
  current_page_size: number;
};

interface QueryState {
  data: PaginatedFiles | undefined;
  error: Error | null;
  isLoading: boolean;
}

function mapAdminFilesToPaginatedFiles(adminFilesData: any): PaginatedFiles {
  const items: FileInfo[] = (adminFilesData?.items ?? []).map((item: any) => ({
    id: item.id,
    filename: item.filename,
    size: item.size,
    created_at: item.created_at,
    expires_at: item.expires_at,
    expire_after_n_download: item.expire_after_n_download,
    download_count: item.download_count
  }));

  const page = adminFilesData?.page ?? 1;
  const size = adminFilesData?.size ?? 20;
  const total = adminFilesData?.total ?? 0;
  const totalPages = adminFilesData?.pages ?? Math.ceil(total / size);

  return {
    items,
    total_items: total,
    start_index: (page - 1) * size + 1,
    end_index: Math.min(page * size, total),
    total_pages: totalPages,
    current_page: page,
    current_page_size: size
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

    const source = client.query(ADMIN_FILES_QUERY, {
      page: p,
      size: pageSize,
      search: null
    });

    source.toPromise().then(
      (result) => {
        if (result.error) {
          state.error = new Error(result.error.message);
          state.data = undefined;
        } else {
          state.data = mapAdminFilesToPaginatedFiles(result.data?.admin_files);
          state.error = null;
        }
        state.isLoading = false;
      },
      (err) => {
        state.error = err instanceof Error ? err : new Error(String(err));
        state.data = undefined;
        state.isLoading = false;
      }
    );
  }

  // Initial fetch
  fetchFiles(currentPage);

  // Refetch on a 1-second interval (matching original refetchInterval behavior)
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

  // Watch for page changes and refetch
  $effect(() => {
    const p = page();
    currentPage = p;
    fetchFiles(p);
  });

  const revokeFile = async (id: string) => {
    const result = await client.mutation(DELETE_FILE_MUTATION, { id }).toPromise();

    if (result.error) {
      throw new Error(result.error.message);
    }

    // Refetch the file list after successful revoke
    fetchFiles(currentPage);
  };

  return {
    files: state,
    revokeFile
  };
}
