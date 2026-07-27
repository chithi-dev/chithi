import { FILE_INFO_QUERY } from '../graphql/queries.js';
import { client } from '../graphql/client.js';
import type { FileInfoData, FileInfoItem } from '../graphql/hooks.js';

export interface FileInfoResult {
  filename: string;
  fileSize: number;
  numberOfFiles: number;
}

interface FileInfoStore {
  isPending: boolean;
  isError: boolean;
  error: Error | undefined;
  data: FileInfoResult | undefined;
}

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

    const observable = client.watchQuery<FileInfoData>({
      query: FILE_INFO_QUERY,
      variables: { slug: s }
    });

    subscription = observable.subscribe({
      next(result) {
        state.isPending = false;
        if (result.error) {
          state.isError = true;
          state.error = new Error(result.error.message);
          state.data = undefined;
        } else if (result.data) {
          state.isError = false;
          const item = result.data.fileInfo;
          state.data = item
            ? {
                filename: item.filename || 'file',
                fileSize: item.size || 0,
                numberOfFiles: item.numberOfFiles ?? 0
              }
            : undefined;
        }
      },
      error(err) {
        state.isPending = false;
        state.isError = true;
        state.error = err instanceof Error ? err : new Error(String(err));
      }
    });
  }

  $effect(() => {
    currentSlug;
    runQuery();
    return () => {
      if (subscription) {
        subscription.unsubscribe();
        subscription = null;
      }
    };
  });

  runQuery();

  return { fileInfo: state };
}
