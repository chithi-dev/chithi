<script lang="ts">
  import { H2, Mutated } from '$lib/components/ui/typography/index.js';
  import { useAuth } from '#queries/auth';
  import { useUsersQuery } from '#queries/admin_users';
  import * as Table from '$lib/components/ui/table/index.js';
  import * as Card from '$lib/components/ui/card/index.js';
  import * as Pagination from '$lib/components/ui/pagination/index.js';
  import { Button } from '$lib/components/ui/button/index.js';
  import { Input } from '$lib/components/ui/input/index.js';
  import { Trash2, UserPlus, ArrowUpDown, ArrowUp, ArrowDown, Search } from '@lucide/svelte';
  import { toast } from 'svelte-sonner';
  import { createSvelteTable } from '$lib/components/ui/data-table/data-table.svelte';
  import { renderSnippet } from '$lib/components/ui/data-table/render-helpers.js';
  import FlexRender from '$lib/components/ui/data-table/flex-render.svelte';
  import type { ColumnDef } from '@tanstack/table-core';
  import { getCoreRowModel } from '@tanstack/table-core';

  const { default: CreateUserDialog } = await import('./create_user_dialog.svelte');
  const { default: DeleteUserDialog } = await import('./delete_user_dialog.svelte');

  type UserRow = { id: string; username: string; email?: string };

  let currentPage = $state(1);
  const pageSize = 20;

  const { user: currentUser } = useAuth();
  const { users } = useUsersQuery(() => currentPage, pageSize);

  let isCreateDialogOpen = $state(false);
  let isDeleteDialogOpen = $state(false);
  let userToDelete = $state<string | null>(null);
  let globalFilter = $state('');

  let totalItems = $derived(users.data?.total_items ?? 0);

  // Sort state
  let sortDir = $state<'asc' | 'desc' | null>(null);
  let sortCol = $state<'username' | 'email' | null>(null);

  // Apply client-side sorting and filtering to current page data
  const processedUsers = $derived.by(() => {
    let items: UserRow[] = users.data?.items ?? [];

    // Filter
    if (globalFilter) {
      const filter = globalFilter.toLowerCase();
      items = items.filter((u) =>
        u.username.toLowerCase().includes(filter) ||
        (u.email && u.email.toLowerCase().includes(filter))
      );
    }

    // Sort
    if (sortCol && sortDir) {
      const col = sortCol as 'username' | 'email';
      items = [...items].sort((a, b) => {
        const aVal = (a as any)[col] ?? '';
        const bVal = (b as any)[col] ?? '';
        const cmp = String(aVal).localeCompare(String(bVal));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return items;
  });

  function toggleSort(col: 'username' | 'email') {
    if (sortCol === col) {
      if (sortDir === 'asc') sortDir = 'desc';
      else if (sortDir === 'desc') { sortDir = null; sortCol = null; }
      else sortDir = 'asc';
    } else {
      sortCol = col;
      sortDir = 'asc';
    }
  }

  function getSortIcon(col: 'username' | 'email') {
    if (sortCol !== col) return ArrowUpDown;
    if (sortDir === 'asc') return ArrowUp;
    if (sortDir === 'desc') return ArrowDown;
    return ArrowUpDown;
  }

  function isSortActive(col: 'username' | 'email') {
    return sortCol === col;
  }

  function requestDelete(userId: string) {
    if (userId === currentUser.data?.id) {
      toast.error('Cannot delete yourself.');
      return;
    }
    userToDelete = userId;
    isDeleteDialogOpen = true;
  }

  // Column definitions for TanStack Table
  const columns: ColumnDef<UserRow>[] = [
    {
      accessorKey: 'username',
      header: () => renderSnippet(usernameHeaderSnippet),
      cell: (info) => info.getValue(),
    },
    {
      accessorKey: 'email',
      header: () => renderSnippet(emailHeaderSnippet),
      cell: (info) => (info.getValue() as string) || '-',
    },
    {
      id: 'actions',
      meta: { className: 'text-right' },
      header: 'Actions',
      cell: (ctx) => renderSnippet(actionsCellSnippet, { row: ctx.row }),
    },
  ];

  const processedUsersSnapshot = $derived(processedUsers);

  const table = createSvelteTable<UserRow>({
    data: processedUsersSnapshot,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
</script>

{#snippet usernameHeaderSnippet()}
  <span class="flex items-center gap-1">
    Username
    {#if getSortIcon('username') === ArrowUp}
      <ArrowUp class={isSortActive('username') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else if getSortIcon('username') === ArrowDown}
      <ArrowDown class={isSortActive('username') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else}
      <ArrowUpDown class={isSortActive('username') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {/if}
  </span>
{/snippet}

{#snippet emailHeaderSnippet()}
  <span class="flex items-center gap-1">
    Email
    {#if getSortIcon('email') === ArrowUp}
      <ArrowUp class={isSortActive('email') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else if getSortIcon('email') === ArrowDown}
      <ArrowDown class={isSortActive('email') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {:else}
      <ArrowUpDown class={isSortActive('email') ? 'h-4 w-4' : 'h-4 w-4 opacity-30'} />
    {/if}
  </span>
{/snippet}

{#snippet actionsCellSnippet({ row }: { row: { original: UserRow } })}
  <Button
    variant="ghost"
    size="icon"
    disabled={row.original.id === currentUser.data?.id}
    onclick={() => requestDelete(row.original.id)}
  >
    <Trash2 class="h-4 w-4 cursor-pointer text-destructive" />
  </Button>
{/snippet}

<div class="flex items-center justify-between space-y-2 pb-6">
  <div>
    <H2>Users</H2>
    <Mutated>Manage system users.</Mutated>
  </div>

  <div>
    <Button onclick={() => (isCreateDialogOpen = true)}>
      <UserPlus class="mr-2 h-4 w-4" />
      Create User
    </Button>
  </div>
</div>

<!-- Search -->
<div class="mb-4">
  <div class="relative max-w-sm">
    <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    <Input
      placeholder="Filter users..."
      bind:value={globalFilter}
      class="pl-9"
    />
  </div>
</div>

<Card.Root>
  <Card.Content class="p-0">
    <Table.Root>
      <Table.Header>
        {#each table.getHeaderGroups() as headerGroup}
          <Table.Row>
            {#each headerGroup.headers as header}
              <Table.Head
                class={header.column.id === 'username' || header.column.id === 'email' ? 'cursor-pointer select-none' : ''}
                onclick={header.column.id === 'username' ? () => toggleSort('username') : header.column.id === 'email' ? () => toggleSort('email') : undefined}
              >
                <FlexRender content={header.column.columnDef.header} context={header.getContext()} />
              </Table.Head>
            {/each}
          </Table.Row>
        {/each}
      </Table.Header>
      <Table.Body>
        {#if users.isLoading}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="py-8 text-center text-muted-foreground">
              Loading users...
            </Table.Cell>
          </Table.Row>
        {:else if users.error}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="py-8 text-center text-muted-foreground">
              Failed to load users: {users.error.message}
            </Table.Cell>
          </Table.Row>
        {:else if processedUsers.length === 0}
          <Table.Row>
            <Table.Cell colspan={columns.length} class="py-8 text-center text-muted-foreground">
              {globalFilter ? 'No users match your filter.' : 'No users found.'}
            </Table.Cell>
          </Table.Row>
        {:else}
          {#each table.getRowModel().rows as row}
            <Table.Row>
              {#each row.getVisibleCells() as cell}
                <Table.Cell class={cell.column.id === 'actions' ? 'text-right' : ''}>
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

<div class="flex items-center justify-end py-4">
  <Pagination.Root count={totalItems} perPage={pageSize} bind:page={currentPage}>
    {#snippet children({ pages, currentPage })}
      <Pagination.Content>
        <Pagination.Item>
          <Pagination.PrevButton />
        </Pagination.Item>
        {#each pages as page (page.key)}
          {#if page.type === 'ellipsis'}
            <Pagination.Item>
              <Pagination.Ellipsis />
            </Pagination.Item>
          {:else}
            <Pagination.Item>
              <Pagination.Link {page} isActive={currentPage === page.value}>
                {page.value}
              </Pagination.Link>
            </Pagination.Item>
          {/if}
        {/each}
        <Pagination.Item>
          <Pagination.NextButton />
        </Pagination.Item>
      </Pagination.Content>
    {/snippet}
  </Pagination.Root>
</div>

<CreateUserDialog bind:open={isCreateDialogOpen} />

<DeleteUserDialog bind:open={isDeleteDialogOpen} bind:userId={userToDelete} />
