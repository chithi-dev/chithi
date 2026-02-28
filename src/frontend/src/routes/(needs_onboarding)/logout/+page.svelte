<script>
	import { user_store } from '$lib/store/user.svelte';
	import { page } from '$app/state';
	import { onMount } from 'svelte';

	const { unauthenticate } = user_store();

	const next = $derived.by(() => {
		const url = page.url.searchParams.get('next') ?? '/';
		if (url.startsWith('/admin')) {
			return '/';
		}
		return url;
	});

	onMount(() => {
		unauthenticate();
		window.location.href = next;
	});
</script>
