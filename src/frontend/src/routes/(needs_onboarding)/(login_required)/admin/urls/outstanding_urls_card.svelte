<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Trash2, FileIcon, FolderIcon, Download, Clock, CalendarClock, ArrowUpDown, ArrowUp, ArrowDown, Search } from '@lucide/svelte';
  import { formatFileSize } from '#functions/bytes';
  import { createSvelteTable } from '$lib/components/ui/data-table/data-table.svelte';
  import { renderSnippet } from '$lib/components/ui/data-table/render-helpers.js';
  import FlexRender from '$lib/components/ui/data-table/flex-render.svelte';
  import type { ColumnDef } from '@tanstack/table-core';
  import { getCoreRowModel } from '@tanstack/table-core';

  type FileRow = {
    id: string;
    filename: string;
    folder_name?: string;
    size?: number;
    created_at?: string;
    expires_at?: string;
    expire_after_n_download?: number;
    download_count?: number;
  };

  let {
    files,
    isRevoking,
    openRevokeDialog,
    formatDate
  }: {
    files: any;
    isRevoking: boolean;
    openRevokeDialog: (id: string) => void;
    formatDate: (dateStr?: string) => string;
  } = $props();

  let globalFilter = $state('');
  let sortCol = $state<'filename' | 'size' | 'created_at' | 'downloads' | null>(null);
  let sortDir = $state<'asc' | 'desc' | null>(null);

  function toggleSort(col: 'filename' | 'size' | 'created_at' | 'downloads') {
    if (sortCol === col) {
      if (sortDir === 'asc') sortDir = 'desc';
      else if (sortDir === 'desc') { sortDir = null; sortCol = null; }
      else sortDir = 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
  }

  function getSortIcon(col: 'filename' | 'size' | 'created_at' | 'downloads') {
    if (sortCol !== col) return ArrowUpDown;
    if (sortDir === 'asc') return ArrowUp;
    if (sortDir === 'desc') return ArrowDown;
    return ArrowUpDown;
  }

  function isSortActive(col: 'filename' | 'size' | 'created_at' | 'downloads') {
    return sortCol === col;
  }

  const processedFiles = $derived.by(() => {
    let items: FileRow[] = files.data?.items ?? [];

    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      items = items.filter((f) =>
        f.filename.toLowerCase().includes(filter) ||
        (f.folder_name && f.folder_name.toLowerCase().includes(filter))
      );
    }

    if (sortCol && sortDir) {
      items = [...items].sort((a, b) => {
        let cmp = 0;
        switch (sortCol) {
          case 'filename':
            cmp = (a.filename ?? '').localeCompare(b.filename ?? '');
            break;
          case 'size':
            cmp = (a.size ?? 0) - (b.size ?? 0);
            break;
          case 'created_at':
            cmp = ((a.created_at ?? '') > (b.created_at ?? '') ? 1 : -1);
            break;
          case 'downloads':
            cmp = (a.download_count ?? 0) - (b.download_count ?? 0);
            break;
        }
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return items;
  });

  // Column definitions for TanStack Table
  const columns: ColumnDef<FileRow>[] = [
    {
      accessorKey: 'filename',
      meta: { className: 'w-[40%]' },
      header: 'File Name',
      cell: (ctx) => renderSnippet(filenameCellSnippet, { row: ctx.row }),
    },
    {
      accessorKey: 'size',
      header: () => renderSnippet(sizeHeaderSnippet),
      cell: (ctx) => renderSnippet(sizeCellSnippet, { row: ctx.row }),
    },
    {
      accessorKey: 'created_at',
      header: () => renderSnippet(activityHeaderSnippet),
      cell: (ctx) => renderSnippet(activityCellSnippet, { row: ctx.row }),
    },
    {
      id: 'downloads',
      accessorFn: (row) => row.download_count,
      header: () => renderSnippet(downloadsHeaderSnippet),
      cell: (ctx) => renderSnippet(downloadsCellSnippet, { row: ctx.row }),
    },
    {
      id: 'action',
      meta: { className: 'text-right' },
      header: 'Action',
      cell: (ctx) => renderSnippet(actionCellSnippet, { row: ctx.row }),
    },
  ];

  const table = createSvelteTable<FileRow>({
    data: processedFiles,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
</script>

{#snippet filenameCellSnippet({ row }: { row: { original: FileRow } })}
  <div class="flex items-center gap-3">
    <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
      {#if row.original.folder_name}
        <FolderIcon class="h-4 w-4 text-primary" />
      {:else}
        <FileIcon class="h-4 w-4 text-primary" />
      {/if}
    </div>
    <div class="flex flex-col">
      <span class="max-w-50 truncate lg:max-w-75" title={row.original.filename}>
        {row.original.filename}
      </span>
      {#if row.original.folder_name}
        <span class="text-xs text-muted-foreground">in {row.original.folder_name}</span>
      {/if}
    </div>
  </div>
{/snippet}

{#snippet sizeHeaderSnippet()}
  <span class="flex items-center gap-1">
    Size
    {#if getSortIcon('size') === ArrowUp}
      <ArrowUp class={isSortActive('size') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else if getSortIcon('size') === ArrowDown}
      <ArrowDown class={isSortActive('size') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else}
      <ArrowUpDown class={isSortActive('size') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {/if}
  </span>
{/snippet}

{#snippet sizeCellSnippet({ row }: { row: { original: FileRow } })}
  <span class="whitespace-nowrap text-muted-foreground">
    {row.original.size ? formatFileSize(row.original.size) : '-'}
  </span>
{/snippet}

{#snippet activityHeaderSnippet()}
  <span class="flex items-center gap-1">
    Activity
    {#if getSortIcon('created_at') === ArrowUp}
      <ArrowUp class={isSortActive('created_at') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else if getSortIcon('created_at') === ArrowDown}
      <ArrowDown class={isSortActive('created_at') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else}
      <ArrowUpDown class={isSortActive('created_at') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {/if}
  </span>
{/snippet}

{#snippet activityCellSnippet({ row }: { row: { original: FileRow } })}
  <div class="flex flex-col gap-1 text-xs text-muted-foreground">
    <span class="flex items-center gap-1.5" title="Created At">
      <Clock class="h-3 w-3" />
      {formatDate(row.original.created_at)}
    </span>
    {#if row.original.expires_at}
      <span class="flex items-center gap-1.5 text-orange-600/80" title="Expires At">
        <CalendarClock class="h-3 w-3" />
        {formatDate(row.original.expires_at)}
      </span>
    {/if}
  </div>
{/snippet}

{#snippet downloadsHeaderSnippet()}
  <span class="flex items-center gap-1">
    Downloads
    {#if getSortIcon('downloads') === ArrowUp}
      <ArrowUp class={isSortActive('downloads') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else if getSortIcon('downloads') === ArrowDown}
      <ArrowDown class={isSortActive('downloads') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else}
      <ArrowUpDown class={isSortActive('downloads') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {/if}
  </span>
{/snippet}

{#snippet downloadsCellSnippet({ row }: { row: { original: FileRow } })}
  {#if row.original.download_count !== undefined}
    <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
      <Download class="h-3.5 w-3.5" />
      <span>{row.original.download_count}</span>
      {#if row.original.expire_after_n_download}
        <span class="opacity-50">/ {row.original.expire_after_n_download}</span>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet actionCellSnippet({ row }: { row: { original: FileRow } })}
  <Button
    variant="ghost"
    size="icon"
    class="h-8 w-8 text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
    onclick={() => openRevokeDialog(row.original.id)}
    disabled={isRevoking}
    title="Revoke URL"
  >
    <Trash2 class="h-4 w-4" />
  </Button>
{/snippet}

<Card.Root class="border bg-background">
  <Card.Header class="px-6 py-4">
    <Card.Title class="text-base font-medium">Outstanding URLs</Card.Title>
    <Card.Description>Review active file links and revoke them when needed.</Card.Description>
  </Card.Header>

  <!-- Filter -->
  <div class="px-6 pb-4">
    <div class="relative max-w-sm">
      <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder="Filter by name..."
        bind:value={globalFilter}
        class="pl-9"
      />
    </div>
  </div>

  <Card.Content class="p-0">
    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup}
          <Table.Row>
            {#each headerGroup.headers as header}
              <Table.Head
                class={
                  (header.column.id === 'size' || header.column.id === 'created_at' || header.column.id === 'downloads')
                    ? 'cursor-pointer select-none'
                    : ''
                }
                onclick={
                  header.column.id === 'size' ? () => toggleSort('size')
                    : header.column.id === 'created_at' ? () => toggleSort('created_at')
                    : header.column.id === 'downloads' ? () => toggleSort('downloads')
                    : undefined
                }
              >
                <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>

      <Table.Body>
        {#if files.isLoading}
          {#each Array(3) as _}
            <Table.Row>
              <Table.Cell><Skeleton class="h-6 w-50" /></Table.Cell>
              <Table.Cell><Skeleton class="h-6 w-20" /></Table.Cell>
              <Table.Cell><Skeleton class="h-6 w-30" /></Table.Cell>
              <Table.Cell><Skeleton class="h-6 w-12.5" /></Table.Cell>
              <Table.Cell><Skeleton class="ml-auto h-8 w-8" /></Table.Cell>
            </Table.Row>
          {/each}
        {:else if files.error}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-24 text-center text-destructive">
              Error loading files: {files.error.message}
            </Table.Cell>
          </Table.Row>
        {:else if processedFiles.length === 0}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="h-32 text-center text-muted-foreground">
              {globalFilter ? 'No files match your filter.' : 'No outstanding URLs found.'}
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each table.getRowModel().rows as row}
            <Table.Row class="group">
              {#each row.getVisibleCells() as cell}
                <Table.Cell>
                  <FlexRender content={cell.column.columnDef.cell} context={cell.getContext()} />
                </Table.Cell>
              {/each}
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </Card.Content>
</Card.Root>
