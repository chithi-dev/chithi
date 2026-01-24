<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '#queries/auth';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';

	const { logout } = useAuth();
	const nextUrl = $derived(page.url.searchParams.get('next') ?? '/');

	$effect.pre(() => {
		try {
			logout();
			goto(nextUrl);
		} catch (e) {
			if (e instanceof Error) {
				toast.error(e.message);
			}
		}
	});
</script>
