<script lang="ts">
	import Host from './host.svelte';
	import Client from './client.svelte';
	import { page } from '$app/state';

	let room_id = $derived(page.params.room_id ?? '');
	let renderHost = $state(false);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hash = window.location.hash.slice(1);
		// Match patterns like `host_token:encryption_key`
		const hostPattern = /^([^:]+):([^:]+)$/;
		renderHost = hostPattern.test(hash);
	});
</script>

{#if renderHost}
	<Host {room_id} />
{:else}
	<Client {room_id} />
{/if}
