<script lang="ts">
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Table from '$lib/components/ui/table/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Skeleton } from '$lib/components/ui/skeleton/index.js';
  import { Trash2, FileIcon, FolderIcon, Download, Clock, CalendarClock, ArrowUpDown, ArrowUp, ArrowDown, Search } from '@lucide/svelte';
  import { formatFileSize } from '#functions/bytes';

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

  const processedFiles = $derived.by(() => {
    let items = files.data?.items ?? [];

    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      items = items.filter((f: { filename: string; folder_name?: string }) =>
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

</script>

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
        <Table.Row>
          <Table.Head class="w-[40%]">File Name</Table.Head>
          <Table.Head class="cursor-pointer select-none" onclick={() => toggleSort('size')}>
            <span class="flex items-center gap-1">
              Size
              {#if sortCol === 'size'}
                {#if sortDir === 'asc'}<ArrowUp class="h-4 w-4" />
                {:else if sortDir === 'desc'}<ArrowDown class="h-4 w-4" />
                {:else}<ArrowUpDown class="h-4 w-4" />
                {/if}
              {:else}<ArrowUpDown class="h-4 w-4 opacity-30" />{/if}
            </span>
          </Table.Head>
          <Table.Head class="cursor-pointer select-none" onclick={() => toggleSort('created_at')}>
            <span class="flex items-center gap-1">
              Activity
              {#if sortCol === 'created_at'}
                {#if sortDir === 'asc'}<ArrowUp class="h-4 w-4" />
                {:else if sortDir === 'desc'}<ArrowDown class="h-4 w-4" />
                {:else}<ArrowUpDown class="h-4 w-4" />
                {/if}
              {:else}<ArrowUpDown class="h-4 w-4 opacity-30" />{/if}
            </span>
          </Table.Head>
          <Table.Head class="cursor-pointer select-none" onclick={() => toggleSort('downloads')}>
            <span class="flex items-center gap-1">
              Downloads
              {#if sortCol === 'downloads'}
                {#if sortDir === 'asc'}<ArrowUp class="h-4 w-4" />
                {:else if sortDir === 'desc'}<ArrowDown class="h-4 w-4" />
                {:else}<ArrowUpDown class="h-4 w-4" />
                {/if}
              {:else}<ArrowUpDown class="h-4 w-4 opacity-30" />{/if}
            </span>
          </Table.Head>
          <Table.Head class="text-right">Action</Table.Head>
        </Table.Row>
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
            <Table.Cell colspan={5} class="h-24 text-center text-destructive">
              Error loading files: {files.error.message}
            </Table.Cell>
          </Table.Row>
        {:else if !processedFiles || processedFiles.length === 0}
          <Table.Row>
            <Table.Cell colspan={5} class="h-32 text-center text-muted-foreground">
              {globalFilter ? 'No files match your filter.' : 'No outstanding URLs found.'}
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each processedFiles as file (file.id)}
            <Table.Row class="group">
              <Table.Cell class="font-medium">
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10"
                  >
                    {#if file.folder_name}
                      <FolderIcon class="h-4 w-4 text-primary" />
                    {:else}
                      <FileIcon class="h-4 w-4 text-primary" />
                    {/if}
                  </div>
                  <div class="flex flex-col">
                    <span class="max-w-50 truncate lg:max-w-75" title={file.filename}>
                      {file.filename}
                    </span>
                    {#if file.folder_name}
                      <span class="text-xs text-muted-foreground">in {file.folder_name}</span>
                    {/if}
                  </div>
                </div>
              </Table.Cell>

              <Table.Cell class="whitespace-nowrap text-muted-foreground">
                {file.size ? formatFileSize(file.size) : '-'}
              </Table.Cell>

              <Table.Cell>
                <div class="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span class="flex items-center gap-1.5" title="Created At">
                    <Clock class="h-3 w-3" />
                    {formatDate(file.created_at)}
                  </span>
                  {#if file.expires_at}
                    <span class="flex items-center gap-1.5 text-orange-600/80" title="Expires At">
                      <CalendarClock class="h-3 w-3" />
                      {formatDate(file.expires_at)}
                    </span>
                  {/if}
                </div>
              </Table.Cell>

              <Table.Cell>
                {#if file.download_count !== undefined}
                  <div class="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Download class="h-3.5 w-3.5" />
                    <span>{file.download_count}</span>
                    {#if file.expire_after_n_download}
                      <span class="opacity-50">/ {file.expire_after_n_download}</span>
                    {/if}
                  </div>
                {/if}
              </Table.Cell>

              <Table.Cell class="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  class="h-8 w-8 text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive lg:opacity-0 lg:group-hover:opacity-100"
                  onclick={() => openRevokeDialog(file.id)}
                  disabled={isRevoking}
                  title="Revoke URL"
                >
                  <Trash2 class="h-4 w-4" />
                </Button>
              </Table.Cell>
            </Table.Row>
          {/each}
        {/if}
      </Table.Body>
    </Table.Root>
  </Card.Content>
</Card.Root>
