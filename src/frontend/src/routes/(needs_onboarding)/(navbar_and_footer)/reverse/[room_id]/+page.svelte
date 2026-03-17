<script lang="ts">
	import Host from './host.svelte';
	import Client from './client.svelte';
	import { page } from '$app/state';
	import { isHost } from './utils';

	let room_id = $derived(page.params.room_id ?? '');
	let renderHost = $derived(isHost(page.url.hash.slice(1)));
</script>

{#if renderHost}
	<Host {room_id} />
{:else}
	<Client {room_id} />
{/if}
