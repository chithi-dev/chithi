<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Field from '$lib/components/ui/field/index.js';
	import { Upload, Gauge, ArrowLeftRight, PlugZap } from '@lucide/svelte';
	import * as Sheet from '$lib/components/ui/sheet/index.js';

	let reconnectOpen = $state(false);
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
				<Card.Root class="h-full cursor-pointer transition-shadow hover:shadow-md" tabindex="0">
					<Card.Header class="flex flex-col items-center text-center">
						<Upload class="mb-2 h-8 w-8 text-primary" />
						<Card.Title>Upload</Card.Title>
						<Card.Description>
							Send a file securely with an expiring, password-protected link.
						</Card.Description>
					</Card.Header>
				</Card.Root>
			</a>

			<a href="/reverse/" class="no-underline">
				<Card.Root class="h-full cursor-pointer transition-shadow hover:shadow-md" tabindex="0">
					<Card.Header class="flex flex-col items-center text-center">
						<ArrowLeftRight class="mb-2 h-8 w-8 text-primary" />
						<Card.Title>Reverse Share</Card.Title>
						<Card.Description>
							Create or join a room for real-time peer file transfer.
						</Card.Description>
					</Card.Header>
				</Card.Root>
			</a>

			<a href="/speedtest/" class="no-underline sm:col-span-2">
				<Card.Root class="h-full cursor-pointer transition-shadow hover:shadow-md" tabindex="0">
					<Card.Header class="flex flex-col items-center text-center">
						<Gauge class="mb-2 h-8 w-8 text-primary" />
						<Card.Title>Speed Test</Card.Title>
						<Card.Description>
							Measure your upload and download speeds to this server.
						</Card.Description>
					</Card.Header>
				</Card.Root>
			</a>
		</div>

		<Sheet.Root bind:open={reconnectOpen}>
			<Sheet.Trigger>
				{#snippet child({ props })}
					<Button {...props} variant="outline" class="mx-auto flex items-center gap-2 mt-4">
						<PlugZap class="h-4 w-4" />
						Reconnect to Room
					</Button>
				{/snippet}
			</Sheet.Trigger>
			<Sheet.Content class="sm:max-w-md">
				<Sheet.Header>
					<Sheet.Title class="flex items-center gap-2">
						<PlugZap class="h-5 w-5" />
						Reconnect to Room
					</Sheet.Title>
					<Sheet.Description>
						Paste the host link you received when creating the room (the URL with the # token).
					</Sheet.Description>
				</Sheet.Header>
				<div class="grid gap-4 py-4">
					<Field.Field class="space-y-2">
						<Field.Label>Host Link</Field.Label>
						<Field.Content>
							<Input
								placeholder="https://…/reverse/room-id#host-token"
								bind:value={reconnectUrl}
								onkeydown={(e) => { e.key === 'Enter' && handleReconnect(); reconnectOpen = false; }}
							/>
						</Field.Content>
					</Field.Field>
				</div>
				<Sheet.Footer class="flex gap-2">
					<Sheet.Close class={buttonVariants({ variant: "outline" })}>Cancel</Sheet.Close>
					<Button class="flex-1" onclick={() => { handleReconnect(); reconnectOpen = false; }}>Reconnect</Button>
				</Sheet.Footer>
			</Sheet.Content>
		</Sheet.Root>
	</div>
</div>
