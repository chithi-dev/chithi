<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		Card,
		CardContent,
		CardDescription,
		CardFooter,
		CardHeader,
		CardTitle
	} from '$lib/components/ui/card';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Upload, Gauge, ArrowLeftRight, PlugZap } from 'lucide-svelte';

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
				<Card class="h-full cursor-pointer transition-shadow hover:shadow-md">
					<CardHeader class="flex flex-col items-center text-center">
						<Upload class="mb-2 h-8 w-8 text-primary" />
						<CardTitle>Upload</CardTitle>
						<CardDescription>
							Send a file securely with an expiring, password-protected link.
						</CardDescription>
					</CardHeader>
				</Card>
			</a>

			<a href="/reverse/" class="no-underline">
				<Card class="h-full cursor-pointer transition-shadow hover:shadow-md">
					<CardHeader class="flex flex-col items-center text-center">
						<ArrowLeftRight class="mb-2 h-8 w-8 text-primary" />
						<CardTitle>Reverse Share</CardTitle>
						<CardDescription>
							Create or join a room for real-time peer file transfer.
						</CardDescription>
					</CardHeader>
				</Card>
			</a>

			<a href="/speedtest/" class="no-underline sm:col-span-2">
				<Card class="h-full cursor-pointer transition-shadow hover:shadow-md">
					<CardHeader class="flex flex-col items-center text-center">
						<Gauge class="mb-2 h-8 w-8 text-primary" />
						<CardTitle>Speed Test</CardTitle>
						<CardDescription>
							Measure your upload and download speeds to this server.
						</CardDescription>
					</CardHeader>
				</Card>
			</a>
		</div>

		{#if showReconnect}
			<Card>
				<CardHeader>
					<CardTitle class="flex items-center gap-2">
						<PlugZap class="h-5 w-5" />
						Reconnect to Room
					</CardTitle>
					<CardDescription>
						Paste the host link you received when creating the room (the URL with the # token).
					</CardDescription>
				</CardHeader>
				<CardContent>
					<div class="space-y-2">
						<Label for="reconnect-url">Host Link</Label>
						<Input
							id="reconnect-url"
							placeholder="https://…/reverse/room-id#host-token"
							bind:value={reconnectUrl}
							onkeydown={(e) => e.key === 'Enter' && handleReconnect()}
						/>
					</div>
				</CardContent>
				<CardFooter class="flex gap-2">
					<Button variant="outline" onclick={() => (showReconnect = false)}>Cancel</Button>
					<Button onclick={handleReconnect} class="flex-1">Reconnect</Button>
				</CardFooter>
			</Card>
		{/if}
	</div>
</div>
