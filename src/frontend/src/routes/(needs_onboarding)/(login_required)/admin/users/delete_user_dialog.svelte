<script lang="ts">
	import * as AlertDialog from '$lib/components/ui/alert-dialog/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
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

<AlertDialog.Root {open}>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>Are you absolutely sure?</AlertDialog.Title>
			<AlertDialog.Description>
				This action cannot be undone. This will permanently delete the user account.
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<Button variant="outline" onclick={() => (open = false)}>Cancel</Button>
			<Button variant="destructive" disabled={isDeleting} onclick={handleDelete}>
				{isDeleting ? 'Deleting...' : 'Delete User'}
			</Button>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
