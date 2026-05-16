<script lang="ts">
	import * as Dialog from '$lib/components/ui/dialog';
	import { Button } from '$lib/components/ui/button';
	import { useUsersQuery } from '#queries/admin_users';
	import { toast } from 'svelte-sonner';

	let { open = $bindable(false), userId = $bindable(null) } = $props<{
		open: boolean;
		userId: string | null;
	}>();

	const { deleteUser } = useUsersQuery(() => 1, 20);
	let isDeleting = $state(false);

	async function handleDelete() {
		if (!userId) return;
		isDeleting = true;
		try {
			await deleteUser(userId);
			toast.success('User deleted successfully.');
			open = false;
			userId = null;
		} catch (e: any) {
			toast.error(e.message || 'Failed to delete user.');
		} finally {
			isDeleting = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Content>
		<Dialog.Header>
			<Dialog.Title>Are you absolutely sure?</Dialog.Title>
			<Dialog.Description>
				This action cannot be undone. This will permanently delete the user account.
			</Dialog.Description>
		</Dialog.Header>
		<Dialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button variant="destructive" disabled={isDeleting} onclick={handleDelete}>
				{isDeleting ? 'Deleting...' : 'Delete User'}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
