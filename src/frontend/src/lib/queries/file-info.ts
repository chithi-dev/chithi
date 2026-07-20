import { FILE_INFO_QUERY } from '../graphql/queries.js';
import { client } from '../graphql/client.js';
import type { FileInfoData, FileInfoItem } from '../graphql/hooks.js';

/** Shape returned in fileInfo.data — matches caller expectations. */
export interface FileInfoResult {
  filename: string;
  fileSize: number;
  numberOfFiles: number;
}

/** Shape returned by the fileInfo store — matches tanstack-svelte-query API callers expect. */
interface FileInfoStore {
  isPending: boolean;
  isError: boolean;
  error: Error | undefined;
  data: FileInfoResult | undefined;
}

/**
 * Reactive file-info query backed by urql (GraphQL) instead of REST fetch.
 * Returns the same shape as the old tanstack-svelte-query wrapper so callers
 * (view/[slug] and download/[slug]) do not need to change.
 */
export function useFileInfoQuery(slug: () => string) {
  let currentSlug = $derived(slug());
  let state = $state<FileInfoStore>({
    isPending: true,
    isError: false,
    error: undefined,
    data: undefined
  });

  let subscription: any = null;

  function runQuery() {
    // Cancel previous subscription to avoid stale results.
    if (subscription) {
      subscription.unsubscribe();
      subscription = null;
    }

    const s = currentSlug;
    if (!s) {
      state = { isPending: false, isError: false, error: undefined, data: undefined };
      return;
    }

    state.isPending = true;
    state.isError = false;
    state.error = undefined;
    state.data = undefined;

    const source = client.query(FILE_INFO_QUERY, { slug: s });
    subscription = source.subscribe((result) => {
      state.isPending = false;
      if (result.error) {
        state.isError = true;
        state.error = new Error(result.error.message);
        state.data = undefined;
      } else if (result.data) {
        state.isError = false;
        const item = result.data.file_info as FileInfoItem | null;
        state.data = item
          ? {
              filename: item.filename || 'file',
              fileSize: item.size || 0,
              numberOfFiles: item.number_of_files ?? 0
            }
          : undefined;
      }
    });
  }

  // Re-run whenever the slug changes.
  $effect(() => {
    currentSlug; // track
    runQuery();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    };
  });

  // Run immediately on creation.
  runQuery();

  return { fileInfo: state };
}
