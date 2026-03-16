<script lang="ts">
	import Host from './host.svelte';
	import Client from './client.svelte';
	import { page } from '$app/state';
	import { browser } from '$app/environment';
	import { isHost } from './utils';

	let room_id = $derived(page.params.room_id ?? '');
	let renderHost = $state(false);

	$effect(() => {
		if (!browser) return;

		const hash = window.location.hash.slice(1);
		renderHost = isHost(hash);
	});
</script>

{#if renderHost}
	<Host {room_id} />
{:else}
	<Client {room_id} />
{/if}
