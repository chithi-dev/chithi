<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAuth } from '$lib/queries/auth';
	import { page } from '$app/state';

	const { logout } = useAuth();
	const nextUrl = $derived(page.url.searchParams.get('next') ?? '/');

	$effect.pre(() => {
		logout();
		goto(nextUrl);
	});
</script>
