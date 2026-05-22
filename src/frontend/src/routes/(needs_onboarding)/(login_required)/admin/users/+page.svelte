<script lang="ts">
	import { useAuth } from '#queries/auth';
	import { useUsersQuery } from '#queries/admin_users';
	import * as Table from '$lib/components/ui/table';
	import * as Card from '$lib/components/ui/card';
	import * as Pagination from '$lib/components/ui/pagination';
	import { Button } from '$lib/components/ui/button';
	import { Trash2, UserPlus } from '@lucide/svelte';
	import { toast } from 'svelte-sonner';

	const { default: CreateUserDialog } = await import('./create_user_dialog.svelte');
	const { default: DeleteUserDialog } = await import('./delete_user_dialog.svelte');

	let currentPage = $state(1);
	const pageSize = 20;

	const { user } = useAuth();
	const { users } = useUsersQuery(() => currentPage, pageSize);

	let isCreateDialogOpen = $state(false);
	let isDeleteDialogOpen = $state(false);
	let userToDelete = $state<string | null>(null);

	let totalItems = $derived(users.data?.total_items ?? 0);

	function requestDelete(userId: string) {
		if (userId === user.data?.id) {
			toast.error('Cannot delete yourself.');
			return;
		}
		userToDelete = userId;
		isDeleteDialogOpen = true;
	}
</script>

<div class="flex items-center justify-between space-y-2 pb-6">
	<div>
		<h2 class="text-3xl font-bold tracking-tight">Users</h2>
		<p class="text-muted-foreground">Manage system users.</p>
	</div>

	<div>
		<Button onclick={() => (isCreateDialogOpen = true)}>
			<UserPlus class="mr-2 h-4 w-4" />
			Create User
		</Button>
	</div>
</div>

<Card.Root>
	<Card.Content class="p-0">
		<Table.Root>
			<Table.Header>
				<Table.Row>
					<Table.Head>Username</Table.Head>
					<Table.Head>Email</Table.Head>
					<Table.Head class="text-right">Actions</Table.Head>
				</Table.Row>
			</Table.Header>
			<Table.Body>
				{#if users.isLoading}
					<Table.Row>
						<Table.Cell colspan={3} class="py-8 text-center text-muted-foreground">
							Loading users...
						</Table.Cell>
					</Table.Row>
				{:else if users.error}
					<Table.Row>
						<Table.Cell colspan={3} class="py-8 text-center text-muted-foreground">
							Failed to load users: {users.error.message}
						</Table.Cell>
					</Table.Row>
				{:else if !users.data?.items || users.data.items.length === 0}
					<Table.Row>
						<Table.Cell colspan={3} class="py-8 text-center text-muted-foreground">
							No users found.
						</Table.Cell>
					</Table.Row>
				{:else}
					{#each users.data.items as u}
						<Table.Row>
							<Table.Cell>{u.username}</Table.Cell>
							<Table.Cell>{u.email || '-'}</Table.Cell>
							<Table.Cell class="text-right">
								<Button
									variant="ghost"
									size="icon"
									disabled={u.id === user.data?.id}
									onclick={() => requestDelete(u.id)}
								>
									<Trash2 class="h-4 w-4 cursor-pointer text-destructive" />
								</Button>
							</Table.Cell>
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
