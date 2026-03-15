<script lang="ts">
	import { page } from '$app/state';
	import Host from './host.svelte';
	import Client from './client.svelte';

	let room_id = $derived(page.params.room_id as string);

	// Host token is passed via URL fragment hash so it never leaks in share links.
	// Format: #<token>
	let hostToken = $state<string | null>(null);

	$effect(() => {
		if (typeof window === 'undefined') return;
		const hash = window.location.hash.slice(1);
		if (hash) {
			hostToken = hash;
		}
	});
</script>

{#if hostToken !== null}
	<Host {room_id} {hostToken} />
{:else}
	<Client {room_id} />
{/if}
