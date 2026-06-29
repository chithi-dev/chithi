<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Upload, Gauge, ArrowLeftRight, PlugZap } from '@lucide/svelte';

	let showReconnect = $state(false);
	let reconnectUrl = $state('');

	function handleReconnect() {
		const raw = reconnectUrl.trim();
		if (!raw) {
			toast.error('Please paste your host link');
			return;
		}

		try {
			const url = new URL(raw, window.location.origin);
			const pathMatch = url.pathname.match(/\/reverse\/([^/]+)/);
			if (!pathMatch) {
				toast.error('Invalid link — expected a /reverse/<room_id> URL');
				return;
			}
			const roomId = pathMatch[1];
			const hash = url.hash; // includes the '#'
			goto(`/reverse/${roomId}${hash}`);
		} catch {
			toast.error('Invalid URL');
		}
	}
</script>

<div class="flex min-h-[70vh] items-center justify-center p-4">
	<div class="w-full max-w-2xl space-y-8">
		<div class="space-y-2 text-center">
			<h1 class="text-4xl font-bold tracking-tight">Chithi</h1>
			<p class="text-lg text-muted-foreground">
				Encrypt and send files with a link that automatically expires. What would you like to do?
			</p>
		</div>

		<div class="grid gap-4 sm:grid-cols-2">
			<a href="/upload/" class="no-underline">
				<Card.Rootclass="h-full cursor-pointer transition-shadow hover:shadow-md">
					<Card.Header class="flex flex-col items-center text-center">
						<Upload class="mb-2 h-8 w-8 text-primary" />
						<Card.Title>Upload</Card.Title>
						<Card.Description>
							Send a file securely with an expiring, password-protected link.
						</CardDescription>
					</Card.Header>
				</Card.Root>
			</a>

			<a href="/reverse/" class="no-underline">
				<Card.Rootclass="h-full cursor-pointer transition-shadow hover:shadow-md">
					<Card.Header class="flex flex-col items-center text-center">
						<ArrowLeftRight class="mb-2 h-8 w-8 text-primary" />
						<Card.Title>Reverse Share</Card.Title>
						<Card.Description>
							Create or join a room for real-time peer file transfer.
						</CardDescription>
					</Card.Header>
				</Card.Root>
			</a>

			<a href="/speedtest/" class="no-underline sm:col-span-2">
				<Card.Rootclass="h-full cursor-pointer transition-shadow hover:shadow-md">
					<Card.Header class="flex flex-col items-center text-center">
						<Gauge class="mb-2 h-8 w-8 text-primary" />
						<Card.Title>Speed Test</Card.Title>
						<Card.Description>
							Measure your upload and download speeds to this server.
						</CardDescription>
					</Card.Header>
				</Card.Root>
			</a>
		</div>

		{#if showReconnect}
			<Card.Root>
				<Card.Header>
					<Card.Title class="flex items-center gap-2">
						<PlugZap class="h-5 w-5" />
						Reconnect to Room
					</Card.Title>
					<Card.Description>
						Paste the host link you received when creating the room (the URL with the # token).
					</CardDescription>
				</Card.Header>
				<Card.Content>
					<Field.Field class="space-y-2">
						<Field.Label>Host Link</Field.Label>
						<Field.Content>
							<Input
								placeholder="https://…/reverse/room-id#host-token"
								bind:value={reconnectUrl}
								onkeydown={(e) => e.key === 'Enter' && handleReconnect()}
							/>
						</Field.Content>
					</Field.Field>
				</Card.Content>
				<Card.Footer class="flex gap-2">
					<Button variant="outline" onclick={() => (showReconnect = false)}>Cancel</Button>
					<Button onclick={handleReconnect} class="flex-1">Reconnect</Button>
				</Card.Footer>
			</Card.Root>
		{/if}
	</div>
</div>
