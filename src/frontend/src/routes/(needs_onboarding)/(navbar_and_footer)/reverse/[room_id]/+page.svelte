<script lang="ts">
	import { page } from '$app/state';
	import { isHost } from './utils';

	let room_id = $derived(page.params.room_id ?? '');
	let renderHost = $derived(isHost(page.url.hash.slice(1)));

	const { default: Host } = await import('./host.svelte');
	const { default: Client } = await import('./client.svelte');
</script>

{#if renderHost}
	<Host {room_id} />
{:else}
	<Client {room_id} />
{/if}
